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

@Entity('approval_processes')
@Index(['workspaceId'])
@Index('UQ_approval_process_workspace_api_name', ['workspaceId', 'apiName'], {
  unique: true,
})
export class ApprovalProcess {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  /** Unique API name for deployment/migration key */
  @Column({ type: 'varchar',  length: 100 })
  apiName: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 100 })
  objectName: string;

  @Column({ type: 'boolean',  default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  entryCondition: string | null;

  @Column({ type: 'jsonb', default: '[]' })
  steps: Array<{
    id: string;
    name: string;
    approverType: string;
    approverName: string;
    agentId?: string;
    aiConfig?: {
      evaluationPrompt: string;
      confidenceThreshold: number;
      fallbackToHuman: boolean;
    };
  }>;

  /** Risk assessment configuration for AI-powered approval risk evaluation */
  @Column({ name: 'risk_assessment_config', type: 'jsonb', nullable: true })
  riskAssessmentConfig: {
    enabled: boolean;
    riskRules: Array<{
      id: string;
      name: string;
      conditionGroup: Record<string, unknown>;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
      weight: number;
    }>;
    autoApproveMaxAmount?: number;
    strategies: {
      LOW: 'AUTO_APPROVE' | 'NORMAL';
      MEDIUM: 'AI_RECOMMEND' | 'NORMAL';
      HIGH: 'FORCE_MANUAL' | 'NORMAL';
    };
  } | null;

  @Column({ type: 'varchar', nullable: true })
  finalApprovalAction: string | null;

  @Column({ type: 'varchar', nullable: true })
  finalRejectionAction: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  /**
   * v2 governance purpose (§11.6). NULL for legacy rows; once classified
   * ('tool_call' | 'workforce_release') it is DB-immutable (write-once).
   * Paired with `expiresAfterSeconds` via CHECK constraint.
   */
  @Column({ type: 'varchar', length: 32, name: 'policyPurpose', nullable: true, default: null })
  policyPurpose?: string | null;

  /**
   * v2 approval expiry in seconds (§11.6). NULL for legacy; 1..86400 when set.
   * CHECK: both NULL OR (both non-NULL AND 1 <= expires <= 86400).
   */
  @Column({ type: 'integer', name: 'expiresAfterSeconds', nullable: true, default: null })
  expiresAfterSeconds?: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
