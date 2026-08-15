import { SpanStatusCode, context, trace } from '@opentelemetry/api';

import { getRequestContext } from '../../request-context/request-context';

/**
 * Agent Runtime span decorator (FI-8 / Requirement 2.9).
 *
 * Wraps the top-level `execute*` entry methods on agent-runtime services with
 * an OpenTelemetry span that follows the same shape as `file-storage` /
 * `outbox` / `object-record` instrumentation: a single span covering the full
 * lifecycle, success/failure status semantics, and exception recording.
 *
 * Spans are intentionally placed at the top level only — the inner ReAct loop
 * iterations would be far too noisy. Span attributes pull `workspaceId` /
 * `agentId` / `executionId` from the AgentExecution arg and `requestId`
 * (traceId / correlationId) from RequestContext when available, so the span
 * lines up with the existing trace-context propagation (¬C(X) 3.13).
 */
export type AgentRuntimeOperation = 'execute';

interface ExecutionLike {
  id?: string;
  workspaceId?: string;
  agentId?: string;
  triggeredBy?: string;
  triggerSource?: string;
  triggerPayload?: {
    traceId?: string;
    correlationId?: string;
    actorId?: string;
  };
}

function executeAttributes(args: unknown[]): Record<string, string | number> {
  const execution = args[0] as ExecutionLike | undefined;
  const ctx = getRequestContext();
  const requestId =
    execution?.triggerPayload?.traceId ??
    execution?.triggerPayload?.correlationId ??
    ctx?.traceId ??
    ctx?.correlationId ??
    'unknown';
  const userId =
    execution?.triggeredBy ??
    execution?.triggerPayload?.actorId ??
    ctx?.actorId ??
    'unknown';

  return {
    'nexusclaw.workspace_id': execution?.workspaceId ?? 'unknown',
    'nexusclaw.agent_id': execution?.agentId ?? 'unknown',
    'nexusclaw.execution_id': execution?.id ?? 'unknown',
    'nexusclaw.user_id': userId,
    'nexusclaw.request_id': requestId,
    'nexusclaw.trigger_source': execution?.triggerSource ?? 'unknown',
  };
}

export function TraceAgentRuntimeOperation(
  operation: AgentRuntimeOperation,
): MethodDecorator {
  return (_target, _propertyKey, descriptor) => {
    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    (descriptor as TypedPropertyDescriptor<(...args: unknown[]) => Promise<unknown>>).value =
      async function tracedAgentRuntimeOperation(...args: unknown[]) {
        const tracer = trace.getTracer('nexusclaw-backend');
        const parentContext = context.active();
        const span = tracer.startSpan(
          `agent-runtime.${operation}`,
          { attributes: executeAttributes(args) },
          parentContext,
        );

        return context.with(trace.setSpan(parentContext, span), async () => {
          try {
            const result = await original.apply(this, args);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (error) {
            if (error instanceof Error) {
              span.recordException(error);
              span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            } else {
              span.recordException(String(error));
              span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
            }
            throw error;
          } finally {
            span.end();
          }
        });
      };
    return descriptor;
  };
}
