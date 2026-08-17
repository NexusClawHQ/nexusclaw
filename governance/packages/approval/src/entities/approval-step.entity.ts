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
 * Approval Step Entity
 *
 * Defines individual steps within an approval process.
 * Supports serial (sequential) and countersign (all must approve) modes.
 * Includes timeout strategy (auto-reject or escalate).
 */
@Entity('approval_steps')
@Index('idx_approval_step_process', ['approvalProcessId'])
export class ApprovalStep {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Column({ name: 'approval_process_id', type: 'uuid' })
  approvalProcessId: string;

  @Column({ name: 'step_order', type: 'int' })
  stepOrder: number;

  @Column({ name: 'step_name', type: 'varchar', length: 200, nullable: true })
  stepName: string;

  @Column({ name: 'step_type', type: 'varchar', length: 20 })
  stepType: 'serial' | 'countersign';

  @Column({ name: 'approver_type', type: 'varchar', length: 20 })
  approverType: 'user' | 'role' | 'org_node' | 'manager' | 'ai_agent' | 'queue';

  @Column({ name: 'approver_id', type: 'uuid', nullable: true })
  approverId: string;

  @Column({ name: 'timeout_minutes', type: 'int', nullable: true })
  timeoutMinutes: number;

  @Column({ name: 'timeout_action', type: 'varchar', length: 20, default: 'reject' })
  timeoutAction: 'reject' | 'escalate';

  @Column({ name: 'ai_config', type: 'jsonb', nullable: true })
  aiConfig: {
    evaluationPrompt: string;
    confidenceThreshold: number;
    fallbackToHuman: boolean;
  } | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
