"""Zero-dependency HTTP client for the agent-governance sidecar.

The sidecar exposes a per-call governance gate:

    POST /gate                      {toolName, toolInput} -> allow|paused|blocked
    POST /gate/:id/complete         {success, output}     -> record the outcome
    GET  /approvals/pending                              -> pending approvals
    POST /approvals/:id/decide      {decision, comment}   -> APPROVED|REJECTED
    GET  /executions/:id                                 -> audit-chain detail
    GET  /audit/list                                     -> recent executions
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, List, Optional

from .exceptions import GovernanceDenied, GovernancePendingApproval

Transport = Callable[[str, str, Optional[Dict[str, Any]]], Dict[str, Any]]


def _default_transport(timeout: float, headers: Dict[str, str]) -> Transport:
    def transport(method: str, path: str, body: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        url = path
        data = json.dumps(body).encode("utf-8") if body is not None else None
        request = urllib.request.Request(url, data=data, method=method)
        for key, value in headers.items():
            request.add_header(key, value)
        if data is not None:
            request.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:  # pragma: no cover - depends on server
            detail = error.read().decode("utf-8", "replace")
            raise GovernanceError_from_status(error.code, detail) from error

    return transport


def GovernanceError_from_status(code: int, detail: str) -> Exception:  # noqa: N802
    from .exceptions import GovernanceError

    return GovernanceError(f"sidecar responded {code}: {detail}")


class GovernanceClient:
    def __init__(
        self,
        base_url: str,
        *,
        timeout: float = 10.0,
        token: Optional[str] = None,
        _transport: Optional[Transport] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        headers: Dict[str, str] = {"Accept": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self._transport = _transport or _default_transport(timeout, headers)

    def _call(self, method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return self._transport(method, self.base_url + path, body)

    # ── gate API ─────────────────────────────────────────────────────────

    def gate(self, tool_name: str, tool_input: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Ask the sidecar whether ``tool_name`` may run with ``tool_input``.

        Returns ``{"decision": "allow"|"paused"|"blocked", ...}``. Deny by
        default: grants and risk rules live server-side, never client-side.
        """
        return self._call("POST", "/gate", {"toolName": tool_name, "toolInput": tool_input or {}})

    def complete(self, execution_id: str, *, success: bool = True, output: Any = None) -> Dict[str, Any]:
        """Report the outcome of a locally executed (allowed/approved) tool."""
        return self._call("POST", f"/gate/{execution_id}/complete", {"success": success, "output": output})

    # ── approvals & audit ────────────────────────────────────────────────

    def pending_approvals(self) -> List[Dict[str, Any]]:
        return self._call("GET", "/approvals/pending").get("approvals", [])

    def decide(self, approval_id: str, decision: str, *, comment: Optional[str] = None) -> Dict[str, Any]:
        normalized = decision.upper()
        if normalized not in ("APPROVED", "REJECTED"):
            raise ValueError("decision must be APPROVED or REJECTED")
        return self._call("POST", f"/approvals/{approval_id}/decide", {"decision": normalized, "comment": comment})

    def execution(self, execution_id: str) -> Dict[str, Any]:
        return self._call("GET", f"/executions/{execution_id}")

    def audit_list(self) -> List[Dict[str, Any]]:
        return self._call("GET", "/audit/list").get("executions", [])

    # ── tool wrapping ────────────────────────────────────────────────────

    def wrap_tool(self, fn=None, *, name: Optional[str] = None, wait: bool = False, poll_interval: float = 0.5, poll_timeout: float = 600.0):
        """Wrap ``fn`` with sidecar governance.

            gov = GovernanceClient("http://127.0.0.1:7800")

            @gov.wrap_tool
            def update_customer(customer_id: str, note: str): ...

        Behaviour per gated call:
          - allow              -> execute locally, report via /complete, return
          - paused, wait=False -> raise GovernancePendingApproval (wire to your
                                  framework's interrupt; approve/reject via
                                  ``decide``, then re-invoke)
          - paused, wait=True  -> poll until a human decides; approved executes
                                  + completes, rejected raises GovernanceDenied
          - blocked            -> raise GovernanceDenied(reason)
        """
        if fn is None:
            return lambda f: self.wrap_tool(f, name=name, wait=wait, poll_interval=poll_interval, poll_timeout=poll_timeout)

        tool_name = name or f"{fn.__module__}.{fn.__name__}"

        def wrapper(*args, **kwargs):
            result = self.gate(tool_name, {"args": list(args), "kwargs": kwargs})
            decision = result.get("decision")
            if decision == "blocked":
                raise GovernanceDenied(result.get("reason", "BLOCKED"))
            if decision == "paused":
                if not wait:
                    raise GovernancePendingApproval(
                        result["executionId"], result["approvalId"], tool_name, result.get("riskLevel", "?")
                    )
                return self._wait_and_run(fn, tool_name, result["executionId"], poll_interval, poll_timeout, args, kwargs)
            return self._run_and_complete(fn, result["executionId"], args, kwargs)

        wrapper.__name__ = fn.__name__
        wrapper.__doc__ = (fn.__doc__ or "") + "\n[governed via agent-governance sidecar]"
        wrapper.__wrapped__ = fn
        return wrapper

    def run_approved(self, fn, pending, *args, **kwargs):
        """Execute ``fn`` locally against an ALREADY-APPROVED paused call and
        report the outcome on the original execution.

        The interrupt-style flow (LangGraph / CrewAI):

            try:
                send_email(customer_id, subject)
            except GovernancePendingApproval as pending:
                save(pending)                      # your framework's interrupt
            ...
            gov.decide(pending.approval_id, "APPROVED")
            result = gov.run_approved(send_email.__wrapped__, pending, customer_id, subject)
        """
        execution_id = getattr(pending, "execution_id", pending)
        return self._run_and_complete(fn, execution_id, args, kwargs)

    # ── internals ────────────────────────────────────────────────────────

    def _run_and_complete(self, fn, execution_id, args, kwargs):
        outcome = {"success": True, "output": None}
        try:
            outcome["output"] = fn(*args, **kwargs)
            return outcome["output"]
        except Exception as error:  # noqa: BLE001 - report every failure
            outcome["success"] = False
            outcome["output"] = {"error": str(error)}
            raise
        finally:
            try:
                self.complete(execution_id, success=outcome["success"], output=outcome["output"])
            except Exception:  # noqa: BLE001 - never mask the tool result
                pass

    def _wait_and_run(self, fn, tool_name, execution_id, poll_interval, poll_timeout, args, kwargs):
        import time

        deadline = time.monotonic() + poll_timeout
        while time.monotonic() < deadline:
            status = self.execution(execution_id)["execution"]["status"]
            if status == "cancelled":
                raise GovernanceDenied(f"{tool_name}: approval rejected")
            if status == "running":  # approved; awaiting local execution
                return self._run_and_complete(fn, execution_id, args, kwargs)
            time.sleep(poll_interval)
        raise GovernancePendingApproval(execution_id, "?", tool_name, "poll-timeout")
