/**
 * Curated Scenario Exemplar — runtime retrieval port contract
 * (curated-scenario-exemplar-retrieval-v1 spec, Path D Phase 2).
 *
 * Mirror of {@link VerifiedExemplarPort} but keyed on `scenarioCode` + role +
 * org-subtree + double-review (no lineage axis). Curated exemplars are
 * admin-authored knowledge assets stored as `knowledge_chunks` rows with
 * `source_type='curated_scenario_exemplar'`; runtime retrieval is
 * private-edition only — the community adapter returns `unavailable`.
 *
 * Phase 2 owns this contract + the retrieval service + adapters. Phase 3
 * (context-builder wiring) consumes the port via `@Inject`. Keeping the
 * projection lineage-free (scenario/role instead of release/execution ids)
 * keeps provenance distinct from the auto verified-exemplar path.
 */

export const CURATED_SCENARIO_EXEMPLAR_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/curated-scenario-exemplar-port',
);

export type CuratedScenarioExemplarLabel = 'positive' | 'negative';

/**
 * A single curated exemplar selected for runtime injection. Shaped for uniform
 * (untrusted, fenced) rendering alongside — but separate from — auto
 * verified-exemplars. `rankScore` mirrors the vector similarity (0..1).
 */
export interface CuratedScenarioExemplarV1 {
  exemplarId: string;
  content: string;
  label: CuratedScenarioExemplarLabel;
  scenarioCode: string;
  roleCodes: string[];
  rankScore: number;
  rankReason: string;
  tokenCount: number;
  digest: string;
}

export interface CuratedScenarioExemplarDecisionV1 {
  exemplarId: string;
  selected: boolean;
  reasonCode: string;
  rankScore: number;
}

/**
 * Auditable per-decision entry persisted alongside the context manifest
 * `digest` is the injected exemplar's content digest for SELECTED
 * entries and null for rejected candidates (the rejected candidate's body is
 * never exposed; the exemplar id + reason code is the audit trail).
 */
export interface CuratedScenarioExemplarDecisionAuditEntryV1 {
  exemplarId: string;
  digest: string | null;
  selected: boolean;
  reasonCode: string;
  rankScore: number;
}

/**
 * Execution-level audit record of the curated-exemplar retrieval pass
 * The retrieval already produced per-candidate decisions
 * (`role_not_allowed`, `scenario_mismatch`, `review_not_approved`, ...), but
 * they previously lived only on the in-memory cognitive context and were never
 * persisted — clients could only see "selected/rejected reasons recorded" plus
 * a digest. This record is frozen onto every context-manifest row so the
 * acceptance events and scope judgments (role gate per candidate; the
 * org-subtree scope actually applied to the RAG-Sec search) are readable per
 * execution id through the read-only cognition projection. Content bodies are
 * NOT included — only ids, digests, reason codes and scope context.
 */
export interface CuratedExemplarDecisionAuditV1 {
  schemaVersion: 'curated-exemplar-decision-audit/v1';
  scenarioCode: string;
  status: 'available' | 'unavailable';
  reasonCode: string | null;
  principalRoleId: string;
  /**
   * The role CODES (role apiName) the gate actually accepted, in
   * addition to the principalRoleId UUID. Optional because pre-fix audit rows
   * did not record it. Lets acceptance evidence show exactly which principal
   * identifiers were compared against each candidate's roleCodes.
   */
  principalRoleCodes?: string[];
  principalOrgSubtreeIds: string[];
  candidateSetDigest: string;
  decidedAt: string;
  decisions: CuratedScenarioExemplarDecisionAuditEntryV1[];
}

/**
 * Retrieval request. `scenarioCode` is the primary key (defensively enforced
 * in-memory on top of the vector pre-filter). Role/org are enforced by
 * RAG-Sec (org-subtree via `access_level='org_subtree'`) + the new role-scoping
 * gate; the principal role is the agent's own role (independent employee) or
 * the authorizing human's role (assistant) — consistent with the Agent Identity
 * rule.
 */
export interface CuratedScenarioExemplarRequestV1 {
  workspaceId: string;
  agentId: string;
  principalRoleId: string;
  principalOrgSubtreeIds: ReadonlyArray<string>;
  readableObjectApiNames: ReadonlyArray<string>;
  query: string;
  scenarioCode: string;
  taskType?: string;
  limit?: number;
  tokenBudget?: number;
  now?: Date;
}

export interface CuratedScenarioExemplarProjectionV1 {
  selected: CuratedScenarioExemplarV1[];
  decisions: CuratedScenarioExemplarDecisionV1[];
  /**
   * Resolved principal role identifiers (role apiName) the role gate
   * applied alongside the UUID. Optional for backward compatibility with
   * projections that predate the fix (community unavailable adapter).
   */
  principalRoleCodes?: string[];
  candidateSetDigest: string;
}

export type CuratedScenarioExemplarPortResultV1 =
  | ({ status: 'available' } & CuratedScenarioExemplarProjectionV1)
  | ({
      status: 'unavailable';
      reasonCode: 'CAPABILITY_UNAVAILABLE_IN_COMMUNITY';
    } & CuratedScenarioExemplarProjectionV1);

export interface CuratedScenarioExemplarPort {
  retrieve(
    input: CuratedScenarioExemplarRequestV1,
  ): Promise<CuratedScenarioExemplarPortResultV1>;
}

export function unavailableCuratedScenarioExemplars(): CuratedScenarioExemplarPortResultV1 {
  return {
    status: 'unavailable',
    reasonCode: 'CAPABILITY_UNAVAILABLE_IN_COMMUNITY',
    selected: [],
    decisions: [],
    candidateSetDigest: '',
  };
}
