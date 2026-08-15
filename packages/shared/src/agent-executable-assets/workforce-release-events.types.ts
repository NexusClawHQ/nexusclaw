import {
  CODE_ACTION_REVOKED_EVENT,
  WORKFORCE_RELEASE_HEAD_CHANGED_EVENT,
} from './contract-versions';

export interface WorkforceReleaseHeadChangedEventV1 {
  eventType: typeof WORKFORCE_RELEASE_HEAD_CHANGED_EVENT;
  workspaceId: string;
  agentApiName: string;
  transition: 'promote' | 'rollback';
  activationKind?: 'initial_promote' | 'rollback_repromote';
  priorPromotionReceiptId?: string;
  rollbackReceiptId?: string;
  beforeReleaseSetId: string | null;
  afterReleaseSetId: string | null;
  beforeGeneration: number;
  afterGeneration: number;
  afterSourceLockDigest: `sha256:${string}` | null;
  afterReleaseEnvelopeDigest: `sha256:${string}` | null;
  actorId: string;
  approvalId?: string;
  reason?: string;
  occurredAt: string;
}

export interface CodeActionRevokedEventV1 {
  eventType: typeof CODE_ACTION_REVOKED_EVENT;
  workspaceId: string;
  assertedReleaseSetId: string;
  exportId: string;
  toolName: string;
  publishedChecksum: `sha256:${string}`;
  reason: string;
  revokedBy: string;
  revokedAt: string;
}
