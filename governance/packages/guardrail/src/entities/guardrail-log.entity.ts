import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { generateId } from '../generate-id.js';

/**
 * Guardrail Log Entity
 *
 * Immutable audit record for every guardrail evaluation.
 * Tracks rule match, action taken, and approval status.
 */
@Entity('guardrail_logs')
@Index('idx_guardrail_log_workspace_time', ['workspaceId', 'createdAt'])
@Index('idx_guardrail_log_execution', ['executionId'])
@Index('idx_guardrail_log_risk', ['workspaceId', 'riskLevel'])
export class GuardrailLog {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ name: 'execution_id', type: 'uuid', nullable: true })
  executionId: string;

  @Column({ name: 'rule_id', type: 'uuid', nullable: true })
  ruleId: string;

  @Column({ name: 'rule_name', type: 'varchar', length: 200, nullable: true })
  ruleName: string;

  @Column({ name: 'risk_level', type: 'varchar', length: 5 })
  riskLevel: string;

  @Column({ name: 'operation_type', type: 'varchar', length: 50, nullable: true })
  operationType: string;

  @Column({ name: 'object_api_name', type: 'varchar', length: 100, nullable: true })
  objectApiName: string;

  @Column({ name: 'field_api_names', type: 'text', array: true, nullable: true })
  fieldApiNames: string[];

  @Column({ name: 'action_taken', type: 'varchar', length: 50 })
  actionTaken: 'allow' | 'audit' | 'confirm' | 'approve' | 'block';

  @Column({ name: 'auto_approved', type: 'boolean', default: false })
  autoApproved: boolean;

  @Column({ name: 'approval_id', type: 'uuid', nullable: true })
  approvalId: string;

  @Column({ name: 'approver_id', type: 'uuid', nullable: true })
  approverId: string;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date;

  @Column({ name: 'approval_status', type: 'varchar', length: 20, nullable: true })
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'timeout';

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
