/**
 * Execution-snapshot contracts consumed by the Community runtime.
 *
 * Community subset of the release-evidence contracts: the candidate isolation
 * binding and the release execution snapshot that the governed agent runtime
 * records on every execution. The enterprise release registry, evidence
 * aggregate and gate-receipt contracts are NOT part of the Community edition —
 * see ROADMAP.md.
 */
import type { Sha256Digest } from './canonical-hash';

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
