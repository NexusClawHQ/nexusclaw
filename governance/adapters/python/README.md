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

## Recipes: LangGraph and CrewAI

One pattern, two compositions: ask the gate before acting, pause for a human
on L2/L3 risk, then execute and report to the audit chain. Both recipes run
against a live sidecar (see [Running the sidecar](#running-the-sidecar) below).

### LangGraph — gate → interrupt → resume

The one subtlety: `interrupt()` **re-executes its node on resume**, so the
gate call must not live in the same node — otherwise resume fires a second
gate execution. The recipe therefore uses three nodes: `gate_check` (asks
the sidecar), `human_gate` (contains *only* the interrupt, so re-execution
is side-effect-free) and `execute`.

```python
# pip install langgraph
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

from agent_governance import GovernanceClient

gov = GovernanceClient("http://127.0.0.1:7899")

TOOL = "crm.update_customer"


def update_customer_impl(customer_id: str, note: str) -> str:
    ...  # your real implementation


class State(TypedDict, total=False):
    customer_id: str
    note: str
    execution_id: str
    approval_id: str
    messages: list[str]


def gate_check(state: State):
    verdict = gov.gate(TOOL, {"args": [state["customer_id"], state["note"]]})
    if verdict["decision"] == "blocked":                      # deny by default
        reason = verdict.get("reason", "BLOCKED")
        return Command(update={"messages": [f"{TOOL}: denied by policy ({reason})"]}, goto=END)
    if verdict["decision"] == "allow":                        # L0/L1: proceed, audited
        return Command(update={"execution_id": verdict["executionId"]}, goto="execute")
    return Command(                                           # L2/L3: pause for a human
        update={"execution_id": verdict["executionId"],
                "approval_id": verdict["approvalId"]},
        goto="human_gate",
    )


def human_gate(state: State):
    # Only the interrupt lives here: re-execution on resume is side-effect-free.
    decision = interrupt({"approval_id": state["approval_id"], "tool": TOOL})
    gov.decide(state["approval_id"], decision, comment="langgraph resume")
    if decision != "APPROVED":
        return Command(update={"messages": [f"{TOOL}: rejected by human"]}, goto=END)
    return Command(goto="execute")


def execute(state: State):
    result = update_customer_impl(state["customer_id"], state["note"])
    gov.complete(state["execution_id"], success=True, output=result)
    return Command(update={"messages": [str(result)]})


builder = StateGraph(State)
builder.add_node("gate_check", gate_check)
builder.add_node("human_gate", human_gate)
builder.add_node("execute", execute)
builder.add_edge(START, "gate_check")
builder.add_edge("execute", END)
app = builder.compile(checkpointer=InMemorySaver())  # a checkpointer is required for interrupt()

config = {"configurable": {"thread_id": "demo-1"}}
app.invoke({"customer_id": "C-1001", "note": "quarterly check-in"}, config)
# → paused inside human_gate; the approval payload is in state["__interrupt__"]

app.invoke(Command(resume="APPROVED"), config)   # or "REJECTED"
```

### CrewAI — governed tools in a crew

CrewAI tools are synchronous, so the simplest composition is `wait=True`:
the gated call blocks, polling until a human approves or rejects in the
sidecar console — approved executes and returns, rejected raises
`GovernanceDenied`. Every attempt lands on the audit chain either way.

```python
# pip install crewai
from crewai import Agent, Crew, Task
from crewai.tools import tool

from agent_governance import GovernanceClient

gov = GovernanceClient("http://127.0.0.1:7899")


def update_customer_impl(customer_id: str, note: str) -> str:
    ...  # your real implementation


gated_update_customer = gov.wrap_tool(
    update_customer_impl, name="crm.update_customer", wait=True
)


@tool("Update customer record")
def update_customer(customer_id: str, note: str) -> str:
    """Update a customer's CRM record with an operational note.

    Args:
        customer_id: the customer identifier, e.g. C-1001
        note: short operational note to append to the record
    """
    return gated_update_customer(customer_id, note)


operator = Agent(
    role="Customer success operator",
    goal="Keep customer records current under governance",
    backstory="You operate a CRM. Risky writes pause for human approval.",
    tools=[update_customer],
)

crew = Crew(
    agents=[operator],
    tasks=[Task(
        description="Append the note 'quarterly check-in' to customer C-1001",
        expected_output="the confirmation message",
    )],
)
crew.kickoff()
```

Prefer not to block the worker? Wrap without `wait` and catch
`GovernancePendingApproval` — surface `pending.approval_id` as the tool
result, let your operator approve via the sidecar console, then execute with
`gov.run_approved(...)` and re-run the task.

### Any framework (or none) — the core pattern

```python
gated = gov.wrap_tool(update_customer_impl, name="crm.update_customer")

try:
    gated("C-1001", "quarterly check-in")          # allow → runs + audited
except GovernancePendingApproval as pending:        # L2/L3 → paused
    park_somewhere(pending)                         # your queue / UI / interrupt
# ... after the human decides (console, API, anywhere):
gov.decide(pending.approval_id, "APPROVED")         # or "REJECTED"
result = gov.run_approved(update_customer_impl, pending, "C-1001", "quarterly check-in")
```

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
