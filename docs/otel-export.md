# Exporting the audit chain as OpenTelemetry traces

The sidecar can mirror completed/failed governed executions as OTLP/HTTP-JSON
traces using GenAI semantic-convention shapes — `invoke_agent` for the
execution, one `execute_tool` child span per tool call (with
`gen_ai.tool.name`, permission/guardrail check attributes), approval
decisions as span events. Zero new runtime dependencies: OTLP JSON is
emitted directly from the outbox event seam.

## Enable

```sh
SIDECAR_OTLP_ENDPOINT=http://localhost:4318 npx @agent-governance/sidecar
```

Any OTLP/HTTP receiver works. Failed exports keep the cursor and retry —
audit records are never silently dropped.

## Verify with Jaeger (all-in-one)

```sh
docker run --rm -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest
# then start the sidecar with SIDECAR_OTLP_ENDPOINT=http://localhost:4318
# run a governed task (e.g. via the console at :7899/console)
# open http://localhost:16686 — service "agent-governance" shows the trace:
#   invoke_agent ── execute_tool (memory__echo …)
#   with approval decisions as span events
```

## Langfuse

Langfuse ingests OTLP traces (see their OpenTelemetry documentation); point
`SIDECAR_OTLP_ENDPOINT` at your Langfuse OTLP endpoint. Governance spans
then sit next to your model traces in the same timeline.

## Wire-format e2e

The exporter's wire behavior is covered by
[`test/otel-exporter.spec.ts`](../governance/packages/sidecar/test/otel-exporter.spec.ts):
a local OTLP sink asserts the exact payload — resource `service.name`,
`invoke_agent` root span whose `traceId` equals the execution id, nested
`execute_tool` spans with `gen_ai.tool.name` and permission/guardrail
attributes.
