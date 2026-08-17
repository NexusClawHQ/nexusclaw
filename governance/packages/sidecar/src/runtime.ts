import { DataSource } from 'typeorm';
import {
  AgentExecution,
  ReactStep,
  ToolCallRecord,
  ToolCallLifecycleService,
} from '@agent-governance/audit-chain';
import {
  ApprovalEngineService,
  ApprovalInstance,
  ApprovalStep,
  ApprovalProcess,
  ApprovalPolicyRevisionEntity,
} from '@agent-governance/approval';
import {
  GuardrailEngineService,
  GuardrailRule,
  GuardrailLog,
  InMemoryRuleProvider,
} from '@agent-governance/guardrail';
import { OutboxService, OutboxEvent, InMemoryTransport } from '@agent-governance/outbox';
import { ToolAccessService } from '@agent-governance/permission';
import { ExecutorEngine, ToolRegistry } from '@agent-governance/executor';
import { GateService } from './gate.js';
import { DEMO_TOOLS } from './demo-tools.js';
import { ScenarioModel, TOOL_LOOKUP, TOOL_SEND } from './scenario-model.js';

export const DEMO_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
export const DEMO_AGENT_ID = '20000000-0000-4000-8000-000000000001';

export interface SidecarRuntime {
  engine: ExecutorEngine;
  gate: GateService;
  approvals: ReturnType<typeof buildApprovalAccess>;
  dataSource: DataSource;
  outboxTransport: InMemoryTransport;
  close(): Promise<void>;
}

function buildApprovalAccess(dataSource: DataSource) {
  return {
    pending: async (workspaceId: string) => {
      const rows = await dataSource.getRepository(ApprovalInstance).find({
        where: { workspaceId, status: 'PENDING' },
        order: { submittedAt: 'ASC' },
      });
      return rows;
    },
    decide: async (instanceId: string, decision: 'APPROVED' | 'REJECTED', comment?: string) => {
      const instance = await dataSource.getRepository(ApprovalInstance).findOneByOrFail({ id: instanceId });
      return { instance, decision, comment };
    },
  };
}

/**
 * Build the sidecar runtime: TypeORM over the configured Postgres, the demo
 * tools + guardrail rules, and the governed executor with the deterministic
 * scenario model. synchronize:true is acceptable for the local demo service
 * (the library itself never owns schema migrations).
 */
export async function buildSidecarRuntime(options: {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  workspaceId?: string;
  agentId?: string;
  /**
   * Server-side grant list for the per-call governance gate
   * (POST /gate). Deny by default; also configurable via
   * SIDECAR_GATE_ALLOWED_TOOLS (comma-separated).
   */
  gateAllowedTools?: string[];
}): Promise<SidecarRuntime> {
  const workspaceId = options.workspaceId ?? DEMO_WORKSPACE_ID;
  const agentId = options.agentId ?? DEMO_AGENT_ID;

  const dataSource = new DataSource({
    type: 'postgres',
    host: options.host ?? process.env.SIDECAR_PGHOST ?? 'localhost',
    port: options.port ?? Number(process.env.SIDECAR_PGPORT ?? 5432),
    username: options.user ?? process.env.SIDECAR_PGUSER ?? 'postgres',
    password: options.password ?? process.env.SIDECAR_PGPASSWORD ?? 'postgres',
    database: options.database ?? process.env.SIDECAR_PGDATABASE ?? 'nexusclaw_sidecar',
    entities: [
      AgentExecution, ReactStep, ToolCallRecord,
      ApprovalInstance, ApprovalStep, ApprovalProcess, ApprovalPolicyRevisionEntity,
      GuardrailRule, GuardrailLog, OutboxEvent,
    ],
    synchronize: true,
  });
  await dataSource.initialize();

  const guardrailRules = [
    {
      id: '30000000-0000-4000-8000-000000000001',
      workspaceId,
      name: 'Customer lookup — audited',
      riskLevel: 'L1',
      priority: 1,
      isActive: true,
      conditions: { operation: TOOL_LOOKUP },
    },
    {
      id: '30000000-0000-4000-8000-000000000002',
      workspaceId,
      name: 'Outbound follow-up email — requires human approval',
      riskLevel: 'L3',
      priority: 2,
      isActive: true,
      conditions: { operation: TOOL_SEND },
    },
  ] as GuardrailRule[];

  const outboxTransport = new InMemoryTransport();
  const outbox = new OutboxService(dataSource, {
    getTraceContext: () => ({ traceId: 'sidecar', correlationId: 'sidecar' }),
    transport: outboxTransport,
  });
  const approval = new ApprovalEngineService(
    dataSource.getRepository(ApprovalStep),
    dataSource.getRepository(ApprovalInstance),
    {},
  );
  const engine = new ExecutorEngine({
    executions: dataSource.getRepository(AgentExecution),
    steps: dataSource.getRepository(ReactStep),
    lifecycle: new ToolCallLifecycleService(dataSource.getRepository(ToolCallRecord)),
    approval,
    guardrail: new GuardrailEngineService(new InMemoryRuleProvider(guardrailRules)),
    outbox,
    model: new ScenarioModel(),
    registry: new ToolRegistry(),
    tools: DEMO_TOOLS,
    toolAccess: new ToolAccessService(),
  });

  const gateAllowedTools =
    options.gateAllowedTools ??
    (process.env.SIDECAR_GATE_ALLOWED_TOOLS ?? '')
      .split(',')
      .map((tool) => tool.trim())
      .filter(Boolean);

  const gate = new GateService({
    executions: dataSource.getRepository(AgentExecution),
    lifecycle: new ToolCallLifecycleService(dataSource.getRepository(ToolCallRecord)),
    approval,
    guardrail: new GuardrailEngineService(new InMemoryRuleProvider(guardrailRules)),
    outbox,
    toolAccess: new ToolAccessService(),
    workspaceId,
    agentId,
    allowedTools: gateAllowedTools,
  });

  return {
    engine,
    gate,
    approvals: buildApprovalAccess(dataSource),
    dataSource,
    outboxTransport,
    async close() {
      await dataSource.destroy();
    },
  };
}
