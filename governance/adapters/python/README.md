# agent-governance (Python client)

Governance for AI agent tools — deny by default, L0–L4 guardrails, human
approvals, full audit chain — via the [agent-governance
sidecar](../../packages/sidecar). Zero dependencies (stdlib only).

## Install & adopt in three lines

```sh
# from this repository (works today, no PyPI needed):
pip install "git+https://github.com/NexusClawHQ/nexusclaw-agent-governance.git#subdirectory=governance/adapters/python"
# or from PyPI once published: pip install nexusclaw-agent-governance
```

```python
from agent_governance import GovernanceClient

gov = GovernanceClient("http://127.0.0.1:7899")
update_customer = gov.wrap_tool(update_customer)   # gated + audited
```

Every wrapped call now:

- asks the sidecar `POST /gate` whether the tool may run — grants and risk
  rules live **server-side** (deny by default: a tool nobody granted never
  runs, and the denial itself lands on the audit chain);
- on `allow`, executes locally and reports the outcome (`complete`), so the
  audit chain records the result;
- on `blocked`, raises `GovernanceDenied(reason)`;
- on L2/L3 risk, raises `GovernancePendingApproval` — wire it to your
  framework's human-in-the-loop.

## LangGraph / CrewAI: the interrupt pattern

```python
@gov.wrap_tool(name="demo.send_followup_email")
def send_email(customer_id: str, subject: str): ...

try:
    send_email("C-1001", "quarterly check-in")
except GovernancePendingApproval as pending:
    interrupt({"approval_id": pending.approval_id, "risk": pending.risk_level})
# ... after the human decides (console, API, anywhere):
gov.decide(pending.approval_id, "APPROVED")
result = gov.run_approved(send_email.__wrapped__, pending, "C-1001", "quarterly check-in")
```

Prefer to just block? `wrap_tool(fn, wait=True)` polls until a human decides
(approved executes + completes; rejected raises `GovernanceDenied`).

## Running the sidecar

```sh
cd governance/packages/sidecar
SIDECAR_GATE_ALLOWED_TOOLS="crm.update_customer,demo.send_followup_email" \
SIDECAR_PGDATABASE=nexusclaw_sidecar pnpm exec tsx scripts/dev-server.ts
```

The console at `http://127.0.0.1:7899/console` shows pending approvals and
the audit chain (execution → tool calls → outbox events).

## Tests

```sh
python3 -m unittest discover -s test                    # offline (stubbed transport)
python3 scripts/integration_test.py http://127.0.0.1:7899   # live sidecar
```
