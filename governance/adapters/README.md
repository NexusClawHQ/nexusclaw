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

## n8n/ — next

A community node (`nexusclaw-governance-node`) with a single **Governance
Gate** node: call `POST /gate`, branch `allow` / `paused` / `blocked`; pair
with the **Approve Decision** node for `POST /approvals/:id/decide`. Any
agent workflow node placed after the gate is governed; the branch outputs
carry `executionId` / `approvalId` for expressions.

## dify/ — next

A Dify tool plugin wrapping the same endpoints: import the client as a
custom tool package (`gate`, `decide`, `audit`), so agent apps built on Dify
route their tool calls through the governance sidecar.
