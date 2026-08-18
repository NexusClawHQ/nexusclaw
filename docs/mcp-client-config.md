# Connecting MCP hosts to the governance gateway

One sidecar, any MCP host. Start the gateway first:

```sh
npx @agent-governance/sidecar          # zero config: embedded Postgres + demo upstream
# real downstreams: SIDECAR_MCP_UPSTREAMS=name|url[|token],… npx @agent-governance/sidecar
```

The gateway endpoint is `http://127.0.0.1:7899/mcp` (stateless Streamable
HTTP). Every host below then gets deny-by-default permissions, L0–L4
guardrails, L2/L3 approvals and the audit chain with **zero host-side code**.

## Claude Code

Verified shape (Claude Code MCP over Streamable HTTP):

```sh
claude mcp add --transport http agent-governance http://127.0.0.1:7899/mcp
```

or in `.mcp.json`:

```json
{
  "mcpServers": {
    "agent-governance": { "type": "http", "url": "http://127.0.0.1:7899/mcp" }
  }
}
```

Tools appear namespaced (`memory__echo`, …). L3 calls trigger Claude Code's
elicitation prompt; approving there completes the call in the same turn.

## OpenClaw

OpenClaw supports external MCP servers in its configuration; the endpoint is
the same Streamable HTTP URL. Consult the current
[OpenClaw docs](https://docs.openclaw.ai/) for the exact config key — the
values are:

```text
name:  agent-governance
url:   http://127.0.0.1:7899/mcp
transport: streamable-http
```

Grant OpenClaw's tool names at the gate via `SIDECAR_GATE_ALLOWED_TOOLS`.

## deepseek-harness (dsh)

dsh's everything-is-a-plugin model integrates more deeply via the
[approval answerer plugin](../governance/adapters/dsh-plugin)
(`dsh plugin add dsh-plugin-governance-gate`): every dsh `approval/request`
is decided by the gate with human approvals in the sidecar console. For
plain MCP usage, point dsh's MCP client plugin at the same URL above — see
the dsh docs for its MCP client configuration.

## After connecting

- approve/reject in the sidecar console at `http://127.0.0.1:7899/console`
- inspect the audit chain via `GET http://127.0.0.1:7899/audit/list`
- export it as OTel traces: [docs/otel-export.md](otel-export.md)
