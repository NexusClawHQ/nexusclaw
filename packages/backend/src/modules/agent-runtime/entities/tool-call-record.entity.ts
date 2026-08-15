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
import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';
import { AgentExecution } from './agent-execution.entity';
import { ReactStep } from './react-step.entity';
import { generateId } from '../../../common/utils/generate-id';

/**
 * Phase 4C / task 4.14 — frozen ToolCall status enum (design §11.4 line 1539).
 *
 * Distinct from FunctionExecution's lower-case enum. ToolRegistry is the sole
 * writer of this column: it pre-creates one `STARTED` row before any side
 * effect and updates the same row for every terminal / escalation state.
 * Legacy rows keep this column NULL.
 *
 * `COMPLETION_UNKNOWN` is the durable paired terminal for the case where a
 * database outage prevented synchronous finalization; it must be reconciled
 * from Function/idempotency/connector/AI child evidence, never retried
 * blindly.
 */
export enum ToolCallStatus {
  STARTED = 'STARTED',
  DENIED = 'DENIED',
  BLOCKED = 'BLOCKED',
  REQUIRES_APPROVAL = 'REQUIRES_APPROVAL',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  COMPLETION_UNKNOWN = 'COMPLETION_UNKNOWN',
}

registerEnumType(ToolCallStatus, { name: 'ToolCallStatus' });

/**
 * ToolCallRecord Entity
 *
 * Records each tool invocation during Agent execution,
 * including permission checks, guardrail checks, and timing.
 */
@ObjectType('ToolCallRecord')
@Entity('tool_call_records')
@Index(['executionId'])
@Index(['toolName'])
@Index(['executionId', 'traceId'])
@Index(['executionId', 'correlationId'])
// Phase 4C / task 4.13 — dual-workspace lineage (design §11.4).
// Legacy tool_call_records had no tenant column of their own; they inherited
// the parent AgentExecution's workspace through `executionId`. v2 rows now
// carry their own execution-tenant `workspaceId` plus asset-tenant
// `sourceWorkspaceId`. All lineage fields are nullable and stay NULL on
// legacy rows; task 4.14 will rename `executionId`→`agentExecutionId` and add
// the remaining release/function parent columns.
@Index(['sourceWorkspaceId'])
@Index(['sourceWorkspaceId', 'releaseSetId'])
@Index(['workspaceId', 'agentExecutionId'])
@Index(['workspaceId', 'flowExecutionId'])
export class ToolCallRecord {
  @Field(() => ID)
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  executionId: string | null;

  @ManyToOne(() => AgentExecution, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'executionId' })
  execution?: AgentExecution | null;

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

  /**
   * Exact v2 parent and release/revision lineage. The legacy executionId
   * column above is retained for old rows only and must be NULL for v2.
   */
  @Column({ name: 'agent_execution_id', type: 'uuid', nullable: true })
  agentExecutionId: string | null;

  @Column({ name: 'flow_execution_id', type: 'uuid', nullable: true })
  flowExecutionId: string | null;

  @Column({ name: 'flow_step_log_id', type: 'uuid', nullable: true })
  flowStepLogId: string | null;

  @Column({ name: 'flow_version_id', type: 'uuid', nullable: true })
  flowVersionId: string | null;

  @Column({
    name: 'flow_node_id',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  flowNodeId: string | null;

  @Column({ name: 'release_set_id', type: 'uuid', nullable: true })
  releaseSetId: string | null;

  @Column({ name: 'function_revision_id', type: 'uuid', nullable: true })
  functionRevisionId: string | null;

  @Column({ name: 'function_execution_id', type: 'uuid', nullable: true })
  functionExecutionId: string | null;

  @Column({
    name: 'descriptor_hash',
    type: 'varchar',
    length: 71,
    nullable: true,
  })
  descriptorHash: string | null;

  @Column({
    name: 'published_checksum',
    type: 'varchar',
    length: 71,
    nullable: true,
  })
  publishedChecksum: string | null;

  @Column({
    name: 'runtime_provider_id',
    type: 'varchar',
    length: 96,
    nullable: true,
  })
  runtimeProviderId: string | null;

  @Column({
    name: 'idempotency_key_hash',
    type: 'varchar',
    length: 96,
    nullable: true,
  })
  idempotencyKeyHash: string | null;

  /**
   * Exact immutable static Slack/Teams binding snapshotted before approval.
   * All three fields are NULL on legacy/non-static rows and DB-enforced as an
   * all-or-nothing tuple for v2 static connector calls.
   */
  @Column({ name: 'static_binding_revision_id', type: 'uuid', nullable: true })
  staticBindingRevisionId?: string | null;

  @Column({
    name: 'static_binding_checksum',
    type: 'varchar',
    length: 71,
    nullable: true,
  })
  staticBindingChecksum?: string | null;

  @Column({ name: 'static_binding_generation', type: 'bigint', nullable: true })
  staticBindingGeneration?: string | null;

  /** Static adapters make exactly one connector subcall; the host owns 1. */
  @Column({
    name: 'static_connector_subcall_ordinal',
    type: 'int',
    nullable: true,
  })
  staticConnectorSubcallOrdinal?: number | null;

  @Column({
    name: 'static_connector_request_digest',
    type: 'varchar',
    length: 71,
    nullable: true,
  })
  staticConnectorRequestDigest?: string | null;

  @Field({ nullable: true })
  @Column({ type: 'uuid', nullable: true })
  stepId?: string;

  @ManyToOne(() => ReactStep, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'stepId' })
  step?: ReactStep;

  @Field()
  @Column({ type: 'varchar', length: 200 })
  toolName: string;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  traceId?: string;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  correlationId?: string;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  actorType?: string;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  actorId?: string;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  source?: string;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  toolCategory?: string; // crm | external | internal

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  input?: Record<string, any>;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  output?: Record<string, any>;

  // ----- Phase 4C / task 4.14 — ToolCall lifecycle (design §11.4 1539-1545)
  // All nullable: legacy rows keep them NULL and remain readable. ToolRegistry
  // is the sole writer of `status`; it pre-creates STARTED before any side
  // effect and CAS-updates the same row for every terminal/escalation state.

  @Field(() => ToolCallStatus, { nullable: true })
  @Column({
    name: 'status',
    type: 'enum',
    enum: ToolCallStatus,
    nullable: true,
  })
  status?: ToolCallStatus;

  /** Hard execution deadline; heartbeats may extend only within it. */
  @Column({ name: 'lease_expires_at', type: 'timestamptz', nullable: true })
  leaseExpiresAt?: Date | null;

  /** Last worker/host heartbeat within the execution deadline. */
  @Column({ name: 'last_heartbeat_at', type: 'timestamptz', nullable: true })
  lastHeartbeatAt?: Date | null;

  /** SHA-256 of the canonical (pre-redaction) input; never the raw payload. */
  @Column({ name: 'input_digest', type: 'varchar', length: 71, nullable: true })
  inputDigest?: string | null;

  /** SHA-256 of the canonical (pre-redaction) output; never the raw payload. */
  @Column({ name: 'output_digest', type: 'varchar', length: 71, nullable: true })
  outputDigest?: string | null;

  /** True once input/output JSON has been reduced to ≤8 KiB redacted preview. */
  @Column({ name: 'redaction_applied', type: 'boolean', nullable: true })
  redactionApplied?: boolean | null;

  /** 0-based execution attempt ordinal; retries reuse the same ToolCall. */
  @Column({ name: 'attempt', type: 'int', nullable: true })
  attempt?: number | null;

  /** Stable error code on FAILED / COMPLETION_UNKNOWN; never raw stack. */
  @Column({ name: 'error_code', type: 'varchar', length: 100, nullable: true })
  errorCode?: string | null;

  // Permission check
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 10, nullable: true })
  permissionCheck?: string; // passed | denied

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  permissionDetail?: string;

  // Guardrail check
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  guardrailCheck?: string; // passed | escalated | blocked

  @Field({ nullable: true })
  @Column({ type: 'uuid', nullable: true })
  guardrailRuleId?: string;

  // Timing
  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  durationMs?: number;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
