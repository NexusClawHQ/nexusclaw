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

export type SidecarStorageMode = 'postgres' | 'memory' | 'local';

export interface SidecarRuntime {
  engine: ExecutorEngine;
  gate: GateService;
  approvals: ReturnType<typeof buildApprovalAccess>;
  dataSource: DataSource;
  outboxTransport: InMemoryTransport;
  storage: SidecarStorageMode;
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
  /** Extra workspace guardrail rules (e.g. the MCP demo L3 rule). */
  extraGuardrailRules?: GuardrailRule[];
  /**
   * Storage mode. `postgres` (default — today's behavior, env-configurable)
   * | `memory` (embedded Postgres via PGlite, in-memory, eval/demo) |
   * `local` (PGlite persisted to localDataDir). The audit-chain schema is
   * byte-identical across modes because every mode runs real Postgres.
   */
  storage?: SidecarStorageMode;
  /** Directory for `local` mode (default: ./.agent-governance-data). */
  localDataDir?: string;
}): Promise<SidecarRuntime> {
  const workspaceId = options.workspaceId ?? DEMO_WORKSPACE_ID;
  const agentId = options.agentId ?? DEMO_AGENT_ID;

  const storage: SidecarStorageMode =
    options.storage ?? (process.env.SIDECAR_STORAGE as SidecarStorageMode) ?? 'postgres';
  const entities = [
    AgentExecution, ReactStep, ToolCallRecord,
    ApprovalInstance, ApprovalStep, ApprovalProcess, ApprovalPolicyRevisionEntity,
    GuardrailRule, GuardrailLog, OutboxEvent,
  ];

  let dataSource: DataSource;
  let embedded: { server: { stop(): Promise<void> }; pg: { close(): Promise<void> } } | undefined;
  if (storage === 'memory' || storage === 'local') {
    // Zero-provision modes: a real Postgres (PGlite/WASM) served on a local
    // socket — same engine family as production, so the audit chain keeps
    // the exact same schema and semantics.
    const { PGlite } = await import('@electric-sql/pglite');
    const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
    const dataDir = options.localDataDir
      ?? process.env.SIDECAR_STORAGE_LOCAL_DIR
      ?? (storage === 'local' ? '.agent-governance-data' : undefined);
    const pg = dataDir ? new PGlite(dataDir) : new PGlite();
    const server = new PGLiteSocketServer({ db: pg, port: 0, host: '127.0.0.1' });
    let address = { host: '127.0.0.1', port: 0 };
    server.addEventListener('listening', (event) => {
      address = (event as CustomEvent<{ host: string; port: number }>).detail;
    });
    await server.start();
    // TypeORM's `PrimaryGeneratedColumn('uuid')` emits a uuid_generate_v4()
    // default; PGlite's core only ships gen_random_uuid() (PG13+), so shim
    // the legacy name before schema sync.
    await pg.query(
      'create or replace function uuid_generate_v4() returns uuid as $$ select gen_random_uuid() $$ language sql',
    );
    embedded = { server, pg };
    dataSource = new DataSource({
      type: 'postgres',
      host: address.host,
      port: address.port,
      username: 'postgres',
      password: 'postgres',
      database: 'pglite',
      entities,
      synchronize: true,
    });
  } else {
    dataSource = new DataSource({
      type: 'postgres',
      host: options.host ?? process.env.SIDECAR_PGHOST ?? 'localhost',
      port: options.port ?? Number(process.env.SIDECAR_PGPORT ?? 5432),
      username: options.user ?? process.env.SIDECAR_PGUSER ?? 'postgres',
      password: options.password ?? process.env.SIDECAR_PGPASSWORD ?? 'postgres',
      database: options.database ?? process.env.SIDECAR_PGDATABASE ?? 'nexusclaw_sidecar',
      entities,
      synchronize: true,
    });
  }
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
    ...(options.extraGuardrailRules ?? []),
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
    storage,
    async close() {
      await dataSource.destroy();
      if (embedded) {
        await embedded.server.stop();
        await embedded.pg.close();
      }
    },
  };
}
