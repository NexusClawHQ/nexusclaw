# Changelog

The public shipping log of the NexusClaw Community edition. Every entry below
is a sealed, deterministic snapshot exported from the private source-of-truth
repository: each snapshot commit carries the source commit and provenance seal,
and every "verified in this tree" claim below was executed against the
published tree, not a private build.

Cadence so far: first snapshot **2026-08-15**, then **four snapshots in a
single day** on **2026-08-17**. Watch this file (or the tag feed) for the next
drop — the snapshot pipeline is routine, not an event.

| Tag | Date | One-liner |
|---|---|---|
| [Unreleased] | 2026-08-17 | Direct community-repo commits (not a sealed snapshot): license fix, audit zero, CI, Governance Dashboard, publish prep |
| [v0.5.0-community] | 2026-08-17 | Framework adapters: n8n nodes, Dify schema, PyPI-ready Python package |
| [v0.4.0-community] | 2026-08-17 | Governance gate API + zero-dependency Python client |
| [v0.3.0-community] | 2026-08-17 | The governance core lands as an Apache-2.0 library |
| [v0.2.0-community] | 2026-08-17 | Browser closed loop: the `/console` governance mini-console |
| [v0.1.0-community] | 2026-08-15 | First public snapshot: the governed runtime slice |

## [Unreleased] — direct community-repo commits, 2026-08-17

Unlike the sealed snapshots below, these changes were committed directly in
the public repository (branch `community/fixes-dashboard`); every claim was
verified against this tree.

### Fixed

- `GET /source` disclosed `licenseUrl: …gnu.org/licenses/agpl-3.0.html` while
  the repository and every manifest are Apache-2.0 — the URL now points at
  the Apache-2.0 license text. Remaining AGPL mentions in the tree are
  historical notes (relicensing record, licensing FAQ) and stay.

### Security

- `npm audit` went from 6 findings (2 high / 4 moderate) to **0**: `ws`
  8.21.3 via `@nestjs/graphql` 13.4.5, `@apollo/server` 5.5.1 (already the
  declared range — the lockfile had drifted to 4.13.0), `uuid` 11.1.1. No
  downgrades; the new root `.npmrc` documents the `legacy-peer-deps` setup
  the lockfile had always required (the graphql-playground plugin pinned by
  `@nestjs/apollo` 13.x peers `@apollo/server ^4` only).

### Added

- **CI** (`.github/workflows/ci.yml`): Node 22 — root `npm ci + build`,
  `npm audit --audit-level=high` gate, governance `pnpm verify` against a
  Postgres service container; README badge.
- **Governance Dashboard** (`packages/dashboard`, React + Vite,
  Apache-2.0): execution timeline, approval queue, tool-call records and the
  outbox event stream over the public community GraphQL surface; en/zh UI.
  `npm run dev:dashboard`. README gains a 30-second closed-loop GIF.
- **Publish preparation** for the `@agent-governance/*` kernel:
  `publishConfig.access: public`, repository/homepage/bugs, per-package
  READMEs, changesets (fixed group, first-release changeset pending) and a
  `governance/RELEASE.md` runbook; the Python client's distribution name is
  corrected to `agentgovernance` (`agent-governance` is taken on PyPI).
- **Regression defenses**: the backend's first unit-test suite locks the
  `/source` disclosure fix and URL validation; `npm run check:i18n` gates
  en/zh locale parity; the dashboard gains unit tests for the GraphQL
  client (401/error paths), i18n interpolation and formatters. All run in
  CI.

## [v0.5.0-community] — 2026-08-17

**The gate API grows framework adapters — govern n8n workflows and Dify agents
out of the box.**

### Added

- **n8n nodes** (`governance/adapters/n8n`, package
  `n8n-nodes-nexusclaw-governance`): Governance Gate / Approve / Pending
  Approvals nodes over the gate API, plus sidecar credentials with a health
  test. Typecheck + build verified in this tree.
- **Dify integration** (`governance/adapters/dify`): an importable OpenAPI
  custom-tool schema (gate / complete / pending / decide / audit) with an
  import guide — no custom plugin code needed on the Dify side.
- **PyPI-ready Python package**: `governance/adapters/python` builds an
  sdist + wheel, install-verified in a clean venv.

### Verified in this tree

`pnpm verify` in `governance/` and the Python test suites (offline + live
integration) run green in the published tree.

### Provenance

Source `5b68ee45` · seal `nexusclaw-community-c212d59100a89a294687` · tree
sha256 `c212d591` · tarball sha256 `c3ae9090` · export manifest 269 entries ·
five-role owner approvals in core rc-5b68ee45.

## [v0.4.0-community] — 2026-08-17

**Gate any agent framework's tool calls through the same audit chain.**

### Added

- **Governance gate API** (sidecar): `POST /gate` asks whether a tool may run —
  server-side grants (deny by default), L0–L4 guardrails, L2/L3 approval
  pause — and `POST /gate/:executionId/complete` reports the local execution
  outcome. LangGraph / CrewAI / n8n / Dify callers keep executing tools in
  their own runtime; every gate decision still lands on the shared audit chain
  (execution → tool call → outbox event).
- **Python client** (`governance/adapters/python`): the zero-dependency
  `agent-governance` package — `wrap_tool`, interrupt-style `run_approved`,
  blocking `wait=True`, approval decisions and audit queries. 8 offline unit
  tests + a live integration test against the sidecar.

### Verified in this tree

`pnpm verify` in `governance/` runs green: 9 workspace packages build, 58
tests pass, and the sidecar HTTP loop walks both closed loops — the governed
executor scenario (STEP0–5) and the gate loop (STEP6–8: allow + complete,
L3 pause → approve → complete, deny-by-default blocked). Reproduce it in
about a minute: [examples/governance-closed-loop.md](examples/governance-closed-loop.md).

### Provenance

Source `964408d5` · seal `nexusclaw-community-a7100cba423f3235715e` · tree
sha256 `a7100cba` · tarball sha256 `e5e3ae9e` · five-role owner approvals in
core rc-964408d5. Documented follow-ups: an n8n governance node and a Dify
plugin over the same gate API.

## [v0.3.0-community] — 2026-08-17

**The governance core joins the snapshot — governance for AI agents, as a
library.**

### Added

- `governance/`: the framework-neutral governance kernel as Apache-2.0 npm
  workspace packages — `contracts` (dependency-free ports & wire contracts),
  `governor`, `outbox`, `audit-chain`, `permission`, `guardrail`, `approval`,
  `executor` (the governed ReAct loop) and `sidecar` (HTTP surface + mini
  console). 93 files including tests; per-package test counts in
  [governance/README.md](governance/README.md).
- `pnpm install && pnpm verify` in `governance/` runs the full closed loop
  in the published tree: build + tests + the sidecar HTTP governance loop
  (execute → L3 pause → approve → resume → audit chain).

### Changed

- Ahead of this snapshot the repository was relicensed from AGPL-3.0-only to
  **Apache-2.0**; workspace packages carry Apache-2.0 license metadata and
  refreshed source-disclosure comments.

### Provenance

Source `845300e7` · seal `nexusclaw-community-3a3d8f702e7c56f266c6` · export
manifest 247 entries · supply chain 418 components / 0 unresolved.

## [v0.2.0-community] — 2026-08-17

**The governance closed loop, in a browser.**

### Added

- `/console` mini governance console (run / approvals / audit-chain views) over
  a new guarded GraphQL surface: `communityAgents`, `communityAgentExecutions`,
  `communityPendingApprovals`, `communityExecutionEvents`,
  `communityDecideApproval`.
- Deterministic three-phase demo scenario: an L1 customer lookup proceeds and
  is audited; an L3 follow-up email pauses for approval; approving it resumes
  the execution to completion. Idempotent demo seed (the `demo` account
  documented in the README); no external LLM credential required.
- The resume path mirrors the production worker branch (state machine
  `guardrail_pending → running` with a one-shot grant; the reject path cancels
  with an outbox event).

### Provenance

Source `9c10c229` · seal `nexusclaw-community-2607726cae9bfee07bfe` · export
manifest 154 entries · five-role owner approvals in core rc-9c10c229.

## [v0.1.0-community] — 2026-08-15

**First public snapshot: the safety-critical runtime slice.**

### Added

- Workspace & member authentication.
- Governed agent execution with deny-by-default autonomy.
- The execution audit chain: execution records → reasoning steps → tool calls
  → outbox events.
- Source transparency: `GET /source` corresponding-source disclosure on every
  instance; SBOM (`sbom.cdx.json`), third-party notices and the corresponding
  source record ship in-tree.
- Single-host Docker Compose deployment; recorded full-stack readiness
  measurement of 35 seconds (2026-08-15, single-machine Docker).

### Provenance

Candidate `b493009c` · candidate tree
sha256 `b493009c3eb5af63463b9c166dd17e60c99489771fc9b593cc543358315cc5d5`.

---

Snapshot model and contribution policy: [CONTRIBUTING.md](CONTRIBUTING.md).
License: Apache-2.0 — [LICENSE](LICENSE), [NOTICE](NOTICE).

[v0.5.0-community]: https://github.com/NexusClawHQ/nexusclaw/releases/tag/v0.5.0-community
[v0.4.0-community]: https://github.com/NexusClawHQ/nexusclaw/releases/tag/v0.4.0-community
[v0.3.0-community]: https://github.com/NexusClawHQ/nexusclaw/releases/tag/v0.3.0-community
[v0.2.0-community]: https://github.com/NexusClawHQ/nexusclaw/releases/tag/v0.2.0-community
[v0.1.0-community]: https://github.com/NexusClawHQ/nexusclaw/releases/tag/v0.1.0-community
