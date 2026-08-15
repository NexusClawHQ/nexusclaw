import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
  BeforeInsert,
} from 'typeorm';
import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';
import { Agent } from '../../agent/entities/agent.entity';
import { ReactStep } from './react-step.entity';
import { ToolCallRecord } from './tool-call-record.entity';
import { generateId } from '../../../common/utils/generate-id';

/**
 * AgentExecution Entity
 *
 * Records each Agent execution lifecycle, including trigger info,
 * intent classification, execution status, output, metering, and outcome.
 */
@ObjectType('AgentExecution')
@Entity('agent_executions')
@Index(['workspaceId'])
@Index(['agentId'])
@Index(['workspaceId', 'status'])
@Index(['workspaceId', 'triggerSource'])
@Index(['workspaceId', 'createdAt'])
@Index(['workspaceId', 'targetObjectName', 'targetRecordId'])
@Index('UQ_agent_executions_workspace_id', ['workspaceId', 'id'], {
  unique: true,
})
// Phase 4C / task 4.13 — dual-workspace lineage (design §11.4).
// `workspaceId` remains the execution/data tenant; `sourceWorkspaceId` is the
// immutable asset tenant. For `active_snapshot` runs the two are equal; for
// `candidate_test` they differ and the row attests an exact isolation binding.
// All lineage fields are nullable: legacy rows keep them NULL and remain
// readable, v2 rows must satisfy the DB CHECK constraints installed by
// migration 1830130000000.
@Index(['sourceWorkspaceId'])
@Index(['resolutionMode'])
@Index(['sourceWorkspaceId', 'releaseSetId'])
export class AgentExecution {
  @Field(() => ID)
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Field()
  @Column('uuid')
  workspaceId: string;

  /**
   * Dual-workspace lineage (Phase 4C / task 4.13, design §11.4).
   * `workspaceId` above is the execution/data tenant; this is the immutable
   * asset/release tenant. NULL on legacy rows. For `active_snapshot` runs it
   * equals `workspaceId`; for `candidate_test` it differs and the row must
   * also carry a valid `candidateIsolationBindingId` /
   * `candidateIsolationSnapshotHash` pair.
   */
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

  /**
   * Corrective §11.4 v2 snapshot. These columns remain NULL on legacy rows;
   * runtime/v2 must persist the exact release/principal snapshot before the
   * first step and may never reconstruct it from a current release head.
   */
  @Column({ name: 'release_set_id', type: 'uuid', nullable: true })
  releaseSetId: string | null;

  @Column({ name: 'agent_version_id', type: 'uuid', nullable: true })
  agentVersionId: string | null;

  @Column({ name: 'bundle_digest', type: 'varchar', length: 71, nullable: true })
  bundleDigest: string | null;

  @Column({ name: 'goal_snapshot_id', type: 'uuid', nullable: true })
  goalSnapshotId: string | null;

  @Column({
    name: 'goal_snapshot_hash',
    type: 'varchar',
    length: 71,
    nullable: true,
  })
  goalSnapshotHash: string | null;

  @Column({
    name: 'initial_context_manifest_id',
    type: 'uuid',
    nullable: true,
  })
  initialContextManifestId: string | null;

  @Column({
    name: 'initial_context_manifest_hash',
    type: 'varchar',
    length: 71,
    nullable: true,
  })
  initialContextManifestHash: string | null;

  @Column({ name: 'principal_snapshot', type: 'jsonb', nullable: true })
  principalSnapshot: Record<string, unknown> | null;

  @Column({ name: 'trace_id', type: 'varchar', length: 100, nullable: true })
  traceId: string | null;

  @Column({
    name: 'correlation_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  correlationId: string | null;

  @Column({
    name: 'parent_flow_execution_id',
    type: 'uuid',
    nullable: true,
  })
  parentFlowExecutionId: string | null;

  @Column({
    name: 'parent_flow_step_log_id',
    type: 'uuid',
    nullable: true,
  })
  parentFlowStepLogId: string | null;

  @Field()
  @Column('uuid')
  agentId: string;

  @Field(() => Agent, { nullable: true })
  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agentId' })
  agent: Agent;

  // Trigger info
  @Field()
  @Column({ type: 'varchar', length: 20 })
  triggerType: string; // manual | event | schedule | message; queue priority is resolved by agent-queue-priority.config

  @Field()
  @Column({ type: 'varchar', length: 20 })
  triggerSource: string; // wecom | feishu | dingtalk | web | api | cron

  @Field({ nullable: true })
  @Column({ type: 'uuid', nullable: true })
  triggeredBy?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  triggerPayload?: Record<string, any>;

  // Intent
  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  rawInput?: string;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  intent?: string;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  intentConfidence?: number;

  // Read-only derived projection of the topics this execution was
  // bound to. Not a persisted column — populated by agentExecutionDetail by
  // replaying the executor's deterministic topic selection
  // (selectReleaseBoundTopicIds) over the frozen AgentVersion snapshot +
  // rawInput + intent. Empty for legacy executions that never went through
  // release-bound topic selection.
  @Field(() => [String], { nullable: true })
  topicIds?: string[];

  // Execution status
  @Field()
  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: string; // pending | running | guardrail_pending | done | failed | timeout | cancelled

  // Output
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  outputType?: string; // text | record | report | action

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  outputContent?: Record<string, any>;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  outputSummary?: string;

  // Metering
  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  totalInputTokens: number;

  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  totalOutputTokens: number;

  @Field(() => Float)
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  totalCost: number;

  @Column({ type: 'jsonb', nullable: true })
  aiProviderSummary?: Record<string, unknown> | null;

  // Outcome
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  outcomeType?: string;

  @Field({ nullable: true })
  @Column({ type: 'uuid', nullable: true })
  outcomeRecordId?: string;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  participationScore?: number;

  // 服务客户 / task↔customer link (Phase 2): which CRM record this task acted on,
  // resolved at execution time so 任务上下文 can show the customer + its AI memory.
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  targetObjectName?: string;

  @Field({ nullable: true })
  @Column({ type: 'uuid', nullable: true })
  targetRecordId?: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  targetRecordName?: string;

  // Timing
  @Field({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date;

  @Field({ nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  durationMs?: number;

  // Relations
  @Field(() => [ReactStep], { nullable: true })
  @OneToMany(() => ReactStep, (step) => step.execution, { cascade: false })
  reactSteps?: ReactStep[];

  @Field(() => [ToolCallRecord], { nullable: true })
  @OneToMany(() => ToolCallRecord, (tc) => tc.execution, { cascade: false })
  toolCallRecords?: ToolCallRecord[];

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
