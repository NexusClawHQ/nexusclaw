import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { generateId } from '../generate-id.js';

/**
 * Guardrail Rule Entity
 *
 * Defines conditions and actions for the AGL guardrail engine.
 * Risk levels: L0 (log) to L4 (block).
 */
@Entity('guardrail_rules')
@Index('idx_guardrail_rule_workspace_active', ['workspaceId', 'isActive'])
export class GuardrailRule {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 100 })
  priority: number;

  @Column({ type: 'jsonb' })
  conditions: {
    objectApiName?: string;
    operation?: string;
    fieldApiNames?: string[];
    amountThreshold?: number;
    batchSize?: number;
  };

  @Column({ name: 'risk_level', type: 'varchar', length: 5 })
  riskLevel: 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

  @Column({ type: 'jsonb' })
  action: {
    approverRule?: 'manager' | 'role_admin' | 'specific_user';
    approverUserId?: string;
    timeoutMinutes?: number;
    timeoutAction?: 'block' | 'escalate';
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
