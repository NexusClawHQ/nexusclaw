# Adapters — three-line governance for any agent framework

The [sidecar](../packages/sidecar) exposes a framework-neutral gate API, so
external agent runtimes can adopt the governance core without touching their
own tool code:

```
POST /gate                    {toolName, toolInput} -> allow | paused | blocked
POST /gate/:id/complete       {success, output}      -> record the outcome
GET  /approvals/pending                              -> pending L2/L3 approvals
POST /approvals/:id/decide    {decision, comment}    -> APPROVED | REJECTED
GET  /executions/:id / GET /audit/list               -> audit chain
```

Every gated call — allowed, paused, approved, rejected or blocked — lands on
the same audit chain (`agent_executions` → `tool_call_records` →
`outbox_events`).

## python/ — shipped

`agent-governance` client (stdlib-only): `wrap_tool`, interrupt-style
`run_approved`, blocking `wait=True`, approval decisions, audit queries.
See [python/README.md](python/README.md). Offline unit tests (8) + a live
integration test against the sidecar.

## n8n/ — shipped

`n8n-nodes-nexusclaw-governance` — three nodes over the gate API:

- **Governance Gate** — `POST /gate`; route downstream nodes on
  `{{ $json.decision }}` (allow / paused / blocked). Outputs carry
  `executionId` / `approvalId` / `riskLevel` / `reason` for expressions.
- **Governance Approve** — `POST /approvals/:id/decide` (APPROVED returns
  the gated execution to running; REJECTED cancels it).
- **Governance Pending Approvals** — `GET /approvals/pending`, one item per
  waiting approval with its paused tool call.

Credentials carry the sidecar base URL (+ optional bearer token) and test
against `GET /health`. Build: `npm install && npm run build` in `n8n/`.

## dify/ — shipped (zero-code path)

An OpenAPI custom-tool schema (`openapi.yaml`) importable via
Dify → Tools → Custom → Import OpenAPI Schema: five tools (`governance_gate`,
`governance_complete`, `governance_pending`, `governance_decide`,
`governance_audit_list`). See [dify/README.md](dify/README.md).
