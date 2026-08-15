/**
 * StructuredLogger — FI-5 (P1-baseline) structured-logging wrapper.
 *
 * Why this exists:
 *   The codebase historically uses `new Logger(SomeClass.name)` from
 *   `@nestjs/common` with free-form string messages. Those lines don't
 *   carry any trace-correlation IDs, so once a request fans out across
 *   modules / queues we cannot reconstruct it from logs alone.
 *
 * What it does:
 *   - Extends NestJS `Logger` so it remains a drop-in replacement for
 *     existing `private readonly logger = new Logger(X.name)` patterns.
 *   - Reads the AsyncLocalStorage-backed RequestTraceContext via
 *     `getRequestContext()` (the canonical accessor exported by
 *     `common/request-context/request-context.ts`).
 *   - Emits a single JSON line per call containing the caller's
 *     structured payload merged with `traceId` / `correlationId` /
 *     `operationId` (and `requestId` when present).
 *
 * Design note on field naming:
 *   FI-5 spec text (design.md §FI-5) names the third correlation field
 *   `operationId`. The existing `RequestTraceContext` type
 *   (request-context.ts) currently exposes `executionId` instead — and
 *   per spec ¬C(X) 3.13 we MUST NOT modify that API in this task. The
 *   logger therefore reads `operationId` from the context if a future
 *   field is added, and falls back to `executionId` so today's call
 *   sites still emit a non-empty correlation chain.
 *
 * Backward-compat note:
 *   Existing call sites pass a raw string as the first argument
 *   (`logger.log('something happened')`). To allow gradual migration
 *   without crashing those sites, every method accepts either a
 *   structured `LogPayload` OR a string; strings are wrapped as
 *   `{ event: 'log_string', message: <string> }`. New call sites MUST
 *   pass a `LogPayload` with a meaningful `event` discriminator.
 */
import { Logger } from '@nestjs/common';

import {
  getRequestContext,
  type RequestTraceContext,
} from '../request-context/request-context';

/**
 * Strongly-typed payload required for all NEW structured log calls.
 *
 * The `event` field is the machine-grep discriminator (e.g.
 * `'auth.login.success'`, `'outbox.enqueue.failed'`). All other keys
 * are open-ended structured metadata.
 */
export interface LogPayload {
  /**
   * Machine-readable event discriminator. Required.
   * Convention: `<module>.<action>.<outcome>` e.g. `auth.login.success`.
   */
  event: string;
  /**
   * Optional human-readable message accompanying the event.
   * Prefer adding structured fields over relying on `message`.
   */
  message?: string;
  // Open-ended structured metadata. Anything JSON-serializable.
  [key: string]: unknown;
}

/**
 * Internal — shape we read from the RequestContext. We tolerate the
 * future-shaped `operationId` / `requestId` fields without binding to
 * them at the type level (the canonical type doesn't expose them yet).
 */
type CorrelationCarrier = RequestTraceContext & {
  operationId?: string;
  requestId?: string;
};

interface CorrelationIds {
  traceId?: string;
  correlationId?: string;
  operationId?: string;
  requestId?: string;
}

function extractCorrelationIds(): CorrelationIds {
  const ctx = getRequestContext() as CorrelationCarrier | null;
  if (!ctx) {
    return {};
  }

  const ids: CorrelationIds = {
    traceId: ctx.traceId,
    correlationId: ctx.correlationId,
    // Prefer an explicit operationId if a future caller sets it; fall
    // back to the existing `executionId` so we still emit a non-empty
    // correlation chain on the current API surface.
    operationId: ctx.operationId ?? ctx.executionId,
  };

  if (ctx.requestId !== undefined) {
    ids.requestId = ctx.requestId;
  }

  return ids;
}

/**
 * Normalize either a structured payload or a legacy string into a
 * `LogPayload`. Strings are wrapped under `event: 'log_string'`.
 *
 * TODO(migration): remove the `string` branch once all call sites have
 * been migrated to structured payloads (see task 2.19).
 */
function normalizePayload(input: LogPayload | string): LogPayload {
  if (typeof input === 'string') {
    return { event: 'log_string', message: input };
  }
  return input;
}

function buildLine(payload: LogPayload | string): string {
  const normalized = normalizePayload(payload);
  const ids = extractCorrelationIds();
  return JSON.stringify({ ...normalized, ...ids });
}

/**
 * Drop-in replacement for `@nestjs/common`'s `Logger` that emits a
 * single JSON line per call with embedded trace/correlation IDs.
 *
 * Usage:
 * ```ts
 * private readonly logger = new StructuredLogger(MyService.name);
 *
 * this.logger.log({ event: 'job.completed', durationMs: 123 });
 * this.logger.error(
 *   { event: 'job.failed', reason: 'timeout' },
 *   error.stack,
 * );
 * ```
 */
export class StructuredLogger extends Logger {
  /**
   * Write a 'log' level entry.
   * Accepts a structured payload (preferred) or legacy string.
   */
  log(payload: LogPayload | string, context?: string): void {
    super.log(buildLine(payload), context ?? this.context);
  }

  /**
   * Write an 'error' level entry.
   *
   * Mirrors NestJS Logger's two-extra-string signature so existing call
   * sites that pass a stack trace AND a context string keep working.
   */
  error(
    payload: LogPayload | string,
    stackOrContext?: string,
    context?: string,
  ): void {
    if (context !== undefined) {
      super.error(buildLine(payload), stackOrContext, context);
      return;
    }

    if (stackOrContext !== undefined) {
      super.error(buildLine(payload), stackOrContext);
      return;
    }

    super.error(buildLine(payload), this.context);
  }

  /**
   * Write a 'warn' level entry.
   */
  warn(payload: LogPayload | string, context?: string): void {
    super.warn(buildLine(payload), context ?? this.context);
  }

  /**
   * Write a 'debug' level entry.
   */
  debug(payload: LogPayload | string, context?: string): void {
    super.debug(buildLine(payload), context ?? this.context);
  }

  /**
   * Write a 'verbose' level entry.
   */
  verbose(payload: LogPayload | string, context?: string): void {
    super.verbose(buildLine(payload), context ?? this.context);
  }
}
