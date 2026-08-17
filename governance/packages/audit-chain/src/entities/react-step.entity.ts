import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import type { AgentExecution } from './agent-execution.entity.js';
import { generateId } from '../generate-id.js';

/**
 * ReactStep Entity
 *
 * Records each Thought → Action → Observation step in the ReAct loop.
 * Cascades on delete with parent AgentExecution.
 */
@Entity('react_steps')
@Index(['executionId', 'stepIndex'])
@Index(['executionId', 'traceId'])
@Index(['executionId', 'correlationId'])
// Phase 4C / task 4.13 — dual-workspace lineage (design §11.4).
// Legacy react_steps had no tenant column of their own; they inherited the
// parent AgentExecution's workspace through `executionId`. v2 rows now carry
// their own execution-tenant `workspaceId` plus asset-tenant
// `sourceWorkspaceId` so each row attests lineage without a join. All five
// lineage fields are nullable and stay NULL on legacy rows.
@Index(['sourceWorkspaceId'])
@Index(['sourceWorkspaceId', 'releaseSetId'])
@Index(
  'UQ_react_steps_workspace_execution_id',
  ['workspaceId', 'executionId', 'id'],
  { unique: true },
)
export class ReactStep {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Column('uuid')
  executionId: string;

  @ManyToOne('AgentExecution', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'executionId' })
  execution: AgentExecution;

  /**
   * Dual-workspace lineage (Phase 4C / task 4.13, design §11.4).
   * NULL on legacy rows (they inherit via parent executionId). v2 rows carry
   * the execution tenant explicitly so per-row CHECK / FK can fire without a
   * join. For `active_snapshot` it equals the parent AgentExecution workspace;
   * for `candidate_test` it is the dedicated execution workspace and differs
   * from `sourceWorkspaceId`.
   */
  @Column({ name: 'workspace_id', type: 'uuid', nullable: true })
  workspaceId: string | null;

  @Column({ name: 'source_workspace_id', type: 'uuid', nullable: true })
  sourceWorkspaceId: string | null;

  @Column({
    name: 'resolution_mode',
    type: 'enum',
    enum: ['active_snapshot', 'candidate_test'],
    nullable: true,
  })
  resolutionMode: 'active_snapshot' | 'candidate_test' | null;

  @Column({
    name: 'candidate_isolation_binding_id',
    type: 'uuid',
    nullable: true,
  })
  candidateIsolationBindingId: string | null;

  @Column({
    name: 'candidate_isolation_snapshot_hash',
    type: 'varchar',
    length: 71,
    nullable: true,
  })
  candidateIsolationSnapshotHash: string | null;

  @Column({ name: 'release_set_id', type: 'uuid', nullable: true })
  releaseSetId: string | null;

  @Column({ name: 'flow_version_id', type: 'uuid', nullable: true })
  flowVersionId: string | null;

  @Column({
    name: 'flow_node_id',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  flowNodeId: string | null;

  @Column({ type: 'int' })
  stepIndex: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  traceId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  correlationId?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  actorType?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  actorId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source?: string;

  // Thought
  @Column({ type: 'text', nullable: true })
  thoughtReasoning?: string;

  @Column({ type: 'text', nullable: true })
  thoughtPlan?: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  thoughtConfidence?: number;

  // Action
  @Column({ type: 'varchar', length: 20 })
  actionType: string; // tool_call | llm_generate | human_handoff | finish

  @Column({ type: 'varchar', length: 100, nullable: true })
  toolName?: string;

  @Column({ type: 'jsonb', nullable: true })
  toolInput?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  generatePrompt?: string;

  // Observation
  @Column({ type: 'boolean', nullable: true })
  observationSuccess?: boolean;

  @Column({ type: 'jsonb', nullable: true })
  observationOutput?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  observationError?: string;

  @Column({ type: 'boolean', default: false })
  guardrailTriggered: boolean;

  // Metering
  @Column({ type: 'int', default: 0 })
  inputTokens: number;

  @Column({ type: 'int', default: 0 })
  outputTokens: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  model?: string;

  @Column({ type: 'jsonb', nullable: true })
  aiProviderStamp?: Record<string, unknown> | null;

  @Column({ type: 'int', nullable: true })
  durationMs?: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
