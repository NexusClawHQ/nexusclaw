import { OutboxEvent } from '@agent-governance/outbox';
import { AgentExecution, ToolCallRecord } from '@agent-governance/audit-chain';
import { ApprovalInstance } from '@agent-governance/approval';
import type { SidecarRuntime } from '../runtime.js';

/**
 * Optional OpenTelemetry exporter for the audit chain (Phase H, P1-4):
 * completed/failed executions are surfaced as OTLP/HTTP-JSON traces using
 * the GenAI semantic-convention shapes — `invoke_agent` for the execution,
 * one `execute_tool` child span per tool call, approval decisions as span
 * events. Zero new runtime dependencies: OTLP JSON is emitted directly.
 *
 * Enable with SIDECAR_OTLP_ENDPOINT (e.g. http://localhost:4318 for an
 * OTLP-capable collector such as Jaeger all-in-one). The seam is the outbox
 * event table — enabling the exporter changes nothing else.
 */

const TERMINAL_EVENTS = ['agent.execution.completed', 'agent.execution.failed'];

interface OtlpAttribute {
  key: string;
  value: { stringValue: string } | { intValue: number } | { boolValue: boolean };
}

interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpAttribute[];
  events?: Array<{ name: string; timeUnixNano: string; attributes: OtlpAttribute[] }>;
  status?: { code: number; message?: string };
}

function attr(key: string, value: string | number | boolean): OtlpAttribute {
  if (typeof value === 'string') return { key, value: { stringValue: value } };
  if (typeof value === 'number') return { key, value: { intValue: value } };
  return { key, value: { boolValue: value } };
}

function hex16(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 16);
}

function nanos(date: Date | null | undefined): string {
  return date ? String(date.getTime() * 1_000_000) : String(Date.now() * 1_000_000);
}

export interface AuditTraceInput {
  execution: Pick<AgentExecution, 'id' | 'agentId' | 'status' | 'createdAt' | 'completedAt' | 'rawInput'>;
  toolCalls: Array<Pick<ToolCallRecord, 'id' | 'toolName' | 'status' | 'permissionCheck' | 'guardrailCheck' | 'durationMs' | 'createdAt'>>;
  approvals?: Array<Pick<ApprovalInstance, 'id' | 'status' | 'submittedAt' | 'completedAt' | 'history'>>;
}

/** Pure mapper: audit-chain rows → one OTLP resourceSpans payload. */
export function buildAuditOtlpTrace(input: AuditTraceInput, serviceName = 'agent-governance'): unknown {
  const { execution, toolCalls, approvals } = input;
  const executionSpanId = hex16();

  const root: OtlpSpan = {
    traceId: execution.id.replaceAll('-', ''),
    spanId: executionSpanId,
    name: 'invoke_agent',
    kind: 1,
    startTimeUnixNano: nanos(execution.createdAt),
    endTimeUnixNano: nanos(execution.completedAt ?? new Date()),
    attributes: [
      attr('gen_ai.operation.name', 'invoke_agent'),
      attr('gen_ai.system', 'agent-governance'),
      attr('gen_ai.agent.id', execution.agentId),
      attr('agent_governance.execution.id', execution.id),
      attr('agent_governance.execution.status', execution.status),
    ],
    status: execution.status === 'failed' ? { code: 2, message: 'execution failed' } : { code: 1 },
  };

  for (const approval of approvals ?? []) {
    const decision = (approval.history ?? [])
      .filter((step) => step.action === 'APPROVED' || step.action === 'REJECTED')
      .map((step) => ({
        name: 'agent_governance.approval.decision',
        timeUnixNano: nanos(approval.completedAt),
        attributes: [
          attr('agent_governance.approval.id', approval.id),
          attr('agent_governance.approval.decision', step.action),
          attr('agent_governance.approval.actor', step.actorName ?? step.actorId ?? ''),
        ],
      }));
    root.events = [...(root.events ?? []), ...decision];
  }

  const spans: OtlpSpan[] = [root, ...toolCalls.map((call): OtlpSpan => ({
    traceId: execution.id.replaceAll('-', ''),
    spanId: hex16(),
    parentSpanId: executionSpanId,
    name: call.toolName,
    kind: 1,
    startTimeUnixNano: nanos(call.createdAt ?? execution.createdAt),
    endTimeUnixNano: nanos(new Date((call.createdAt?.getTime() ?? execution.createdAt.getTime()) + (call.durationMs ?? 0))),
    attributes: [
      attr('gen_ai.operation.name', 'execute_tool'),
      attr('gen_ai.tool.name', call.toolName),
      attr('agent_governance.tool.status', String(call.status ?? '')),
      attr('agent_governance.tool.permission_check', String(call.permissionCheck ?? '')),
      attr('agent_governance.tool.guardrail_check', String(call.guardrailCheck ?? '')),
    ],
    status: call.status === 'FAILED' || call.status === 'DENIED' || call.status === 'BLOCKED' ? { code: 2 } : { code: 1 },
  }))];

  return {
    resourceSpans: [{
      resource: {
        attributes: [
          attr('service.name', serviceName),
          attr('agent_governance.export', 'audit-chain'),
        ],
      },
      scopeSpans: [{
        scope: { name: 'agent-governance.audit', version: '0.1.0' },
        spans,
      }],
    }],
  };
}

export class OtelAuditExporter {
  private timer: ReturnType<typeof setInterval> | undefined;
  private cursor: Date | undefined;

  constructor(
    private readonly runtime: SidecarRuntime,
    private readonly options: { endpoint: string; serviceName?: string; intervalMs?: number },
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.options.intervalMs ?? 2000);
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.tick();
  }

  private async tick(): Promise<void> {
    const eventsRepo = this.runtime.dataSource.getRepository(OutboxEvent);
    const events = await eventsRepo.find({
      where: [{ eventType: 'agent.execution.completed' }, { eventType: 'agent.execution.failed' }],
      order: { createdAt: 'ASC' },
      take: 20,
    });
    const fresh = events.filter((event) => !this.cursor || event.createdAt > this.cursor);
    if (fresh.length === 0) return;

    for (const event of fresh) {
      const executionId = String((event.payload as { executionId?: string }).executionId ?? event.aggregateId);
      const execution = await this.runtime.dataSource.getRepository(AgentExecution).findOneBy({ id: executionId });
      if (!execution) continue;
      const toolCalls = await this.runtime.dataSource.getRepository(ToolCallRecord)
        .find({ where: { executionId } });
      const approvals = await this.runtime.dataSource.getRepository(ApprovalInstance)
        .find({ where: { recordId: executionId } });
      const body = buildAuditOtlpTrace({ execution, toolCalls, approvals }, this.options.serviceName);
      // A failed export keeps the cursor where it is, so the next tick
      // retries the same batch instead of silently dropping audit records.
      const response = await fetch(`${this.options.endpoint.replace(/\/$/, '')}/v1/traces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        console.error(`[otel-exporter] OTLP export failed (${response.status}); will retry`);
        return;
      }
    }
    this.cursor = fresh[fresh.length - 1]!.createdAt;
  }
}
