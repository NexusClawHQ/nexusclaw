# agent-governance vs Microsoft Agent Governance Toolkit (AGT)

> Comparison discipline: only verifiable facts, each side linked to its
> source. Both projects are Apache/MIT open source and address the same
> class of problem — governing what autonomous agents are allowed to do.
> This page exists to help you pick, not to disparage either side.

| Dimension | [Microsoft AGT](https://github.com/microsoft/agent-governance-toolkit) | [agent-governance](../README.md) (this repo) |
|---|---|---|
| Form | Embedded runtime security middleware (`evaluate_action` in-process) | Framework-neutral **sidecar** + gate API (`POST /gate`) + library packages |
| Primary stack | .NET first (MCP extensions for `IMcpServerBuilder`), Azure App Service / Copilot Studio integration; Python/TypeScript/Rust/Go packages | TypeScript core (9 zero-dependency npm packages), zero-dependency Python client, n8n nodes, Dify schema |
| Emphasis | Zero-trust agent identity (DIDs, Ed25519), sandboxing / privilege rings, response inspection & redaction | **Human approval workflows** (L2/L3 pause → approve/reject → resume), **compliance-oriented audit chain**, data-scope filters, field masking |
| MCP posture | MCP extensions: startup tool scanning, tool-call governance, response governance | MCP **gateway** form: stateless Streamable-HTTP endpoint fronting downstream MCP servers — visibility-as-permission, elicitation-based approvals (see the [MCP gateway section](../README.md#as-an-mcp-gateway)) |
| Audit | Audit trails of agent actions | Execution → reasoning steps → tool calls → outbox events, with an explicit [SOC 2 / EU AI Act / ISO 27001 / 等保 mapping](compliance-mapping.md) |
| Licensing | Open source (Microsoft) | Apache-2.0 |

Sources: AGT — [governing MCP tool calls in .NET](https://devblogs.microsoft.com/dotnet/governing-mcp-tool-calls-in-dotnet-with-the-agent-governance-toolkit/), [AGT repo](https://github.com/microsoft/agent-governance-toolkit). This repo — [sidecar](../governance/packages/sidecar), [compliance mapping](compliance-mapping.md), [MCP gateway](../README.md#as-an-mcp-gateway).

## When to choose AGT

- Your agents are (or will be) built on .NET / Azure App Service / Copilot
  Studio — the one-call `IMcpServerBuilder` integration is native there.
- You need in-process enforcement with sandboxing, privilege rings and
  cryptographic agent identity as first-class requirements.
- You want response-level governance (inspect/redact tool results before the
  model sees them) today.

## When to choose agent-governance

- Your agents span frameworks — LangGraph, CrewAI, n8n, Dify, plain scripts —
  and you want one policy/audit point that none of them owns.
- Human approval is the center of your governance story: queue → approve with
  comment → resume, over a console, HTTP, or MCP elicitation.
- You need an audit chain you can hand to a SOC 2 / EU AI Act / 等保 auditor
  with a documented control mapping.
- You operate automation stacks (n8n / Dify) where governance is weakest.

They are not mutually exclusive: AGT embeds where your agents run; this
kernel fronts what they touch. Some deployments will reasonably use both.
