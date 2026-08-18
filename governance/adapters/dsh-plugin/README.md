# dsh-plugin-governance-gate

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh)
**approval answerer** backed by the
[agent-governance](https://github.com/NexusClawHQ/nexusclaw-agent-governance)
sidecar: every dsh `approval/request` is decided by the deny-by-default gate,
L0–L4 risk rules and the organizational audit chain — with human approvals
happening in the sidecar console instead of (or in addition to) dsh's own UI.

## Spike conclusions (spec mcp-governance-gateway, Phase I1)

Verified against the dsh source and docs on 2026-08-18:

- dsh's user-approval seam exposes a **waterfall answerer event** —
  `'approval/request'(req, next)` where a listener claims the request by
  returning an `ApprovalOutcome` (`'allowed-once' | 'rejected' | 'cancelled' |
  'unavailable'`) or delegates via `next()`; the chain is **fail-closed**
  (missing/throwing answerers resolve `'unavailable'`, callers deny).
  Source: `packages/interaction/user-approval/src/index.ts` in the dsh repo.
- Plugins ship as npm packages with a `dsh.bundle` manifest
  (`dsh: { bundle: { patch: "./cordis.patch.yml" } }`), an ESM entry exporting
  `name` + `apply(ctx)`, installed via `dsh plugin add`.
  Source: `docs/user/develop/basic/publish.md`.
- **Semantic alignment is exact**: our gate's `allow / blocked / paused` maps
  1:1 onto `allowed-once / rejected / wait-for-human`. No degradation to a
  docs-only recipe was needed.

Known v1 limitation (by dsh design): `ApprovalRequest` deliberately omits
tool arguments (they are linked via `callId`), so input-matching risk rules
see only the call reference, not the rendered arguments.

## Install (into a dsh profile)

```sh
# 1. run the governance sidecar (one command, zero config):
npx @agent-governance/sidecar          # or the single-container Docker image
# 2. add the answerer to your dsh profile:
dsh plugin add dsh-plugin-governance-gate
# 3. point it at the sidecar (default http://127.0.0.1:7899):
export GOVERNANCE_SIDECAR_URL=http://127.0.0.1:7899
```

Grant the dsh tool names at the gate (deny by default), e.g.:

```sh
SIDECAR_GATE_ALLOWED_TOOLS="bash,read,write" npx @agent-governance/sidecar
```

## Behavior

| Gate verdict | dsh outcome |
|---|---|
| `allow` | `allowed-once` — dsh executes the tool locally |
| `blocked` | `rejected` — the denial lands on the audit chain |
| `paused` (L2/L3) | waits for the human in the **sidecar console**; approved → `allowed-once`, rejected → `rejected` |
| sidecar unreachable / wait timeout | `next()` — dsh's own answerers stay in charge (still fail-closed); set `GOVERNANCE_FAIL_CLOSED=1` to hard-reject instead |

Env knobs: `GOVERNANCE_SIDECAR_URL`, `GOVERNANCE_POLL_MS` (default 1000),
`GOVERNANCE_TIMEOUT_MS` (default 600000), `GOVERNANCE_FAIL_CLOSED`.

Apache-2.0. Parent project: [agent-governance](https://github.com/NexusClawHQ/nexusclaw-agent-governance).
