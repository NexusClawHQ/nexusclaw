# Compliance mapping: SOC 2 · EU AI Act · ISO 27001 · 等保 2.0

> This document maps the agent-governance kernel's capabilities to common
> audit and control frameworks. It is a navigation aid for auditors,
> security reviewers and compliance teams — **not legal advice, not a
> certification, and not a compliance guarantee**: certification scope is
> always the whole system and organization, never this component alone.
> Every capability referenced below is verifiable from this repository or a
> running instance.

## The evidence model

The kernel produces one artifact every framework below asks for: a
structured, append-only record of what an automated actor attempted, what
was decided, and why. Per governed execution:

| Record | Content | Where to read it |
|---|---|---|
| Execution | task, status, output summary, model source | `GET /executions/:id` (sidecar) · GraphQL `communityAgentExecution` (reference slice) |
| Reasoning steps | ReAct step index and tool intent per step | same detail record (`reactSteps`) |
| Tool-call records | tool name, `permissionCheck`, `guardrailCheck`, risk level, inputs | same detail record (`toolCallRecords`) |
| Decisions | every grant, denial, L2/L3 pause, human approval/rejection with comment and approver | approval records on the execution detail |
| Outbox events | transactional event stream of the above | PG NOTIFY subscription ([outbox package](../governance/packages/outbox)) |
| Denials | ungranted/blocked calls are recorded too — deny by default | `GET /audit/list` |

Supply-chain evidence ships in-tree: `sbom.cdx.json` (CycloneDX SBOM),
`THIRD_PARTY_NOTICES.md`, `file-licenses.json`, and the running instance's
`GET /source` corresponding-source disclosure.

## SOC 2 (Trust Services Criteria)

| Criterion | Kernel capability | Evidence |
|---|---|---|
| CC6.1 — logical access restricted to authorized users | Deny-by-default permission resolution: no explicit grant → the tool call never executes | permission package (`governance/packages/permission`); blocked calls on the audit chain |
| CC6.3 — access provisioning on least privilege | Per-agent tool allow-lists, `blockedTools` overrides, data-scope filters (`all`/`org_subtree`/`own`/`custom`), field masking | allow-list resolver + data-scope filter sources; masked outputs in tool-call records |
| CC6.6 — boundary protection | The sidecar gate API is a policy enforcement point between the agent and every tool | `POST /gate` in [sidecar](../governance/packages/sidecar); three-line adoption docs |
| CC6.8 — prevent and detect unauthorized access | Attempted-but-denied calls are recorded with reason, not silently dropped | denials in `GET /audit/list` |
| CC7.2 — monitor for anomalies | Governor rate/context limits; L0–L4 guardrail evaluation on every call | governor package; `guardrailCheck` per tool call |
| CC7.3 — evaluate security events | Transactional outbox streams audit events to your SIEM (PG NOTIFY default) | outbox package; event subscription |
| CC8.1 — authorize changes | L2/L3 actions pause until a named human approves or rejects with a comment | approval records (approver + decision + comment) on the execution |
| CC9.2 — mitigate risk from automated processing | Automated actors act only within explicit, revocable grants; revocation takes effect on the next call | permission package semantics |

## EU AI Act (Regulation (EU) 2024/1689)

Obligations phase in over 2025–2027; which provisions apply to you depends on
your role (provider/deployer) and risk classification — verify current
applicability with counsel. Where an agent system falls under the Act's
oversight and logging provisions, the kernel provides the implementing
machinery:

| Provision | How the kernel supports it | Evidence |
|---|---|---|
| Art. 9 — risk management (high-risk) | L0–L4 risk taxonomy enforced per call; risk treatments are technical (block), human (approve/reject) or policy (grant/deny); every risk event is logged | guardrail package; `guardrailCheck` + risk level per tool call |
| Art. 10 — data governance | RAG authorization, data-scope filters and field masking govern which data an agent may retrieve and return | permission package (`rag-authorization`, `data-scope-filter`, `field-masking`) |
| Art. 12 — record-keeping / logging | Automatic, structured logging of events over the system's operation with per-step traceability: execution → reasoning steps → tool calls → decisions | audit-chain package; execution detail records |
| Art. 14 — human oversight | L2/L3 calls halt until a human decision; humans can measure, interpret, override and stop (approve/reject) automated actions | approval package; approval records with approver identity |
| Art. 15 — accuracy, robustness, cybersecurity | Rate/context limits bound runaway behavior; partial configuration refuses to boot rather than silently downgrading (fail-closed) | governor package; boot-time assertion tests |
| Art. 26 — deployer obligations | Art. 26(5) log retention and Art. 26(6) input-governance are served by the audit chain and permission layers respectively | audit-chain + permission packages |
| Art. 27 — fundamental-rights impact assessment | Usage evidence (what agents actually attempted, what was refused) comes from the chain, not self-attestation | `GET /audit/list` exports |

## ISO/IEC 27001:2022 (Annex A)

| Control | Kernel capability |
|---|---|
| A.5.15 / A.5.18 — access control, access rights | Deny-by-default grants, revocable server-side, per-agent scope |
| A.8.2 — privileged access rights | Automated actors hold no implicit privilege; every capability is an explicit grant |
| A.8.15 — logging | Append-only audit chain covering executions, steps, tool calls, decisions |
| A.8.16 — monitoring activities | Outbox event stream for centralized monitoring |

## 等保 2.0（GB/T 22239-2019，三级方向）

| 要求方向 | 内核对应 |
|---|---|
| 安全审计：对重要用户行为和重要安全事件进行审计 | 每次执行的授权/拒绝/暂停/审批全量落链，含被拒绝的尝试 |
| 访问控制：最小权限 | 默认拒绝 + 按代理授权 + 数据范围过滤 + 字段脱敏 |
| 入侵防范：限制异常行为 | 治理器的速率与上下文限额、L0–L4 风险规则即时熔断 |

## What this kernel does not provide

Honest boundaries — an auditor will ask, so they are stated up front:

- **No external tamper-evidence.** The chain is append-only by design within
  the operator's database; a WORM sink, external timestamping or notarization
  must be added by the operator (the outbox is the intended export seam).
- **Retention lifecycle is the operator's.** How long audit records live, and
  their deletion at end of retention, is deployment policy, not kernel
  behavior.
- **No SIEM connectors ship in-tree.** The outbox (PG NOTIFY default) is the
  integration point; connectors are deliberately out of scope today.
- **Framework fit is directional.** This document maps capabilities to
  control areas; passing an audit additionally requires organizational
  controls (policy, personnel, physical, vendor management) this kernel
  does not touch.

## Verify it yourself

```sh
# kernel test suites (162 tests tree-wide, 58 in-kernel)
npx vitest run            # repository root
pnpm verify               # governance/ workspace

# evidence surfaces on a running instance (reference slice or sidecar)
curl -s http://localhost:3000/source          # license + corresponding source
curl -s http://127.0.0.1:7899/audit/list      # recent executions (sidecar)
curl -s http://127.0.0.1:7899/executions/<id> # full audit-chain detail
```

The dashboard at `/app` renders the same records (execution timeline,
approval queue, tool-call records, outbox stream) for human review.
