import { canonicalJsonDigest } from './canonical-hash';
import type {
  ReleaseEvidenceRefKindV1,
  ReleaseEvidenceRefV1,
  WorkforceReleaseEvidencePayloadV1,
} from './release-evidence.types';
import type { Sha256Digest } from './workforce-lock.types';
import type { JsonValue } from './json-value';

export interface WorkforceReleaseEvidenceExpectationV1 {
  sourceWorkspaceId: string;
  executionWorkspaceId: string;
  releaseSetId: string;
  agentApiName: string;
  sourceLockDigest: Sha256Digest;
  releaseItemSetDigest: Sha256Digest;
  materializedItemRefsDigest: Sha256Digest;
  previousReleaseSetId: string | null;
  containsCodeAction: boolean;
  containsFlow: boolean;
  candidateIsolationBindingId: string;
  candidateIsolationSnapshotHash: Sha256Digest;
  requestedExecution: CandidateEvidenceExecutionIdentityV1;
  executedExecution: CandidateEvidenceExecutionIdentityV1;
}

export interface CandidateEvidenceExecutionIdentityV1 {
  sourceLockDigest: Sha256Digest;
  releaseItemSetDigest: Sha256Digest;
  materializedItemRefsDigest: Sha256Digest;
  runtimeProviderId: string;
  runtimeIsolationEvidenceDigest: Sha256Digest | null;
  candidateIsolationBindingId: string;
  candidateIsolationSnapshotHash: Sha256Digest;
  principalDataScopeDigest: Sha256Digest;
  principalObjectPermissionDigest: Sha256Digest;
  principalFieldPermissionDigest: Sha256Digest;
}

export function validateWorkforceReleaseEvidencePayload(
  payload: WorkforceReleaseEvidencePayloadV1,
  expected: WorkforceReleaseEvidenceExpectationV1,
): {
  payloadHash: Sha256Digest;
  rawEvidenceRefs: ReleaseEvidenceRefV1[];
} {
  assertIdentity(payload, expected);
  const refs = normalizeRefs(payload.refs);
  const required = [
    'agent_eval',
    'golden_baseline',
    'permission_negative',
    'governor',
    'mutation_isolation',
    'rollback_rehearsal',
    'audit_lineage',
    ...(expected.containsCodeAction
      ? (['action_test', 'runtime_readiness'] as const)
      : []),
    ...(expected.containsFlow ? (['flow_test'] as const) : []),
    ...(expected.previousReleaseSetId
      ? (['previous_release_baseline'] as const)
      : []),
  ] as ReleaseEvidenceRefKindV1[];
  required.sort();
  const actual = refs.map((ref) => ref.kind).sort();
  if (JSON.stringify(actual) !== JSON.stringify(required)) {
    throw new Error('WORKFORCE_RELEASE_EVIDENCE_KIND_MATRIX_MISMATCH');
  }
  const golden = refs.find((ref) => ref.kind === 'golden_baseline')!;
  if (
    canonicalJsonDigest(golden as unknown as JsonValue) !==
      canonicalJsonDigest(
        payload.baseline.goldenEvalSuiteRef as unknown as JsonValue,
      ) ||
    (expected.previousReleaseSetId === null
      ? payload.baseline.kind !== 'first_release_golden' ||
        payload.baseline.previousReleaseSetId !== null
      : payload.baseline.kind !== 'previous_release_plus_golden' ||
        payload.baseline.previousReleaseSetId !==
          expected.previousReleaseSetId)
  ) {
    throw new Error('WORKFORCE_RELEASE_EVIDENCE_BASELINE_MISMATCH');
  }
  const runtimeRef = refs.find((ref) => ref.kind === 'runtime_readiness');
  if (
    expected.containsCodeAction
      ? !runtimeRef ||
        payload.runtime.required !== true ||
        payload.runtime.runtimeProviderId !==
          'nexusclaw-verified-isolate-v1' ||
        payload.runtime.runtimeIsolationEvidenceId !==
          runtimeRef.evidenceId ||
        payload.runtime.runtimeIsolationEvidenceDigest !== runtimeRef.digest
      : runtimeRef !== undefined ||
        payload.runtime.required !== false ||
        payload.runtime.runtimeProviderId !== null ||
        payload.runtime.runtimeIsolationEvidenceId !== null ||
        payload.runtime.runtimeIsolationEvidenceDigest !== null
  ) {
    throw new Error('WORKFORCE_RELEASE_EVIDENCE_RUNTIME_MISMATCH');
  }
  const requestedDigest = canonicalJsonDigest(
    expected.requestedExecution as unknown as JsonValue,
  );
  const executedDigest = canonicalJsonDigest(
    expected.executedExecution as unknown as JsonValue,
  );
  if (
    payload.requestedExecutedParity.requestedDigest !== requestedDigest ||
    payload.requestedExecutedParity.executedDigest !== executedDigest ||
    requestedDigest !== executedDigest ||
    payload.requestedExecutedParity.passed !== true ||
    payload.simulationPassRate !== 1 ||
    payload.productionMutationCount !== 0
  ) {
    throw new Error('WORKFORCE_RELEASE_EVIDENCE_EXECUTION_MISMATCH');
  }
  const monitoring = payload.successMonitoring;
  if (
    !monitoring?.agentVersionId.trim() ||
    !/^sha256:[a-f0-9]{64}$/.test(monitoring.cognitivePolicyDigest) ||
    !/^sha256:[a-f0-9]{64}$/.test(monitoring.modelPolicyDigest) ||
    monitoring.minimumSampleSize < 1 ||
    !Number.isSafeInteger(monitoring.minimumSampleSize) ||
    monitoring.metricCodes.length === 0 ||
    new Set(monitoring.metricCodes).size !== monitoring.metricCodes.length ||
    monitoring.metricCodes.some((code, index) => !code.trim() || code !== [...monitoring.metricCodes].sort()[index]) ||
    monitoring.observationWindows.length === 0 ||
    monitoring.insufficientEvidenceBehavior !== 'insufficient_evidence_only' ||
    monitoring.thresholdBreachBehavior !== 'rollback_recommendation_requires_approval' ||
    monitoring.baselineKind !== payload.baseline.kind
  ) {
    throw new Error('WORKFORCE_RELEASE_SUCCESS_MONITORING_INVALID');
  }
  if (
    payload.gateDecision === 'eligible'
      ? payload.rejectionCodes.length !== 0
      : payload.rejectionCodes.length === 0
  ) {
    throw new Error('WORKFORCE_RELEASE_EVIDENCE_DECISION_MISMATCH');
  }
  const rejectionCodes = [...payload.rejectionCodes].sort();
  if (
    new Set(rejectionCodes).size !== rejectionCodes.length ||
    rejectionCodes.some((code) => !code.trim()) ||
    rejectionCodes.some((code, index) => code !== payload.rejectionCodes[index])
  ) {
    throw new Error('WORKFORCE_RELEASE_EVIDENCE_REJECTION_CODES_INVALID');
  }
  return {
    payloadHash: canonicalJsonDigest(payload as unknown as JsonValue),
    rawEvidenceRefs: refs,
  };
}

function assertIdentity(
  payload: WorkforceReleaseEvidencePayloadV1,
  expected: WorkforceReleaseEvidenceExpectationV1,
): void {
  if (
    payload.schemaVersion !== 'ai-workforce-release-evidence/v1' ||
    payload.sourceWorkspaceId !== expected.sourceWorkspaceId ||
    payload.executionWorkspaceId !== expected.executionWorkspaceId ||
    payload.sourceWorkspaceId === payload.executionWorkspaceId ||
    payload.releaseSetId !== expected.releaseSetId ||
    payload.agentApiName !== expected.agentApiName ||
    payload.sourceLockDigest !== expected.sourceLockDigest ||
    payload.releaseItemSetDigest !== expected.releaseItemSetDigest ||
    payload.materializedItemRefsDigest !==
      expected.materializedItemRefsDigest ||
    payload.candidateIsolationBindingId !==
      expected.candidateIsolationBindingId ||
    payload.candidateIsolationSnapshotHash !==
      expected.candidateIsolationSnapshotHash ||
    payload.approval.decision !== 'APPROVED' ||
    !payload.approval.approvalId.trim() ||
    !Number.isSafeInteger(payload.approval.decisionVersion) ||
    payload.approval.decisionVersion < 1
  ) {
    throw new Error('WORKFORCE_RELEASE_EVIDENCE_IDENTITY_MISMATCH');
  }
}

function normalizeRefs(
  values: ReadonlyArray<ReleaseEvidenceRefV1>,
): ReleaseEvidenceRefV1[] {
  const refs = values.map((value) => ({ ...value }));
  refs.sort((left, right) =>
    `${left.kind}\0${left.evidenceId}\0${left.digest}`.localeCompare(
      `${right.kind}\0${right.evidenceId}\0${right.digest}`,
    ),
  );
  if (
    refs.some(
      (ref, index) =>
        !ref.evidenceId.trim() ||
        !ref.producer.trim() ||
        !/^sha256:[0-9a-f]{64}$/.test(ref.digest) ||
        !Number.isFinite(Date.parse(ref.createdAt)) ||
        canonicalJsonDigest(ref as unknown as JsonValue) !==
          canonicalJsonDigest(values[index] as unknown as JsonValue),
    ) ||
    new Set(refs.map((ref) => ref.kind)).size !== refs.length ||
    new Set(refs.map((ref) => `${ref.evidenceId}:${ref.digest}`)).size !==
      refs.length
  ) {
    throw new Error('WORKFORCE_RELEASE_EVIDENCE_REFS_INVALID');
  }
  return refs;
}
