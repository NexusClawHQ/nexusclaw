# The governance closed loop, in three demos

Everything below runs from this published tree — no private code, no external
LLM credential. Each demo shows the same invariant from a different angle:
**an agent starts with nothing allowed; every grant, pause, approval and
execution lands on an audit chain.**

| Demo | What you see | Time |
|---|---|---|
| [A — Browser](#demo-a--browser) | The closed loop in the `/console` UI | ~2 min |
| [B — Terminal](#demo-b--terminal) | `pnpm verify`: build + 58 tests + the HTTP loop | ~2 min |
| [C — Your own agent](#demo-c--gate-your-own-agent-in-three-lines) | Gate a foreign framework's tool in 3 lines | ~5 min |

The scenario in all three: an L1 customer lookup proceeds and is audited; an
L3 follow-up email pauses for a human decision; approving it resumes the
execution; the audit chain ends with execution → reasoning steps → tool calls
→ outbox events.

```
 you / your framework        sidecar + executor                audit chain
 ───────────────────        ────────────────────              ─────────────
   POST /executions  ──>    L1 lookup  : allowed      ──>     tool call audited
                            L3 email   : guardrail L3 ──>     tool call paused
   <-- status: guardrail_pending
   GET  /approvals/pending ─>
   POST /approvals/:id/decide  APPROVED
                        ──>    resume (one-shot grant) ──>    resumed + done
   <-- status: done
   GET  /audit/list     ──>    steps=3 toolCalls=2     ──>    full chain
```

## Demo A — Browser

```sh
cp .env.example .env    # replace every replace-with-... value with a local secret
docker compose up --build
```

Open <http://localhost:3000/console> and sign in with the seeded demo account
(`demo` / `nexusclaw-demo`). Run the task and watch the deterministic
three-phase scenario: the L1 lookup completes, the L3 follow-up email pauses
in the approvals view, your approval resumes it, and the audit-chain view
shows every step and tool call afterwards.

## Demo B — Terminal

Prerequisites: Node 22.18.x, pnpm 10, and a reachable Postgres
(`SIDECAR_PGHOST/PORT/USER/PASSWORD`, defaults `localhost:5432`
`postgres/postgres`). The verifier creates and drops only its own scratch
database (`nexusclaw_sidecar_verify_tmp`).

```sh
cd governance
pnpm install
pnpm verify
```

`pnpm verify` = build all 9 workspace packages + run the test suite + walk
the closed loop over real HTTP against real Postgres. Output from a run
against the v0.4.0-community published tree (abbreviated):

```
packages/permission test:       Tests  16 passed (16)
packages/governor test:         Tests  6 passed (6)
packages/guardrail test:        Tests  10 passed (10)
packages/outbox test:           Tests  6 passed (6)      # against real Postgres
packages/audit-chain test:      Tests  9 passed (9)
packages/approval test:         Tests  9 passed (9)
packages/executor test:         Tests  2 passed (2)      # end-to-end ReAct loop

STEP0 console-shell: ok
STEP1 execute-paused: ok
STEP2 pending-approval: demo.send_followup_email L3
STEP3 approve-resume: done
STEP4 audit-chain: steps=3 toolCalls=2
STEP5 audit-list + reject-path: ok
STEP6 gate-allow + complete: done (audit row recorded)
STEP7 gate-L3 pause -> approve -> complete: done
STEP8 gate-deny-by-default: blocked
LOOP-RESULT: PASS
```

STEP0–5 are the governed executor loop; STEP6–8 exercise the v0.4.0 gate API
that Demo C uses.

## Demo C — Gate your own agent in three lines

The gate API exists so **your** framework — LangGraph, CrewAI, n8n, Dify, a
plain script — can route its tool calls through the same grants, guardrails,
approvals and audit chain. Start the sidecar:

```sh
cd governance/packages/sidecar
SIDECAR_GATE_ALLOWED_TOOLS="crm.update_customer,demo.send_followup_email" \
SIDECAR_PGDATABASE=nexusclaw_sidecar pnpm exec tsx scripts/dev-server.ts
# console: http://127.0.0.1:7899/console
```

Raw HTTP — `POST /gate` asks, `POST /gate/:executionId/complete` reports the
outcome (abbreviated responses):

```sh
curl -s localhost:7899/gate -H 'content-type: application/json' \
  -d '{"toolName":"demo.send_followup_email","toolInput":{"customerId":"C-1001"}}'
# {"decision":"paused","approvalId":"…","riskLevel":"L3", …}   # deny by default
curl -s -X POST localhost:7899/gate/$EXECUTION_ID/complete \
  -H 'content-type: application/json' -d '{"success":true,"output":"sent"}'
# {"executionId":"…","status":"completed"}                      # audit row written
```

Or with the zero-dependency Python client
([governance/adapters/python](../governance/adapters/python)):

```python
from agent_governance import GovernanceClient

gov = GovernanceClient("http://127.0.0.1:7899")
update_customer = gov.wrap_tool(update_customer)   # gated + audited
```

Every wrapped call asks the sidecar whether the tool may run; `allow` executes
locally and reports the outcome, `blocked` raises `GovernanceDenied`, and an
L2/L3 risk raises `GovernancePendingApproval` — wire it to your framework's
human-in-the-loop, then `gov.decide(...)` and `gov.run_approved(...)`. See the
[adapter README](../governance/adapters/python/README.md) for the LangGraph /
CrewAI interrupt recipe and the blocking `wait=True` mode.

Not writing Python? v0.5.0 ships ready-made adapters over the same gate API:
**n8n nodes** ([Governance Gate / Approve / Pending](../governance/adapters/n8n))
and a **Dify OpenAPI custom-tool schema**
([import guide](../governance/adapters/dify)) — no custom integration code.

---

More: [architecture](../docs/architecture.md) ·
[governance package status](../governance/README.md) ·
[roadmap](../ROADMAP.md) · [changelog](../CHANGELOG.md)
