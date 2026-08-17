"""Live integration test: python client against a running sidecar.

Start the sidecar first (from governance/packages/sidecar):
    SIDECAR_PORT=7899 pnpm exec tsx scripts/dev-server.ts
Then:
    python3 scripts/integration_test.py http://127.0.0.1:7899
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from agent_governance import (  # noqa: E402
    GovernanceClient,
    GovernanceDenied,
    GovernancePendingApproval,
)


def main(url: str) -> int:
    gov = GovernanceClient(url)

    # 1. allowed tool: executes locally, outcome lands on the audit chain
    @gov.wrap_tool(name="crm.update_customer")
    def update_customer(customer_id: str, note: str):
        return {"customer_id": customer_id, "note": note, "updated": True}

    result = update_customer("C-1001", "follow-up scheduled")
    assert result["updated"] is True
    print("STEP1 gate-allow + complete:", result)

    # 2. L3 tool: paused without wait -> interrupt-style exception
    @gov.wrap_tool(name="demo.send_followup_email")
    def send_email(customer_id: str, subject: str):
        return {"customer_id": customer_id, "subject": subject, "sent": True}

    try:
        send_email("C-1001", "quarterly check-in")
        raise AssertionError("expected GovernancePendingApproval")
    except GovernancePendingApproval as pending:
        print("STEP2 gate-L3 paused:", pending.approval_id, pending.risk_level)

        # 3. human approves via the same client; interrupt-style resume runs
        #    the tool against the ORIGINAL execution (no new gate call)
        decision = gov.decide(pending.approval_id, "APPROVED", comment="integration test")
        assert decision["executionStatus"] == "running", decision
        outcome = gov.run_approved(
            send_email.__wrapped__, pending, "C-1001", "quarterly check-in"
        )
        assert outcome["sent"] is True
        print("STEP3 approve + run_approved + complete:", outcome)

    # 4. deny by default: an unlisted tool never runs
    @gov.wrap_tool(name="unlisted.tool")
    def unlisted():
        raise AssertionError("must not run")

    try:
        unlisted()
        raise AssertionError("expected GovernanceDenied")
    except GovernanceDenied as denied:
        assert "TOOL_NOT_ALLOWED" in denied.reason
        print("STEP4 deny-by-default:", denied.reason)

    # 5. the audit chain carries every gated call
    time.sleep(0.2)
    executions = gov.audit_list()
    gated = [e for e in executions if "gate:" in (e.get("rawInput") or "")]
    assert len(gated) >= 3, f"expected >=3 gated executions, got {len(gated)}"
    print(f"STEP5 audit-list: {len(gated)} gated executions recorded")
    print("INTEGRATION-RESULT: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:7899"))
