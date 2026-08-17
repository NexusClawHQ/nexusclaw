import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * `approval_policy_revisions` — insert-only immutable approval policy revision
 * (executable-asset design §11.6, task 4.9).
 *
 * Each revision is a content-addressed snapshot of a v2-classified
 * `ApprovalProcess`. `revisionKey = checksum = SHA256(RFC8785({
 * schemaVersion, policyApiName, purpose, normalizedSteps, expiresAfterSeconds,
 * humanOnly:true}))`. Stage resolves the two explicit bundle apiNames and
 * creates/reuses revisions.
 *
 * DB trigger rejects UPDATE — rows are insert-only.
 */
@Entity('approval_policy_revisions')
@Index('UQ_approval_policy_revisions_id_workspace', ['id', 'workspaceId'], { unique: true })
@Index('UQ_approval_policy_revisions_revision_key', ['workspaceId', 'revisionKey'], { unique: true })
@Index('UQ_approval_policy_revisions_id_checksum', ['workspaceId', 'id', 'checksum'], { unique: true })
export class ApprovalPolicyRevisionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'workspaceId' })
  workspaceId: string;

  @Column({ type: 'uuid', name: 'approval_process_id' })
  approvalProcessId: string;

  @Column({ type: 'varchar', length: 100, name: 'policy_api_name' })
  policyApiName: string;

  @Column({ type: 'varchar', length: 32 })
  purpose: 'tool_call' | 'workforce_release';

  @Column({ type: 'varchar', length: 71, name: 'revision_key' })
  revisionKey: string;

  @Column({ type: 'jsonb', name: 'steps_snapshot' })
  stepsSnapshot: unknown[];

  @Column({ type: 'varchar', length: 71, name: 'approver_rules_digest' })
  approverRulesDigest: string;

  @Column({ type: 'boolean', name: 'human_only', default: true })
  humanOnly: boolean;

  @Column({ type: 'integer', name: 'expires_after_seconds' })
  expiresAfterSeconds: number;

  @Column({ type: 'varchar', length: 71 })
  checksum: string;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
