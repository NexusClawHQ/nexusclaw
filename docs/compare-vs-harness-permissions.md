# agent-governance vs harness-native permissions (Claude Code / OpenClaw)

> Coding harnesses ship their own permission models — Claude Code's
> allowlist/ask flow, OpenClaw's multi-agent permission configuration,
> deepseek-harness's permissions plugin slot. This page draws the line
> between seat-local permission UX and organization-level governance.

| Dimension | Harness-native permissions | agent-governance gate (this repo) |
|---|---|---|
| Audience | The human driving one interactive session | The organization running many agents — scheduled, headless, multi-agent, customer-facing |
| Where grants live | Local config / prompts per seat | Server-side grant lists and risk rules; revocation takes effect on the next call, org-wide |
| Approval UX | Terminal prompt at the seat | Queue → decide with comment → resume: console, HTTP API, n8n node, or MCP elicitation for interactive clients |
| Audit | Session logs on the seat | Immutable chain (execution → steps → tool calls → decisions) with a documented [SOC 2 / EU AI Act / 等保 mapping](compliance-mapping.md) |
| Cross-tool reach | That harness's tools | Every tool the org gates — including the same agent's calls through LangGraph, n8n, Dify or MCP |
| Fit | Solo/small-team interactive coding | Digital employees, automation in production, regulated environments |

## When harness permissions are enough

- The same person who owns the outcomes drives every session, reviews each
  prompt, and there is no audit requirement beyond local history.
- All agent activity happens inside that one harness.

## When the kernel adds value

- Agents run unattended (cron, webhooks, multi-agent pipelines) — nobody is
  watching a terminal prompt when the L3 action fires at 3am.
- Different people operate the agents than own the data they touch; grants
  and approvals must be organizational, reviewable and revocable centrally.
- Compliance needs one audit chain across every agent surface, not per-seat
  session logs.

Harness-native prompts and the gate also compose: an MCP-capable harness
(fronted by this gateway) keeps its local prompt UX for cheap decisions while
L2/L3 escalation lands in the organizational approval queue with a full audit
record — see [As an MCP gateway](../README.md#as-an-mcp-gateway).
