/**
 * Public entry point for the structured-logging utilities introduced
 * by FI-5 (task 2.17). Consumers should import from this barrel rather
 * than reaching into individual files.
 *
 * Task 2.18 additions:
 *   - `requestContextApolloPlugin` — Apollo Server 5 plugin that
 *     enriches the bound RequestContext with the resolved GraphQL
 *     operation name (no nested ALS frame).
 *   - `extractJobTraceCarrier` / `logJobActiveContext` — helpers for
 *     BullMQ processors to surface trace IDs from
 *     `@OnWorkerEvent('active')` hooks without mutating the canonical
 *     request-context module.
 */
export { StructuredLogger, type LogPayload } from './structured-logger';
export { RequestContextMiddleware } from './request-context.middleware';
export { requestContextApolloPlugin } from './request-context.apollo-plugin';
export {
  extractJobTraceCarrier,
  logJobActiveContext,
} from './bullmq-request-context';
