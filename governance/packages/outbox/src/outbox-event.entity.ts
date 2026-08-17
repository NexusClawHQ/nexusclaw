/**
 * OutboxEvent — single row in the platform Transactional Outbox.
 *
 * Spec: `.kiro/specs/idempotency-and-outbox/`
 *   - requirements.md Requirement 2 (OutboxEvent 表与发布契约)
 *   - design.md "Data Models > OutboxEvent"
 *   - design.md "Components and Interfaces > OutboxService transactional API"
 *   - Acceptance: 2.1 / 2.2 / 2.5 / 2.6 / 4.1 / 4.6
 *
 * Field shape MUST stay aligned with
 * `common/contracts/outbox-event.ts` (the cross-spec source of truth
 * declared by `foundation-gap-audit/design.md` Cross-Cutting Contract 3).
 *
 * ── Contract ↔ Entity boundary (READ ME before Task 5.1) ───────────
 *
 *   The contract `OutboxEvent` interface uses `optional` semantics
 *   (`executionId?`, `idempotencyKey?`, `lastError?` — TypeScript
 *   `string | undefined`). PostgreSQL columns are `nullable`
 *   (`string | null`). These are NOT equivalent in the type system.
 *
 *   `OutboxService.enqueueInTransaction` (Task 5.1) MUST therefore
 *   convert at the boundary:
 *     contract → entity: `value ?? null`
 *     entity   → contract: `value ?? undefined`
 *
 *   The entity intentionally re-imports `OutboxEventTraceContext`
 *   from `common/contracts/outbox-event.ts` to keep the trace block
 *   shape unforked; the entity's `traceContext` field stores the
 *   `executionId` slot as either `string` or absent (jsonb is
 *   schema-less; the JSON object simply omits the key when there is
 *   no executionId, matching the contract's optional semantics).
 *
 *   Payload validation: every Outbox row MUST have its `payload`
 *   field validated against `outboxEventSchema.payload` (or a
 *   stricter per-topic schema) BEFORE the INSERT. This boundary is
 *   enforced by `OutboxService.enqueueInTransaction` (Task 5.1)
 *   per Requirement 2.1 + Property 1 (横切契约一致性).
 *
 * ── Producer side ────────────────────────────────────────────────
 *
 *   `OutboxService.enqueueInTransaction(manager, event)` inserts a
 *   row inside the caller's business txn and issues
 *   `pg_notify('outbox_pending', topic)`. Postgres queues the
 *   NOTIFY until COMMIT, so the listener never sees an event whose
 *   row is not yet visible.
 *
 * ── Consumer side ────────────────────────────────────────────────
 *
 *   `OutboxProcessor.drain()` selects with
 *   `FOR UPDATE SKIP LOCKED LIMIT 100` against
 *   `WHERE published_at IS NULL AND attempt_count < 5`, dispatches
 *   via `OutboxHandlerRegistry.find(topic)`, and either UPDATEs
 *   `published_at = now()` on success or increments `attempt_count`
 *   / appends `last_error` on failure. Once `attempt_count` reaches
 *   the Frozen Decision 6 threshold (5) the row's `topic` is
 *   rewritten to `<topic>::dlq` (see `OUTBOX_DLQ_SUFFIX` in
 *   `outbox-topic.enum.ts`).
 *
 * NOT exposed to GraphQL — the Outbox is internal infrastructure.
 *
 * Primary key follows the workspace UUIDv7 convention.
 */
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { generateId } from './generate-id.js';
import type { OutboxEventTraceContext } from './contracts/outbox-event.js';

// Re-export the shared trace shape so consumers within the outbox
// module can reference it without reaching into `common/contracts/`
// directly. The shape itself is owned by `common/contracts/`.
export type { OutboxEventTraceContext };

@Entity('outbox_events')
@Index('IDX_OUTBOX_PENDING', ['publishedAt', 'createdAt'])
@Index('IDX_OUTBOX_TOPIC_PENDING', ['topic', 'publishedAt'])
@Index('IDX_OUTBOX_AGGREGATE', ['aggregateType', 'aggregateId'])
@Index('IDX_OUTBOX_WORKSPACE', ['workspaceId'])
export class OutboxEvent {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  assignId() {
    if (!this.id) this.id = generateId();
  }

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  /**
   * Canonical topic name (see `OutboxTopic` enum).
   * DLQ rows carry the original topic + `::dlq` suffix.
   */
  @Column({ type: 'varchar', length: 64 })
  topic: string;

  /**
   * Domain-scoped event type, e.g. `file.uploaded`,
   * `webhook.delivered`, `license.assigned`.
   */
  @Column({ name: 'event_type', type: 'varchar', length: 80 })
  eventType: string;

  /**
   * Aggregate root entity name, e.g. `ContentDocument`,
   * `WebhookEndpoint`, `UserLicense`. Used for per-aggregate
   * ordering guarantees (Acceptance 3.6).
   */
  @Column({ name: 'aggregate_type', type: 'varchar', length: 64 })
  aggregateType: string;

  @Column({ name: 'aggregate_id', type: 'varchar', length: 64 })
  aggregateId: string;

  /**
   * Event payload. Domain-scoped shape; consumer-side modules MUST
   * own their topic schema. NOTE: payload SHOULD NOT carry PII —
   * Wave 7 DSAR sub-spec enforces this via the
   * `piiClassification` hooks.
   */
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  /**
   * Trace context propagated from the producing request. Sourced
   * from `getRequestContext()` — never minted locally
   * (Acceptance 4.1).
   */
  @Column({ name: 'trace_context', type: 'jsonb' })
  traceContext: OutboxEventTraceContext;

  /**
   * Optional Idempotency-Key linking the event back to the public
   * mutation that produced it. Used for cross-module idempotency
   * lineage tracing.
   */
  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  idempotencyKey: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /**
   * Set to `now()` once the event has been successfully dispatched
   * to its topic handler. `null` means the event is still pending
   * (or stuck in DLQ — see `attemptCount`).
   */
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  /**
   * Monotonic per-row counter incremented by the worker on every
   * failed dispatch. When this reaches the Frozen Decision 6
   * threshold (5), the row's `topic` is rewritten to
   * `<original>::dlq` and the row stays unpublished forever
   * (manual replay required).
   */
  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount: number;

  /**
   * Truncated stack / message from the most recent dispatch
   * failure. Capped at 4096 chars by the worker to keep row size
   * bounded.
   */
  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;
}
