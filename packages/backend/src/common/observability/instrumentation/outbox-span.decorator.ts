import { Span, SpanStatusCode, context, trace } from '@opentelemetry/api';

function summarizeOutboxArgs(args: unknown[]): Record<string, string> {
  const callbackArg = args.find((arg) => typeof arg === 'function');
  return {
    'nexusclaw.outbox.operation': 'runInTransaction',
    'nexusclaw.outbox.callback': callbackArg ? 'present' : 'absent',
  };
}

function wrapOutboxCallback(args: unknown[], span: Span): unknown[] {
  const callback = args[0] as
    | ((manager: unknown, outbox: { enqueue(event: any): Promise<string> }) => Promise<unknown>)
    | undefined;
  if (typeof callback !== 'function') return args;

  return [
    async (manager: unknown, outbox: { enqueue(event: any): Promise<string> }) => {
      const wrappedOutbox = {
        ...outbox,
        enqueue: async (event: any) => {
          span.setAttributes({
            'nexusclaw.outbox.topic': String(event?.topic ?? 'unknown'),
            'nexusclaw.outbox.event_type': String(event?.eventType ?? 'unknown'),
            'nexusclaw.outbox.aggregate_id': String(event?.aggregateId ?? 'unknown'),
          });
          return outbox.enqueue(event);
        },
      };
      return callback(manager, wrappedOutbox);
    },
    ...args.slice(1),
  ];
}

export function TraceOutboxTransaction(): MethodDecorator {
  return (_target, _propertyKey, descriptor) => {
    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    (descriptor as TypedPropertyDescriptor<(...args: unknown[]) => Promise<unknown>>).value = async function tracedOutboxTransaction(...args: unknown[]) {
      const tracer = trace.getTracer('nexusclaw-backend');
      const parentContext = context.active();
      const span = tracer.startSpan(
        'outbox.runInTransaction',
        { attributes: summarizeOutboxArgs(args) },
        parentContext,
      );

      return context.with(trace.setSpan(parentContext, span), async () => {
        try {
          const result = await original.apply(this, wrapOutboxCallback(args, span));
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
