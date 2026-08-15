/**
 * OutboxService — transactional Outbox enqueue surface (Wave 2 Phase 1
 * Task 5.1).
 *
 * Spec: `.kiro/specs/idempotency-and-outbox/`
 *   - requirements.md Requirement 2 (OutboxEvent 表与发布契约)
 *   - requirements.md Requirement 4 (Trace 字段族复用 RequestContext)
 *   - design.md "Components and Interfaces > OutboxService transactional API"
 *   - design.md "Frozen Decision 1" (PG LISTEN/NOTIFY + SKIP LOCKED + BullMQ)
 *   - design.md "Frozen Decision 3" (modules/outbox + modules/idempotency split)
 *   - Acceptance: 2.3, 2.4, 4.1, 4.4
 *
 * ── Why a service, not just a repository ──────────────────────────
 *
 *   The Outbox protocol has THREE invariants that a plain TypeORM
 *   repository cannot enforce:
 *
 *     1. The INSERT MUST happen inside the caller's business txn.
 *        Otherwise a crash between "business commit" and "outbox
 *        insert" silently drops events. This service exposes
 *        `runInTransaction(cb)` so the caller never has to manually
 *        thread an EntityManager through their domain logic.
 *
 *     2. `pg_notify('outbox_pending', topic)` MUST run inside the
 *        same txn so Postgres queues the NOTIFY until COMMIT. This
 *        eliminates the "listener wakes up, queries the table, finds
 *        no rows because the producer txn has not committed yet"
 *        race. The bare repository would not invoke pg_notify.
 *
 *     3. The trace_context block MUST be sourced from
 *        `getRequestContext()` — never minted locally — so audit /
 *        Outbox / IdempotencyKey / setup-audit / field-history rows
 *        all share the same trace family (Acceptance 4.1, design
 *        Property 6). The service rejects calls with no
 *        RequestContext bound.
 *
 *   The payload itself is also validated against the cross-cutting
 *   `outboxEventSchema` (Property 1: 横切契约一致性) before the row
 *   is committed.
 *
 * ── runInTransaction vs enqueueInTransaction ──────────────────────
 *
 *   `runInTransaction(cb)` is the convenience wrapper: it opens a
 *   `dataSource.transaction(...)`, hands the caller back an
 *   {@link OutboxTxnHandle} alongside the EntityManager, and emits
 *   the NOTIFY at the end of the transaction (post-COMMIT, see
 *   Frozen Decision 1). Most domain code SHOULD use this entry —
 *   the txn boundary, NOTIFY, and trace propagation are all
 *   handled automatically.
 *
 *   `enqueueInTransaction(manager, event)` is the raw entry. Callers
 *   that already own a txn (e.g. when wrapping legacy
 *   `dataSource.transaction(...)` blocks during the Wave 1 →
 *   Wave 2 EventEmitter sweep) pass in their EntityManager
 *   directly. The service still validates trace_context + payload
 *   shape but does NOT issue pg_notify itself — the wrapper
 *   `runInTransaction` is the single NOTIFY emitter, so we never
 *   notify multiple times for the same logical txn.
 *
 *   In practice, Phase 2 task 11.x (file-storage TODO(outbox)
 *   sweep) replaces every `this.emitter.emit(...)` call site with
 *   either:
 *     - a fresh `outbox.runInTransaction(async (m, ob) => { ... ob.enqueue(...) })`
 *       block when the surrounding code did not own a txn yet, OR
 *     - a `outbox.enqueueInTransaction(existingManager, ...)` call
 *       when the call site is already inside a `dataSource.transaction`.
 *
 * ── NOT in this service ──────────────────────────────────────────
 *
 *   - Worker-side dispatch / retry → `OutboxProcessor` (Task 6.2)
 *   - LISTEN handling              → `OutboxListenerService` (Task 6.1)
 *   - Topic-handler registration   → `OutboxHandlerRegistry` (Task 6.3)
 *   - Cleanup of published rows    → `OutboxCleanupService` (Task 25.1)
 */
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { generateId } from '../../../common/utils/generate-id';
import {
  outboxEventSchema,
  type OutboxEvent as OutboxEventContract,
  type OutboxEventTraceContext,
} from '../../../common/contracts/outbox-event';
import { getRequestContext } from '../../../common/request-context/request-context';
import { TraceOutboxTransaction } from '../../../common/observability/instrumentation/outbox-span.decorator';
import { StructuredLogger } from '../../../common/logging';
import { OutboxEvent } from '../entities/outbox-event.entity';

/**
 * Caller-supplied subset of {@link OutboxEventContract}. The service
 * fills in `id`, `traceContext`, `createdAt`, `publishedAt`,
 * `attemptCount`, and (when absent) `idempotencyKey`. Callers MUST
 * NOT supply these — `enqueueInTransaction` rejects inputs that try
 * to mint trace ids locally (Acceptance 4.1).
 */
export interface OutboxEventInput {
  workspaceId: string;
  topic: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  /**
   * Optional Idempotency-Key linking the event back to its producing
   * mutation. If the request entered through IdempotencyMiddleware
   * (Task 7.4) this MUST be populated; otherwise leave undefined.
   */
  idempotencyKey?: string;
}

/**
 * Handle returned by {@link OutboxService.runInTransaction}. Lets the
 * caller enqueue events without re-passing the EntityManager.
 */
export interface OutboxTxnHandle {
  enqueue(event: OutboxEventInput): Promise<string>;
}

/** Sentinel raised when a caller tries to enqueue without a RequestContext. */
export class OutboxRequestContextMissingError extends Error {
  constructor() {
    super(
      'OutboxService.enqueue requires a RequestTraceContext to be bound. ' +
        'Public mutations enter through createRequestContextMiddleware; ' +
        'background jobs MUST wrap their logic in `runWithTraceContext` ' +
        '(see common/request-context/request-context.ts).',
    );
    this.name = 'OutboxRequestContextMissingError';
  }
}

/** Sentinel raised when the payload fails the shared-schema validation. */
export class OutboxPayloadInvalidError extends Error {
  constructor(public readonly issues: unknown) {
    super(
      'OutboxService.enqueue payload failed outboxEventSchema validation. ' +
        'See `common/contracts/outbox-event.ts` for the canonical shape.',
    );
    this.name = 'OutboxPayloadInvalidError';
  }
}

@Injectable()
export class OutboxService {
  private readonly logger = new StructuredLogger(OutboxService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Open a managed transaction, hand the caller back an
   * {@link OutboxTxnHandle} alongside the EntityManager, and emit
   * `pg_notify('outbox_pending', topic)` at the end.
   *
   * The NOTIFY is queued by Postgres until COMMIT — so a roll-back
   * inside `cb` quietly discards the notify alongside the row. We
   * emit ONE NOTIFY per `runInTransaction` call regardless of how
   * many events were enqueued; the listener is woken only once and
   * drains the table in a single SELECT (Frozen Decision 2:
   * concurrency=1 worker per pod).
   *
   * @returns whatever the caller returns from `cb`.
   */
  @TraceOutboxTransaction()
  async runInTransaction<T>(
    cb: (manager: EntityManager, outbox: OutboxTxnHandle) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      // Track the topics enqueued during this txn so we can emit a
      // single coalesced NOTIFY per topic at the end. Multiple
      // enqueues to the same topic only need one wake-up.
      const enqueuedTopics = new Set<string>();

      const handle: OutboxTxnHandle = {
        enqueue: async (event) => {
          const id = await this.enqueueInTransaction(manager, event);
          enqueuedTopics.add(event.topic);
          return id;
        },
      };

      const result = await cb(manager, handle);

      // Issue NOTIFY for every distinct topic touched. Postgres
      // queues NOTIFY until COMMIT, so this is safe to call inside
      // the txn.
      for (const topic of enqueuedTopics) {
        await this.notifyTopic(manager, topic);
      }

      return result;
    });
  }

  /**
   * Insert an OutboxEvent row inside an existing transaction.
   *
   * Callers that already own an EntityManager (e.g. mid-sweep
   * Phase 2 file-storage call sites) use this entry directly. Note
   * that this method does NOT issue pg_notify — the producer is
   * responsible for either:
   *   - using `runInTransaction` (recommended; NOTIFY automatic), OR
   *   - calling {@link notifyTopic} once per touched topic at the
   *     end of their own transaction.
   *
   * @returns the UUIDv7 id of the freshly inserted row.
   *
   * @throws {OutboxRequestContextMissingError}  no trace context bound
   * @throws {OutboxPayloadInvalidError}         payload fails schema
   */
  async enqueueInTransaction(
    manager: EntityManager,
    event: OutboxEventInput,
  ): Promise<string> {
    // ── Acceptance 4.1 / Property 6: trace family MUST come from
    //    the bound RequestContext. We do NOT mint trace ids
    //    locally — the producer is expected to be running inside
    //    `createRequestContextMiddleware` (HTTP path) or
    //    `runWithTraceContext` (job / worker path).
    const ctx = getRequestContext();
    if (!ctx) {
      throw new OutboxRequestContextMissingError();
    }

    const traceContext: OutboxEventTraceContext = {
      traceId: ctx.traceId,
      correlationId: ctx.correlationId,
      // contract uses optional; entity stores nullable jsonb.
      // Use `?? undefined` so the JSON object simply omits the key
      // when there is no executionId, matching the contract.
      executionId: ctx.executionId ?? undefined,
    };

    const id = generateId();
    const now = new Date();

    // ── Property 1: validate against the cross-cutting schema
    //    BEFORE we persist. The materialised contract object is
    //    what would be visible to consumers post-publish, so a
    //    malformed enqueue is rejected before commit.
    const validationCandidate: OutboxEventContract = {
      id,
      workspaceId: event.workspaceId,
      topic: event.topic,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload,
      traceContext,
      idempotencyKey: event.idempotencyKey,
      createdAt: now,
      publishedAt: null,
      attemptCount: 0,
      // lastError omitted (optional)
    };
    const parsed = outboxEventSchema.safeParse(validationCandidate);
    if (!parsed.success) {
      this.logger.error('outbox envelope validation failed', JSON.stringify({
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        issuePaths: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
          message: issue.message,
        })),
      }));
      throw new OutboxPayloadInvalidError(parsed.error.issues);
    }

    // ── Persist. The entity supplies its own UUIDv7 via
    //    `@BeforeInsert`, but we already have one in hand for
    //    validation, so we hand it to the manager explicitly to
    //    keep the in-memory candidate and the row in sync.
    //
    //    NOTE: we use `repo.insert(literal)` instead of
    //    `repo.insert(repo.create(...))` because TypeORM's
    //    `_QueryDeepPartialEntity` recursion does not expand
    //    `Record<string, unknown>` cleanly when fed an already-typed
    //    `OutboxEvent` instance (the recursive `payload` deep-partial
    //    expansion clashes with the loose Record<string, unknown>
    //    shape). Passing the raw literal lets the contextual typer
    //    accept it as a partial-entity draft.
    const repo = manager.getRepository(OutboxEvent);
    // Use `create` + `save` (rather than `insert`) because TypeORM's
    // `_QueryDeepPartialEntity` recursion does not expand
    // `Record<string, unknown>` cleanly through `repo.insert(...)` —
    // the recursion clashes with the loose value type and surfaces
    // a TS2345 mismatch on `payload`. `create` accepts a typed
    // `DeepPartial<OutboxEvent>` and `save` accepts the resulting
    // entity, sidestepping the recursion. Functionally equivalent
    // for a single-row insert: `save` issues the same INSERT SQL
    // when the row carries no existing id-binding.
    const draft = repo.create({
      id,
      workspaceId: event.workspaceId,
      topic: event.topic,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload as never,
      // Entity column type stores `executionId` as either a string
      // or absent inside the jsonb — we mirror the contract's
      // optional shape. Ensure we do not write `undefined` as a
      // jsonb value (TypeORM would coerce to null which is OK,
      // but we strip explicitly for clarity).
      traceContext: {
        traceId: traceContext.traceId,
        correlationId: traceContext.correlationId,
        ...(traceContext.executionId !== undefined
          ? { executionId: traceContext.executionId }
          : {}),
      } as OutboxEvent['traceContext'],
      idempotencyKey: event.idempotencyKey ?? null,
      attemptCount: 0,
      publishedAt: null,
      createdAt: now,
      lastError: null,
    });
    await repo.save(draft);

    this.logger.debug({
      event: 'outbox.enqueue',
      outboxId: id,
      topic: event.topic,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      // Note: traceId is also auto-injected by StructuredLogger from
      // RequestContext, but we keep this explicit for backward
      // compatibility with existing log queries that grep for it.
      payloadTraceId: traceContext.traceId,
    });

    return id;
  }

  /**
   * Issue `pg_notify('outbox_pending', topic)` from inside a
   * transaction. Postgres queues the NOTIFY until COMMIT, so the
   * listener never sees an event whose row is not yet visible.
   *
   * Public so call sites that prefer the raw
   * `enqueueInTransaction` entry can still emit the wake-up at
   * txn end without rolling their own SQL.
   */
  async notifyTopic(manager: EntityManager, topic: string): Promise<void> {
    // pg_notify is parameterised to avoid quoting bugs around topic
    // names that ever drift outside `[a-z0-9_:]+`. The channel name
    // ('outbox_pending') is a stable identifier; only the payload
    // (topic) varies per call.
    await manager.query(`SELECT pg_notify('outbox_pending', $1)`, [topic]);
  }
}
