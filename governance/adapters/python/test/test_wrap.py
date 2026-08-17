import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from agent_governance import (  # noqa: E402
    GovernanceClient,
    GovernanceDenied,
    GovernancePendingApproval,
)


class FakeTransport:
    """Scripted transport: routes (method, path-pattern) -> responder."""

    def __init__(self):
        self.calls = []
        self.routes = {}

    def add(self, method, path, response):
        self.routes[(method, path)] = response

    def __call__(self, method, path, body):
        self.calls.append((method, path, body))
        key = (method, path)
        if key not in self.routes:
            raise AssertionError(f"unexpected request {method} {path}")
        response = self.routes[key]
        if callable(response):
            return response(body)
        return response


def make_client(transport):
    return GovernanceClient("http://sidecar.test", _transport=transport)


def gate_allow(body):
    return {"decision": "allow", "executionId": "exec-1", "toolCallId": "call-1"}


def gate_paused(body):
    return {
        "decision": "paused",
        "executionId": "exec-2",
        "toolCallId": "call-2",
        "approvalId": "appr-1",
        "riskLevel": "L3",
    }


def gate_blocked(body):
    return {"decision": "blocked", "executionId": "exec-3", "toolCallId": "call-3", "reason": "TOOL_NOT_ALLOWED:demo.x"}


class WrapToolTests(unittest.TestCase):
    def test_allow_executes_and_completes(self):
        transport = FakeTransport()
        transport.add("POST", "http://sidecar.test/gate", gate_allow)
        transport.add("POST", "http://sidecar.test/gate/exec-1/complete", {"status": "completed"})
        client = make_client(transport)

        def add(a, b):
            return a + b

        wrapped = client.wrap_tool(add, name="math.add")
        self.assertEqual(wrapped(2, 3), 5)
        complete = [c for c in transport.calls if c[1].endswith("/complete")][0]
        self.assertTrue(complete[2]["success"])
        self.assertEqual(complete[2]["output"], 5)

    def test_allow_reports_failure(self):
        transport = FakeTransport()
        transport.add("POST", "http://sidecar.test/gate", gate_allow)
        transport.add("POST", "http://sidecar.test/gate/exec-1/complete", {"status": "completed"})
        client = make_client(transport)

        def boom():
            raise ValueError("kaput")

        wrapped = client.wrap_tool(boom, name="tests.boom")
        with self.assertRaises(ValueError):
            wrapped()
        complete = [c for c in transport.calls if c[1].endswith("/complete")][0]
        self.assertFalse(complete[2]["success"])

    def test_paused_raises_without_wait(self):
        transport = FakeTransport()
        transport.add("POST", "http://sidecar.test/gate", gate_paused)
        client = make_client(transport)

        def never():
            raise AssertionError("must not run")

        wrapped = client.wrap_tool(never, name="demo.send")
        with self.assertRaises(GovernancePendingApproval) as ctx:
            wrapped()
        self.assertEqual(ctx.exception.approval_id, "appr-1")
        self.assertEqual(ctx.exception.risk_level, "L3")

    def test_paused_wait_executes_after_approval(self):
        transport = FakeTransport()
        transport.add("POST", "http://sidecar.test/gate", gate_paused)
        statuses = iter(
            [{"execution": {"status": "guardrail_pending"}},
             {"execution": {"status": "guardrail_pending"}},
             {"execution": {"status": "running"}}]
        )
        transport.add("GET", "http://sidecar.test/executions/exec-2", lambda _body: next(statuses))
        transport.add("POST", "http://sidecar.test/gate/exec-2/complete", {"status": "completed"})
        client = make_client(transport)

        def send(subject):
            return f"sent:{subject}"

        wrapped = client.wrap_tool(send, name="demo.send", wait=True, poll_interval=0)
        self.assertEqual(wrapped("hello"), "sent:hello")

    def test_paused_wait_rejected_denies(self):
        transport = FakeTransport()
        transport.add("POST", "http://sidecar.test/gate", gate_paused)
        transport.add(
            "GET", "http://sidecar.test/executions/exec-2",
            {"execution": {"status": "cancelled"}},
        )
        client = make_client(transport)

        wrapped = client.wrap_tool(lambda: None, name="demo.send", wait=True, poll_interval=0)
        with self.assertRaises(GovernanceDenied):
            wrapped()

    def test_blocked_denies(self):
        transport = FakeTransport()
        transport.add("POST", "http://sidecar.test/gate", gate_blocked)
        client = make_client(transport)

        wrapped = client.wrap_tool(lambda: None, name="demo.x")
        with self.assertRaises(GovernanceDenied) as ctx:
            wrapped()
        self.assertIn("TOOL_NOT_ALLOWED", ctx.exception.reason)

    def test_run_approved_completes_original_execution(self):
        transport = FakeTransport()
        transport.add("POST", "http://sidecar.test/gate", gate_paused)
        transport.add("POST", "http://sidecar.test/gate/exec-2/complete", {"status": "completed"})
        client = make_client(transport)

        def send(subject):
            return {"sent": True, "subject": subject}

        wrapped = client.wrap_tool(send, name="demo.send")
        try:
            wrapped("hi")
        except GovernancePendingApproval as pending:
            outcome = client.run_approved(wrapped.__wrapped__, pending, "hi")
        self.assertEqual(outcome["sent"], True)
        complete = [c for c in transport.calls if c[1].endswith("/complete")][0]
        self.assertEqual(complete[2]["output"]["subject"], "hi")
        # exactly one gate call and one complete — no re-gating on resume
        gates = [c for c in transport.calls if c[1].endswith("/gate") and c[0] == "POST"]
        self.assertEqual(len(gates), 1)

    def test_decide_validates_decision(self):
        client = make_client(FakeTransport())
        with self.assertRaises(ValueError):
            client.decide("appr-1", "MAYBE")


if __name__ == "__main__":
    unittest.main()
