import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { generateId } from '../../../common/utils/generate-id';

// AI evaluation metadata attached to approval history entries
export interface ApprovalAIMetadata {
  confidenceScore: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  evaluationReport?: string;
  agentId?: string;
  executionId?: string;
}

// Approval history entry stored in the JSONB history array
export interface ApprovalHistoryEntry {
  stepIndex: number;
  stepName: string;
  action:
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'RECALLED'
    | 'DELEGATED'
    | 'EXPIRED';
  actorId: string;
  actorName: string;
  comments?: string;
  timestamp: string;
  /** For DELEGATED action: the user who receives the delegation */
  delegateUserId?: string;
  /** Whether the actor is a human user or an AI agent. Defaults to 'HUMAN'. */
  actorType?: 'HUMAN' | 'AI_AGENT';
  /**
   * Phase 4C / task 4.15 (design §15.4 line 2638) — discriminated terminal
   * actor for v2 approval subjects. Populated only on the terminal history
   * entry of a v2 instance: `'human'` for APPROVED/REJECTED (carries a user
   * UUID in `actorId`), `'system_expiry'` for EXPIRED (carries the
   * expiry-sweep run id in `actorId`). Legacy/HUMAN/AI_AGENT entries leave
   * this undefined; EXPIRED is never fabricated as a human/comment entry.
   */
  decisionActorKind?: 'human' | 'system_expiry';
  /** AI evaluation metadata, present when actorType is 'AI_AGENT' */
  aiMetadata?: ApprovalAIMetadata;
  /** Queue approver context when the actor approved on behalf of a Queue. */
  queueContext?: string;
  /**
   * Required Setup Audit id for a training-authorized workforce release
   * self-approval. The id resolves to both the transactional Outbox row and
   * its durable SetupAuditTrail projection.
   */
  auditId?: string;
  /**
   * Exact authorization evidence used for a permitted workforce-release
   * self-approval. Absent for ordinary separation-of-duty decisions.
   */
  selfApprovalAuthorization?: {
    authorizationId?: string;
    authorizationVersion?: string;
    authorizationDigest?: string;
    authorizationAuditId?: string;
    policySource:
      | 'explicit_training_authorization'
      | 'trusted_training_workspace'
      | 'trusted_training_account';
    policyDigest: string;
    scope: 'training';
    eligiblePrincipalType: 'human_training_account';
    approvalPolicyApiName: string;
    workspaceEnvironmentType: string;
    approvalPolicyRevisionId: string;
    approvalPolicyChecksum: string;
  };
}

@Entity('approval_instances')
@Index(['workspaceId', 'recordId'])
@Index(['processId'])
@Index(['status'])
export class ApprovalInstance {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ name: 'process_id', type: 'uuid' })
  processId: string;

  @Column({ name: 'record_id', type: 'uuid' })
  recordId: string;

  @Column({ name: 'object_name', type: 'varchar', length: 100 })
  objectName: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'RECALLED', 'EXPIRED'],
    default: 'PENDING',
  })
  status: string;

  @Column({ name: 'current_step_index', type: 'int', default: 0 })
  currentStepIndex: number;

  @Column({ name: 'approval_policy_revision_id', type: 'uuid', nullable: true })
  approvalPolicyRevisionId?: string | null;

  @Column({ name: 'approval_policy_checksum', type: 'varchar', length: 71, nullable: true })
  approvalPolicyChecksum?: string | null;

  @Column({ name: 'subject_type', type: 'varchar', length: 32, nullable: true })
  subjectType?: 'agent_tool' | 'flow_tool' | 'workforce_release' | null;

  @Column({ name: 'subject_id', type: 'uuid', nullable: true })
  subjectId?: string | null;

  @Column({ name: 'tool_call_id', type: 'uuid', nullable: true })
  toolCallId?: string | null;

  @Column({ name: 'governance_context', type: 'jsonb', nullable: true })
  governanceContext?: Record<string, unknown> | null;

  @Column({ name: 'governance_context_digest', type: 'varchar', length: 71, nullable: true })
  governanceContextDigest?: string | null;

  @Column({ name: 'subject_idempotency_key_hash', type: 'varchar', length: 71, nullable: true })
  subjectIdempotencyKeyHash?: string | null;

  @Column({ name: 'supersedes_approval_id', type: 'uuid', nullable: true })
  supersedesApprovalId?: string | null;

  @Column({ name: 'superseded_by_approval_id', type: 'uuid', nullable: true })
  supersededByApprovalId?: string | null;

  @Column({ name: 'superseded_at', type: 'timestamptz', nullable: true })
  supersededAt?: Date | null;

  @Column({ name: 'supersession_reason', type: 'varchar', length: 64, nullable: true })
  supersessionReason?: 'expired_unconsumed' | null;

  @Column({ name: 'superseded_by_actor_id', type: 'uuid', nullable: true })
  supersededByActorId?: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @Column({ name: 'step_version', type: 'bigint', default: 0 })
  stepVersion?: string;

  @Column({ name: 'decision_version', type: 'bigint', default: 0 })
  decisionVersion?: string;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt?: Date | null;

  @Column({ name: 'consumed_by_kind', type: 'varchar', length: 64, nullable: true })
  consumedByKind?: string | null;

  @Column({ name: 'consumed_by_id', type: 'uuid', nullable: true })
  consumedById?: string | null;

  /**
   * Phase 4C / task 4.15 (design §15.4 line 2638) — terminal decision actor.
   * Nullable: legacy rows keep both NULL. For v2 subjects:
   *   - APPROVED/REJECTED ⇒ `'human'` + user UUID in `decisionActorId`;
   *   - EXPIRED           ⇒ `'system_expiry'` + expiry-sweep run id.
   * Enforced by `CK_approval_instances_decision_actor` and
   * `CK_approval_instances_decision_actor_tuple` (both NULL or both non-NULL).
   */
  @Column({
    name: 'decision_actor_kind',
    type: 'enum',
    enum: ['human', 'system_expiry'],
    nullable: true,
  })
  decisionActorKind?: 'human' | 'system_expiry' | null;

  @Column({ name: 'decision_actor_id', type: 'uuid', nullable: true })
  decisionActorId?: string | null;

  @Column({ name: 'history', type: 'jsonb', default: '[]' })
  history: ApprovalHistoryEntry[];

  @Column({ name: 'submitted_by', type: 'uuid' })
  submittedBy: string;

  @CreateDateColumn({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;
}
