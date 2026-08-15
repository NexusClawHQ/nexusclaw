/**
 * Release registry, evidence, candidate isolation and lineage contracts.
 *
 * The narrow four-table release truth (`release_sets` / `release_set_items` /
 * `release_evidence` / `release_heads`) is owned by the backend deployment
 * bounded context (design §11.3, §3.5). This file defines the shared contract
 * surface imported by backend runtime modules and the CLI. The release SET only
 * has eligibility `staged|eligible|rejected`; the HEAD row is the sole active
 * truth. Evidence is separate from the source lock.
 */
import type { Sha256Digest } from './workforce-lock.types';
import type { ActionRiskLevel } from './code-action.types';

// ---- Release item kinds (design §11.3, R-12.10) ----------------------------

/**
 * Discriminated asset kinds carried by a release set item. Each kind is
 * self-registered by its owner's sealed revision resolver at module boot; the
 * registry rejects unknown/duplicate kinds. `code_action` requires verified
 * isolate readiness before it may become eligible (design §12.4).
 */
export type WorkforceReleaseItemKindV1 =
  | 'agent'
  | 'code_action'
  | 'flow'
  | 'ai_policy'
  | 'approval_policy'
  | 'knowledge'
  | 'connector_binding'
  | 'prompt_template'
  | 'prompt_policy'
  | 'guardrail'
  | 'sop'
  | 'workflow'
  | 'tool_permission'
  | 'approval_policy_template'
  | 'employee_template';

export type ReleaseSetEligibility = 'staged' | 'eligible' | 'rejected';

/** Exact reference to one immutable owner revision inside a release set item. */
export interface ExactReleaseItemRefV1 {
  readonly sourceWorkspaceId: string;
  readonly itemKind: WorkforceReleaseItemKindV1;
  readonly canonicalKey: string;
  readonly revisionRef: string;
  readonly checksum: Sha256Digest;
  readonly descriptorHash: Sha256Digest | null;
}

// ---- Release evidence & envelope (design §11.3, R-12.4) --------------------

export type ReleaseEvidenceRefKindV1 =
  | 'action_test'
  | 'flow_test'
  | 'agent_eval'
  | 'golden_baseline'
  | 'previous_release_baseline'
  | 'permission_negative'
  | 'runtime_readiness'
  | 'governor'
  | 'mutation_isolation'
  | 'rollback_rehearsal'
  | 'audit_lineage';

export interface ReleaseEvidenceRefV1 {
  readonly kind: ReleaseEvidenceRefKindV1;
  readonly evidenceId: string;
  readonly digest: Sha256Digest;
  readonly producer: string;
  readonly createdAt: string;
}

export interface WorkforceReleaseEvidencePayloadV1 {
  readonly schemaVersion: 'ai-workforce-release-evidence/v1';
  readonly sourceWorkspaceId: string;
  readonly executionWorkspaceId: string;
  readonly releaseSetId: string;
  readonly agentApiName: string;
  readonly gateDecision: 'eligible' | 'rejected';
  readonly approval: {
    readonly approvalId: string;
    readonly decision: 'APPROVED';
    readonly decisionVersion: number;
  };
  readonly rejectionCodes: ReadonlyArray<string>;
  readonly sourceLockDigest: Sha256Digest;
  readonly releaseItemSetDigest: Sha256Digest;
  readonly materializedItemRefsDigest: Sha256Digest;
  readonly baseline:
    | {
        readonly kind: 'first_release_golden';
        readonly previousReleaseSetId: null;
        readonly goldenEvalSuiteRef: ReleaseEvidenceRefV1;
      }
    | {
        readonly kind: 'previous_release_plus_golden';
        readonly previousReleaseSetId: string;
        readonly goldenEvalSuiteRef: ReleaseEvidenceRefV1;
      };
  readonly refs: ReadonlyArray<ReleaseEvidenceRefV1>;
  readonly requestedExecutedParity: {
    readonly passed: boolean;
    readonly requestedDigest: Sha256Digest;
    readonly executedDigest: Sha256Digest;
  };
  readonly simulationPassRate: number;
  readonly productionMutationCount: 0;
  readonly runtime:
    | {
        readonly required: false;
        readonly runtimeProviderId: null;
        readonly runtimeIsolationEvidenceId: null;
        readonly runtimeIsolationEvidenceDigest: null;
      }
    | {
        readonly required: true;
        readonly runtimeProviderId: 'nexusclaw-verified-isolate-v1';
        readonly runtimeIsolationEvidenceId: string;
        readonly runtimeIsolationEvidenceDigest: Sha256Digest;
      };
  readonly candidateIsolationBindingId: string;
  readonly candidateIsolationSnapshotHash: Sha256Digest;
  /**
   * Immutable post-publication success observation contract. This is evidence
   * metadata only; raw runtime logs remain in their existing owners.
   */
  readonly successMonitoring: {
    readonly agentVersionId: string;
    readonly cognitivePolicyDigest: Sha256Digest;
    readonly modelPolicyDigest: Sha256Digest;
    readonly baselineKind: 'previous_release_plus_golden' | 'first_release_golden';
    readonly metricCodes: ReadonlyArray<string>;
    readonly observationWindows: ReadonlyArray<string>;
    readonly minimumSampleSize: number;
    readonly rollbackCriteria: ReadonlyArray<{
      readonly metricCode: string;
      readonly comparator: string;
      readonly threshold: number;
      readonly minimumSampleSize: number;
    }>;
    readonly insufficientEvidenceBehavior: 'insufficient_evidence_only';
    readonly thresholdBreachBehavior: 'rollback_recommendation_requires_approval';
  };
}

/** Sealed aggregate; produced once by an explicit gate, never mutated. */
export interface WorkforceReleaseEnvelopeV1 {
  readonly releaseSetId: string;
  readonly sourceLockDigest: Sha256Digest;
  readonly releaseItemSetDigest: Sha256Digest;
  readonly materializedItemRefsDigest: Sha256Digest;
  readonly evidencePayloadHash: Sha256Digest;
  readonly approvalId: string;
  readonly previousReleaseSetId?: string;
  readonly releaseEnvelopeDigest: Sha256Digest;
}

// ---- Candidate stage receipt (R-16 / §18.2) --------------------------------

/**
 * Typed result of `bundle deploy` (stage). Always returns the three expected
 * digests consumed by candidate test / gate / promote. A resumed agent may
 * recover the same values only through `nexus ai context describe/export
 * --candidate-release-set-id`, never by guessing or reading database ids.
 */
export interface CandidateStageReceiptV1 {
  readonly candidateReleaseSetId: string;
  readonly sourceLockDigest: Sha256Digest;
  readonly releaseItemSetDigest: Sha256Digest;
  readonly materializedItemRefsDigest: Sha256Digest;
  readonly stagedAt: string;
}

// ---- Candidate test suite selectors (R-16) ---------------------------------

/**
 * Direct code/Flow test `--suite <literal>` maps to one same-named nested
 * selector; `all` maps to that selector kind's complete ordered suite list.
 * Bundle `--suite action|flow|employee` strictly selects that asset kind and
 * fails when it is absent. Bundle `--suite all` selects every kind represented
 * by the immutable candidate and mechanically assigns each present kind its
 * complete blocking suite list (design §16.4). No handler/model chooses a
 * default suite, and `all` never requires an unrelated absent asset kind.
 */
export type CodeTestSuiteSelector =
  | 'contract'
  | 'compile'
  | 'sandbox'
  | 'permission'
  | 'unit'
  | 'all';

export type FlowTestSuiteSelector =
  | 'schema'
  | 'mapping'
  | 'action'
  | 'permission'
  | 'fault'
  | 'all';

export type BundleTestSuiteKind = 'action' | 'flow' | 'employee' | 'all';

export interface CandidateTestSuiteSelectorV1 {
  readonly kind: 'code' | 'flow' | 'bundle';
  readonly selector: CodeTestSuiteSelector | FlowTestSuiteSelector | BundleTestSuiteKind;
}

// ---- Candidate isolation binding (design §12.1, R-05, §5.5) ----------------

/**
 * Server-owned authorization generation + exclusive execution-workspace lease.
 * Agent Test alone selects this; the public API/CLI accepts NO isolated
 * workspace selector. The pair `(sourceWorkspaceId, executionWorkspaceId)` is
 * time-bounded and backed by a dedicated-SANDBOX authorization generation.
 */
export interface CandidateIsolationBinding {
  readonly isolationBindingId: string;
  readonly sourceWorkspaceId: string;
  readonly executionWorkspaceId: string;
  readonly workspaceMode: 'isolated-test';
  readonly authorizationGeneration: string;
  readonly leaseId: string;
  readonly leaseExpiresAt: string;
  readonly isolationSnapshotHash: Sha256Digest;
}

/**
 * Input for running isolated candidate tests. NOTE: there is no
 * `executionWorkspaceId` field here — the server selects it via
 * {@link CandidateIsolationBinding}; callers cannot choose it.
 */
export interface CandidateTestRunInputV1 {
  readonly candidateReleaseSetId: string;
  readonly exportId?: string;
  readonly flowApiName?: string;
  readonly expectedSourceLockDigest: Sha256Digest;
  readonly expectedReleaseItemSetDigest: Sha256Digest;
  readonly expectedMaterializedItemRefsDigest: Sha256Digest;
  readonly suite: CandidateTestSuiteSelectorV1;
}

// ---- Execution snapshot (design §5.7, R-09.4, §12.1) -----------------------

/**
 * Server-owned runtime context. Active requires source === execution workspace;
 * candidate difference requires an exact time-bounded
 * {@link CandidateIsolationBinding}. A boolean or arbitrary workspace cannot
 * forge a candidate (R-09.4).
 */
export interface ReleaseExecutionSnapshotV1 {
  readonly schemaVersion: 'nexusclaw.release-execution-snapshot/v1';
  readonly mode: 'active_snapshot' | 'candidate_test';
  readonly sourceWorkspaceId: string;
  readonly executionWorkspaceId: string;
  readonly releaseSetId: string;
  readonly sourceDigest: Sha256Digest;
  readonly itemDigest: Sha256Digest;
  readonly materializedDigest: Sha256Digest;
  readonly envelopeDigest: Sha256Digest | null;
  readonly isolationBinding?: CandidateIsolationBinding;
}

// ---- Lineage envelope (remediation §5.8 / executable R-13) -----------------

/**
 * Minimal lineage consumed by existing audit/outcome/learning owners. Does NOT
 * create a new audit table; existing event/record payloads are enriched with
 * these fields. Missing executable revision makes evidence ineligible for
 * learning release gate.
 */
export interface AgentAssetLineage {
  readonly workspaceId: string;
  readonly executionId: string;
  readonly toolCallId?: string;
  readonly correlationId: string;
  readonly releaseSetId: string;
  readonly agentVersionId: string;
  readonly assetCanonicalKey?: string;
  readonly assetVersion?: string;
  readonly assetChecksum?: Sha256Digest;
  readonly runtimeProvider?: string;
}

// ---- Workforce release gate receipt (R-16 / §18.3) -------------------------

/**
 * Canonical non-secret receipt returned by `approval-request` and
 * `approval-status`, so `gate` is recoverable after local state loss. Contains
 * approval/candidate/evidence ids, all three expected digests, governance
 * digest, decision/version/expiry/consumption and its canonical receipt digest.
 */
export interface WorkforceReleaseGateReceiptV1 {
  readonly schemaVersion: 'nexusclaw.workforce-release-gate-receipt/v1';
  readonly approvalId: string;
  readonly candidateReleaseSetId: string;
  readonly evidenceRunIds: ReadonlyArray<string>;
  readonly expectedSourceLockDigest: Sha256Digest;
  readonly expectedReleaseItemSetDigest: Sha256Digest;
  readonly expectedMaterializedItemRefsDigest: Sha256Digest;
  readonly governanceContextDigest: Sha256Digest;
  readonly decision: 'pending' | 'approved' | 'rejected' | 'expired';
  readonly decisionVersion: 0 | 1;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
  readonly receiptDigest: Sha256Digest;
}

/** Convenience alias — Flow binding risk floor (no L4 in v1). */
export type _FlowBindingRiskLevelAlias = Exclude<ActionRiskLevel, 'L4'>;
