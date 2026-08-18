import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { buildSidecarRuntime, type SidecarRuntime } from '../src/runtime.js';
import { OtelAuditExporter } from '../src/otel/otel-audit-exporter.js';

let runtime: SidecarRuntime;
let exporter: OtelAuditExporter;
let sinkUrl: string;
const received: Array<{ path: string; body: any }> = [];
const sink = createServer((req, res) => {
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    received.push({ path: req.url ?? '', body: JSON.parse(raw) });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{}');
  });
});

beforeAll(async () => {
  await new Promise<void>((resolve) => sink.listen(0, '127.0.0.1', () => resolve()));
  sinkUrl = `http://127.0.0.1:${(sink.address() as AddressInfo).port}`;

  runtime = await buildSidecarRuntime({ storage: 'memory', gateAllowedTools: ['otel.echo'] });
  exporter = new OtelAuditExporter(runtime, { endpoint: sinkUrl, intervalMs: 200 });
}, 60_000);

afterAll(async () => {
  await exporter.stop().catch(() => undefined);
  await runtime.close().catch(() => undefined);
  await new Promise<void>((resolve) => sink.close(() => resolve()));
});

function findAttribute(span: any, key: string): string | undefined {
  return (span.attributes ?? []).find((a: any) => a.key === key)?.value?.stringValue;
}

describe('OTel audit exporter (Phase H)', () => {
  it('exports a completed gated execution as an OTLP trace with GenAI semconv shapes', async () => {
    const allow = await runtime.gate.gate({ toolName: 'otel.echo', toolInput: { args: ['x'] } });
    await runtime.gate.complete(allow.executionId, { success: true, output: 'ok' });

    exporter.start();
    const deadline = Date.now() + 8000;
    while (received.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received[0]!.path).toBe('/v1/traces');

    const { resourceSpans } = received[0]!.body;
    const resource = resourceSpans[0].resource.attributes.find((a: any) => a.key === 'service.name');
    expect(resource.value.stringValue).toBe('agent-governance');

    const spans: any[] = resourceSpans[0].scopeSpans[0].spans;
    const root = spans.find((s) => s.name === 'invoke_agent');
    const tool = spans.find((s) => findAttribute(s, 'gen_ai.operation.name') === 'execute_tool');

    expect(root).toBeTruthy();
    expect(findAttribute(root, 'gen_ai.operation.name')).toBe('invoke_agent');
    expect(findAttribute(root, 'gen_ai.agent.id')).toBeTruthy();
    expect(root.traceId).toBe(allow.executionId.replaceAll('-', ''));
    expect(root.traceId).toMatch(/^[0-9a-f]{32}$/);

    expect(tool).toBeTruthy();
    expect(findAttribute(tool, 'gen_ai.tool.name')).toBe('otel.echo');
    expect(findAttribute(tool, 'agent_governance.tool.permission_check')).toBe('passed');
    expect(tool.parentSpanId).toBe(root.spanId);
    expect(tool.traceId).toBe(root.traceId);
  }, 20_000);
});
