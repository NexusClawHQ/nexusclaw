# agent-governance vs LangGraph interrupts

> LangGraph's `interrupt()`/`Command(resume=...)` is an excellent in-graph
> human-in-the-loop primitive — our own [LangGraph recipe](../governance/adapters/python/README.md#langgraph--gate--interrupt--resume)
> composes it with the gate. This page explains when the standalone kernel
> adds value beyond framework-native primitives.

| Dimension | LangGraph interrupts (built-in) | agent-governance gate (this repo) |
|---|---|---|
| Scope | One graph, one framework, one codebase | Any framework / runtime / script — one policy and audit point across all of them |
| Where policy lives | In your graph code (node logic) | Server-side grant list + risk rules — deny by default; callers cannot widen their own permissions |
| Audit | Traces (with a checkpointer / observability integration) | Immutable chain: execution → steps → tool calls → decisions, with approval identity and comments, plus a [compliance mapping](compliance-mapping.md) |
| Approvals | You build the queue, decision storage and resume plumbing yourself | Built-in: pause → pending queue → approve/reject with comment → resume/execute, over console, HTTP, or MCP elicitation |
| Non-Python runtimes | — (LangGraph ecosystem) | TypeScript core, zero-dependency Python client, n8n nodes, Dify schema, MCP gateway |
| Cost | None if you are already all-in on LangGraph | A sidecar to run (Docker or `pnpm`; demo mode is one command) |

## When interrupts alone are enough

- One team, one framework, one deployment shape; the graph code IS the policy
  surface and you are fine with that.
- You already run LangGraph Platform / Studio and its checkpoint-based HITL
  covers your reviewers' workflow.

## When the kernel adds value

- Multiple frameworks or runtimes must share one policy and one audit chain
  (including n8n workflows and MCP clients that have no graph runtime at all).
- Policy must live server-side — callers (agents, plugin authors, external
  teams) must not be able to widen their own permissions.
- Auditors ask "who approved this L3 action, when, with what comment, on
  which execution" across every surface — not per-graph traces.

The two compose: see the
[three-node recipe](../governance/adapters/python/README.md#langgraph--gate--interrupt--resume)
where the gate decides, `interrupt()` asks the human, and the audit chain
records both.
