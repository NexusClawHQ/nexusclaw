# agent-governance — the governance core

Governance for AI agents, as a library. This directory is the framework-
neutral governance core of the codebase (single-repo, single-license:
Apache-2.0); it ships in the community edition via the deterministic export
and is consumable as npm workspace packages.

**Deny by default.** Every agent execution starts with nothing allowed:
no tool, no object, no operation. Access is granted only through an explicit,
auditable policy — and every decision, grant, denial, approval and execution
step is written to an immutable audit chain.

This repository is the open-source (Apache-2.0) extraction of the governance
kernel that runs production digital employees in NexusClaw:

- **Ports & contracts** (`packages/contracts`) — the dependency-free seam:
  execution approval, constitution, autonomy gate, model invocation, budget,
  admission, usage, knowledge context, behavior feedback, and the versioned
  wire contracts (execution context, approval subjects, audit records).
- **Governor** (`packages/governor`, planned) — rate and context limits.
- **Outbox** (`packages/outbox`, planned) — transactional audit event delivery.
- **Guardrail** (`packages/guardrail`, planned) — L0–L4 risk rules.
- **Audit chain** (`packages/audit-chain`, planned) — executions → steps →
  tool calls → outbox events.
- **Approval** (`packages/approval`, planned) — human-in-the-loop pause/resume.
- **Executor** (`packages/executor`, planned) — the governed ReAct loop.
- **Adapters** (`adapters/`, planned) — LangGraph / CrewAI / Dify / n8n
  integration in three lines of code.

## Status

| Package | Status |
|---|---|
| `contracts` | extracted (PR-2) — ports + wire contracts, zero runtime deps |
| `governor` | extracted (PR-3) — framework-neutral AsyncLocalStorage resource limits, property-tested (6/6), zero runtime deps |
| `outbox` | extracted (PR-4) — transactional enqueue with pluggable notify transport (PG NOTIFY default, in-memory for tests), integration-tested against real Postgres (6/6) |
| `audit-chain` | extracted (PR-5) — execution/step/tool-call entities (TypeORM, GraphQL-stripped), tool-call lifecycle state machine with redaction, execution state machine; 9/9 tests |
| `permission` | extracted (PR-6) — deny-by-default tool access (empty allow-list now DENIES), pure allow-list resolution with configurable defaults (empty by default), conservative RAG authorization, data-scope filters, field masking; zero runtime deps; 16/16 tests |
| `guardrail` | extracted (PR-7) — L0–L4 rule matching (AND logic, wildcard conditions), risk assessment (highest risk, priority tie-break), engine with pluggable rule loading (in-memory + TypeORM/Redis) and agent-scoped ruleIds; 10/10 tests |
| `approval` | extracted (PR-9) — human-in-the-loop decision core: agent sensitive-operation approvals (pause/resume/terminate events), multi-step serial processes, timeouts, CAS-first-writer decisions, audit trails; pluggable events/audit/approver-check ports; 9/9 tests |
| `executor` | extracted (PR-11) — the governed ReAct loop assembling all packages: deny-by-default tool gate, L0–L4 guardrails with human approval pause/resume, full audit chain (execution → steps → tool calls → outbox events); deterministic closed-loop scenario runs end-to-end against real Postgres (2/2) |
| `sidecar` | extracted (PR-13) — HTTP surface over the governed executor (POST /executions, GET /approvals/pending, POST /approvals/:id/decide, GET /executions/:id, GET /audit/list) + mini console; `pnpm verify` walks the full closed loop over HTTP against real Postgres |

## License

Apache-2.0 (see the repository root LICENSE).
