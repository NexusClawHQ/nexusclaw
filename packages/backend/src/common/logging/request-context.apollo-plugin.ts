/**
 * requestContextApolloPlugin — Apollo Server 5 plugin that
 * guarantees a RequestTraceContext is bound for the duration of
 * every GraphQL request, and enriches it with the resolved
 * GraphQL `operationName` so structured logs emitted from
 * resolvers carry a meaningful `operationId`.
 *
 * Why this plugin (task 2.18):
 *   `main.ts` mounts `createRequestContextMiddleware()` at the
 *   Express level so every `/graphql` request normally enters
 *   Apollo with a context already bound. The plugin is a
 *   defence-in-depth safety net for code paths that might bypass
 *   the global middleware (e.g. internal test harnesses that build
 *   a Nest app without re-mounting Express middleware, or future
 *   subscription-only entry points).
 *
 * What it does:
 *   - On `requestDidStart`: records the GraphQL operationName as
 *     `executionId` on the existing context (keeps logs grep-able
 *     by operation). Uses `updateRequestContext()` so it only
 *     mutates the OUTER ALS frame, never creates a nested one
 *     (¬C(X) 3.13: do not change request-context.ts API surface).
 *   - On `didResolveOperation`: re-records operationName once it's
 *     definitively resolved (the request body may not have it).
 *
 * Boundary preservation:
 *   - Does NOT call `runWithRequestContext()` / re-bind the ALS
 *     frame — Apollo plugin lifecycle hooks return promises that
 *     can't easily wrap subsequent resolver execution in a new ALS
 *     scope without restructuring the entire pipeline.
 *   - Does NOT mint new traceIds — those come from the HTTP
 *     middleware (request headers or randomUUID fallback). If for
 *     some reason no context is bound when this plugin fires, it
 *     stays a silent no-op rather than synthesising a half-correct
 *     context.
 *   - Existing modules already using request-context (permission,
 *     agent, api-key, audit, agent-runtime, source-tracking,
 *     outcome) MUST continue working with the same field formats
 *     — `executionId` is the canonical field they read for
 *     correlation, and we only fill it when it's currently empty.
 */
import type { ApolloDriverConfig } from '@nestjs/apollo';

import {
  getRequestContext,
  updateRequestContext,
} from '../request-context/request-context';

/**
 * Plugin factory. Exported as a function so `app.module.ts` can
 * spread it into the `GraphQLModule.forRoot({ plugins: [...] })`
 * array next to the existing depth/complexity plugin.
 */
type ApolloDriverPlugin = NonNullable<ApolloDriverConfig['plugins']>[number];

export function requestContextApolloPlugin(): ApolloDriverPlugin {
  return {
    async requestDidStart(reqCtx) {
      // First chance to capture operationName — `reqCtx.request.operationName`
      // may be set by the client or `null` until `didResolveOperation` fires.
      maybeAttachOperationId(reqCtx.request.operationName ?? undefined);

      return {
        async didResolveOperation(opCtx) {
          // Authoritative operationName once Apollo has parsed and
          // validated the document. Overwrites only when our earlier
          // attempt was a no-op (preserves any value an outer caller
          // explicitly set on the trace context).
          const resolved = opCtx.operationName ?? undefined;
          maybeAttachOperationId(resolved);
        },
      };
    },
  };
}

/**
 * If a request context exists and currently has no `executionId`,
 * stamp the GraphQL operation name onto it. Safe by construction:
 *   - Skips when no context is bound (defence-in-depth quiet path).
 *   - Skips when `executionId` is already set so we never overwrite
 *     an upstream-supplied value.
 *   - Skips when no operationName is available (anonymous query).
 */
function maybeAttachOperationId(operationName: string | undefined): void {
  if (!operationName) return;
  const ctx = getRequestContext();
  if (!ctx) return;
  if (ctx.executionId !== undefined && ctx.executionId !== '') return;
  updateRequestContext({ executionId: operationName });
}
