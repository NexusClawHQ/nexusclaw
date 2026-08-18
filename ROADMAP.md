# Roadmap

> Direction, not promises. This page says where this repository is heading
> next and what deliberately stays out of it. It is updated with the
> snapshots — the [CHANGELOG](CHANGELOG.md) records what actually shipped.
> Dates are omitted on purpose: cadence is fast, and a date miss would be a
> worse signal than no date.

## Where this is going

This repository is the governance kernel NexusClaw runs its digital employees
on, open-sourced as a **library any agent framework can adopt**: deny-by-default
permissions, L0–L4 guardrails, human approvals, and an immutable audit chain —
first as a runnable slice, and increasingly as a framework-neutral library
that works with LangGraph, CrewAI, n8n, Dify or a plain script. The platform
around the kernel stays commercial at [nexusclaw.cn](https://nexusclaw.cn).

## Shipped (v0.5.0)

| Capability | Since |
|---|---|
| Governed runtime slice: auth → executor → governed tools → audit chain | v0.1.0 |
| `/console` browser closed loop (L1 proceeds, L3 pauses for approval, resume, audit views) | v0.2.0 |
| The governance core as Apache-2.0 npm workspace packages (9 packages, 58 tests, `pnpm verify`) | v0.3.0 |
| Governance gate API (`POST /gate`) + zero-dependency Python client (`wrap_tool`, `run_approved`) | v0.4.0 |
| n8n nodes (Gate / Approve / Pending), Dify OpenAPI schema, PyPI-ready Python package | v0.5.0 |

Direct community commits on 2026-08-17 (not a sealed snapshot): CI (Node 22 —
build + tests + sidecar e2e + audit gate), the Governance Dashboard
(`packages/dashboard`), publish-ready kernel manifests with changesets, the
`/source` license-URL fix and a zero-finding `npm audit`.

**2026-08-18: the nine `@agent-governance/*` kernel packages are live on npm
at 0.1.0** — `npm install @agent-governance/contracts` and friends now work
directly; the "three lines to governed tools" adoption path is installable.

**Same day: the Python client is live on PyPI as
[`nexusclaw-agent-governance` 0.1.0](https://pypi.org/project/nexusclaw-agent-governance/)** —
`pip install nexusclaw-agent-governance` (import name stays `agent_governance`).
The plain `agent-governance` name is taken, and the compressed
`agentgovernance` variant is rejected by PyPI's project-name similarity
guard, hence the branded distribution name.

**Also 2026-08-18 (direct community commits, branch `community-showcase-and-byo`):
the reference frontends landed.** The Governance Dashboard is served at `/app` —
digital employees with a configuration view, training & growth timelines derived
from approval decisions, replay-compare, governance policy. `/console` was
rebuilt on the same unified design-token table (guard-tested) as a
zero-dependency demo, and a BYO real-model path (`COMMUNITY_LLM_*`) lets
evaluators watch a real LLM run under identical governance gates. Design
records and the frozen mockup live under `.kiro/specs/`.

**Also 2026-08-18: the LangGraph / CrewAI recipes shipped** in
[`governance/adapters/python/README.md`](governance/adapters/python/README.md):
complete copy-paste compositions — a gate-check / interrupt / execute node
split for LangGraph (so `interrupt()` re-execution never double-fires the
gate), and `wait=True` governed tools for CrewAI — plus the framework-free
core pattern. All snippets are syntax-checked.

## Building next

On top of the v0.5.0 adapter base:

- **Adoption ergonomics** — making "three lines to governed tools" true for
  more runtimes and languages.
- **Deeper n8n / Dify coverage** — richer node parameters and schema surface
  as adoption feedback arrives. The n8n nodes are published on npm
  (`n8n-nodes-nexusclaw-governance`): installable by name in n8n →
  Settings → Community Nodes.

## Exploring (later, in this repo's scope)

- Headless/embedded use of the governance library beyond the demo scenario
  (custom tools, custom rule stores, real model invocation behind the same
  contracts).
- richer audit-chain querying over the sidecar HTTP surface.
- examples for more deployment shapes of the reference slice.

## Deliberately out of this repository

These stay in the commercial platform — their absence must never make
permission or audit behavior fail open ([docs/architecture.md](docs/architecture.md)):

- visual builder and packaging/template marketplace
- commercial learning loop, model routing, billing & metering
- enterprise identity, encryption and enterprise modules

Commercial licensing is covered in [docs/licensing-faq.md](docs/licensing-faq.md).

## How to influence the order

Open a [GitHub issue](https://github.com/NexusClawHQ/nexusclaw-agent-governance/issues) with
the use case you need first — concrete adoption blockers carry the most
weight. See [CONTRIBUTING.md](CONTRIBUTING.md) for the proposal model;
security reports follow [SECURITY.md](SECURITY.md).
