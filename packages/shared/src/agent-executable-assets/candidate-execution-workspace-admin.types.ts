import type { Sha256Digest } from './canonical-hash';

export type CandidateExecutionWorkspaceAuthorizationStatusV1 =
  | 'READY'
  | 'LEASED'
  | 'RESETTING'
  | 'RETIRED'
  | 'REVOKED';

export type AuthorizeCandidateExecutionWorkspaceInputV1 =
  | {
      readonly mode: 'first';
      readonly sourceWorkspaceId: string;
      readonly executionWorkspaceId: string;
      readonly expectedGeneration: 'none';
      readonly expectedPriorStatus: 'none';
    }
  | {
      readonly mode: 'recover';
      readonly slotId: string;
      readonly expectedAuthorizationId: string;
      readonly sourceWorkspaceId: string;
      readonly executionWorkspaceId: string;
      readonly expectedGeneration: number;
      readonly expectedPriorStatus: 'RETIRED' | 'REVOKED';
    };

export interface RevokeCandidateExecutionWorkspaceInputV1 {
  readonly slotId: string;
  readonly expectedAuthorizationId: string;
  readonly expectedGeneration: number;
  readonly reason: string;
}

export interface CandidateExecutionWorkspaceAuthorizationRefV1 {
  readonly authorizationId: string;
  readonly generation: number;
  readonly status: CandidateExecutionWorkspaceAuthorizationStatusV1;
  readonly authorizationDigest: Sha256Digest;
}

interface CandidateExecutionWorkspaceAdminReceiptBaseV1 {
  readonly schemaVersion: 'nexusclaw.candidate-execution-workspace-admin-receipt/v1';
  readonly receiptId: string;
  readonly sourceWorkspaceId: string;
  readonly executionWorkspaceId: string;
  readonly slotId: string;
  readonly actorId: string;
  readonly stepUpProofDigest: Sha256Digest;
  readonly idempotencyKeyHash: string;
  readonly requestFingerprint: Sha256Digest;
  readonly auditId: string;
  readonly outboxId: string;
  readonly outboxDedupeKey: string;
  readonly outboxEventDigest: Sha256Digest;
  readonly resultDigest: Sha256Digest;
  readonly createdAt: string;
}

export type CandidateExecutionWorkspaceAdminReceiptV1 =
  | (CandidateExecutionWorkspaceAdminReceiptBaseV1 & {
      readonly operation: 'authorize_first';
      readonly beforeAuthorization: null;
      readonly afterAuthorization: CandidateExecutionWorkspaceAuthorizationRefV1 & {
        readonly generation: 1;
        readonly status: 'READY';
      };
    })
  | (CandidateExecutionWorkspaceAdminReceiptBaseV1 & {
      readonly operation: 'authorize_recover';
      readonly beforeAuthorization: CandidateExecutionWorkspaceAuthorizationRefV1 & {
        readonly status: 'RETIRED' | 'REVOKED';
      };
      readonly afterAuthorization: CandidateExecutionWorkspaceAuthorizationRefV1 & {
        readonly status: 'READY';
      };
    })
  | (CandidateExecutionWorkspaceAdminReceiptBaseV1 & {
      readonly operation: 'revoke';
      readonly beforeAuthorization: CandidateExecutionWorkspaceAuthorizationRefV1 & {
        readonly status: 'READY' | 'LEASED' | 'RESETTING';
      };
      readonly afterAuthorization: CandidateExecutionWorkspaceAuthorizationRefV1 & {
        readonly status: 'REVOKED';
      };
    });
