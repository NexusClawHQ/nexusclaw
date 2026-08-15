/**
 * BullMQ ↔ RequestContext bridge utilities (task 2.18).
 *
 * BullMQ workers run jobs in a Node.js callback that lives outside
 * the HTTP request lifecycle, so they enter `process(job)` with NO
 * AsyncLocalStorage frame bound. The canonical way to attach trace
 * IDs to a job is for the job *handler* to wrap its body in
 * `runWithTraceContext(job.data?.traceContext, ...)` — and that's
 * what every existing processor that emits Outbox events / writes
 * audit / acquires permission already does (¬C(X) 3.13).
 *
 * What this file adds:
 *   1. {@link extractJobTraceCarrier} — best-effort extraction of a
 *      `TraceCarrier` from a BullMQ Job. Workers that already follow
 *      the convention have one of the following on `job.data`:
 *        - `traceContext: { traceId, correlationId, executionId, … }`
 *        - `metadata:     { traceId, correlationId, … }`
 *      We probe both shapes plus a flat fallback for older jobs.
 *
 *   2. {@link logJobActiveContext} — the body of an
 *      `@OnWorkerEvent('active')` hook. Emits a single structured
 *      log line saying "this job started" with the job's queue /
 *      name / id and the trace IDs we managed to extract. This
 *      makes the entry visible in log aggregators even before the
 *      processor's `process()` body wraps the work in
 *      `runWithTraceContext`.
 *
 * Boundary preservation:
 *   - We deliberately do NOT bind an ALS frame from the
 *     `OnWorkerEvent('active')` callback. BullMQ fires that event
 *     synchronously from the queue scheduler with no continuation
 *     into `process()`, so any ALS frame opened here would close
 *     before the job body runs. The processor's own
 *     `runWithTraceContext` inside `process()` remains the single
 *     source of truth.
 *   - We do NOT alter the canonical `request-context.ts` module
 *     (¬C(X) 3.13): we only consume its public types
 *     (`TraceCarrier`).
 */
import type { Job } from 'bullmq';
import type { Logger } from '@nestjs/common';

import type { TraceCarrier } from '../request-context/request-context';
import { StructuredLogger, type LogPayload } from './structured-logger';

/**
 * Loose typing for BullMQ job-data payloads that carry trace
 * context. We accept either the canonical `traceContext` envelope
 * (used by Outbox / agent-runtime) or the older `metadata` envelope
 * (used by event-bus). Anything else falls back to the empty
 * carrier.
 */
interface JobDataWithTrace {
  traceContext?: Partial<TraceCarrier>;
  metadata?: Partial<TraceCarrier>;
  traceId?: string;
  correlationId?: string;
  executionId?: string;
  workspaceId?: string;
  [key: string]: unknown;
}

/**
 * Extract a `TraceCarrier` from a job, probing common envelope
 * shapes. Returns an empty object when no fields can be found —
 * callers should treat that as "best-effort, log what we have".
 */
export function extractJobTraceCarrier(job: Job<unknown>): TraceCarrier {
  const data = (job.data ?? {}) as JobDataWithTrace;

  if (isCarrier(data.traceContext)) {
    return cleanCarrier(data.traceContext);
  }
  if (isCarrier(data.metadata)) {
    return cleanCarrier(data.metadata);
  }

  // Flat fallback: some legacy producers put trace IDs directly on
  // the job-data root.
  const flat: Partial<TraceCarrier> = {
    traceId: data.traceId,
    correlationId: data.correlationId,
    executionId: data.executionId,
    workspaceId: data.workspaceId,
  };
  return cleanCarrier(flat);
}

/**
 * Body of the `@OnWorkerEvent('active')` hook.
 *
 * Emits a single structured (JSON-stringified) log line so
 * downstream log aggregators can correlate the job lifecycle with
 * the request that produced it, even before the processor's own
 * `runWithTraceContext` re-binds the ALS frame.
 *
 * The function accepts either a vanilla NestJS {@link Logger} (legacy
 * call sites) or the FI-5 {@link StructuredLogger} (task 2.19+). When
 * a `StructuredLogger` is detected we hand it a typed
 * {@link LogPayload}; for the vanilla logger we fall back to the
 * historical JSON-string format so the log shape stays byte-compatible
 * for the modules that have not migrated yet.
 */
export function logJobActiveContext(
  logger: Pick<Logger, 'log'> | StructuredLogger,
  queueName: string,
  job: Job<unknown>,
): void {
  const carrier = extractJobTraceCarrier(job);
  const payload: LogPayload = {
    event: 'bullmq.job.active',
    queue: queueName,
    jobName: job.name,
    jobId: job.id ?? null,
    traceId: carrier.traceId ?? null,
    correlationId: carrier.correlationId ?? null,
    executionId: carrier.executionId ?? null,
    workspaceId: carrier.workspaceId ?? null,
  };

  if (isStructuredLogger(logger)) {
    logger.log(payload);
    return;
  }

  logger.log(JSON.stringify(payload));
}

function isStructuredLogger(
  logger: Pick<Logger, 'log'> | StructuredLogger,
): logger is StructuredLogger {
  return logger instanceof StructuredLogger;
}

function isCarrier(value: unknown): value is Partial<TraceCarrier> {
  return value !== null && typeof value === 'object';
}

function cleanCarrier(input: Partial<TraceCarrier>): TraceCarrier {
  const out: TraceCarrier = {};
  if (typeof input.traceId === 'string') out.traceId = input.traceId;
  if (typeof input.correlationId === 'string') out.correlationId = input.correlationId;
  if (typeof input.executionId === 'string') out.executionId = input.executionId;
  if (typeof input.actorType === 'string') out.actorType = input.actorType;
  if (typeof input.actorId === 'string') out.actorId = input.actorId;
  if (typeof input.workspaceId === 'string') out.workspaceId = input.workspaceId;
  if (typeof input.source === 'string') out.source = input.source;
  if (typeof input.requestPath === 'string') out.requestPath = input.requestPath;
  if (typeof input.requestMethod === 'string') out.requestMethod = input.requestMethod;
  return out;
}
