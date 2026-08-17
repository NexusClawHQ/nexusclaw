# Dify — import the governance sidecar as a custom tool

Dify supports importing an OpenAPI schema as a custom tool, which maps every
sidecar endpoint to an agent-callable tool — no plugin SDK needed.

## Steps

1. Run the sidecar (from `governance/packages/sidecar`):

   ```sh
   SIDECAR_GATE_ALLOWED_TOOLS="your.tool.a,your.tool.b" \
   SIDECAR_PGDATABASE=nexusclaw_sidecar pnpm exec tsx scripts/dev-server.ts
   ```

2. In Dify: **Tools → Custom → Create Tool → Import OpenAPI Schema**, paste
   [`openapi.yaml`](openapi.yaml) (or point the server URL at your deployment).

3. Your Dify agents can now call:

   | Tool | What it does |
   |---|---|
   | `governance_gate` | gate a tool call — allow / paused (L2/L3) / blocked (deny by default) |
   | `governance_complete` | report the outcome of an executed tool |
   | `governance_pending` | list approvals awaiting a human |
   | `governance_decide` | approve / reject a pending approval |
   | `governance_audit_list` | read the audit chain |

## Notes

- Grants live **server-side** (`SIDECAR_GATE_ALLOWED_TOOLS`): a tool nobody
  granted is blocked before Dify even executes it, and the denial is audited.
- For richer integrations (native plugin with auth and UI), the same
  endpoints map onto the Dify plugin SDK — this schema is the zero-code path.
