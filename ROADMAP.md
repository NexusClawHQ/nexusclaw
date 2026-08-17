# Roadmap

> Direction, not promises. This page says where the Community edition is
> heading next and what deliberately stays out of it. It is updated with the
> snapshots — the [CHANGELOG](CHANGELOG.md) records what actually shipped.
> Dates are omitted on purpose: cadence is fast, and a date miss would be a
> worse signal than no date.

## Where this is going

The full NexusClaw platform is an AI-native CRM where digital employees
execute real business tasks inside governed boundaries. The Community edition
carries the part that must be trustworthy for that vision to work at all:
**the governance kernel** — deny-by-default permissions, L0–L4 guardrails,
human approvals, and an immutable audit chain — first as a runnable slice,
and increasingly as a **library any agent framework can adopt**.

## Shipped (Community v0.5.0)

| Capability | Since |
|---|---|
| Governed runtime slice: auth → executor → governed tools → audit chain | v0.1.0 |
| `/console` browser closed loop (L1 proceeds, L3 pauses for approval, resume, audit views) | v0.2.0 |
| The governance core as Apache-2.0 npm workspace packages (9 packages, 58 tests, `pnpm verify`) | v0.3.0 |
| Governance gate API (`POST /gate`) + zero-dependency Python client (`wrap_tool`, `run_approved`) | v0.4.0 |
| n8n nodes (Gate / Approve / Pending), Dify OpenAPI schema, PyPI-ready Python package | v0.5.0 |

## Building next

On top of the v0.5.0 adapter base:

- **PyPI publication** of the `agent-governance` Python client, so `pip
  install agent-governance` works without a local build.
- **LangGraph / CrewAI recipes** — copy-paste interrupt patterns on top of
  the Python client (`GovernancePendingApproval` → framework interrupt →
  `gov.decide` → `run_approved`).
- **Adoption ergonomics** — making "three lines to governed tools" true for
  more runtimes and languages.
- **Deeper n8n / Dify coverage** — richer node parameters and schema surface
  as adoption feedback arrives.

## Exploring (later, in this repo's scope)

- Headless/embedded use of the governance library beyond the demo scenario
  (custom tools, custom rule stores, real model invocation behind the same
  contracts).
- richer audit-chain querying over the sidecar HTTP surface.
- examples for more deployment shapes of the Community runtime.

## Deliberately out of the Community edition

These stay in the commercial platform — their absence must never make
permission or audit behavior fail open ([docs/architecture.md](docs/architecture.md)):

- visual builder and packaging/template marketplace
- commercial learning loop, model routing, billing & metering
- enterprise identity, encryption and enterprise modules

Commercial licensing is covered in [docs/licensing-faq.md](docs/licensing-faq.md).

## How to influence the order

Open a [GitHub issue](https://github.com/NexusClawHQ/nexusclaw/issues) with
the use case you need first — concrete adoption blockers carry the most
weight. See [CONTRIBUTING.md](CONTRIBUTING.md) for the proposal model;
security reports follow [SECURITY.md](SECURITY.md).
