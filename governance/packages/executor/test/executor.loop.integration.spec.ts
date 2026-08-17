import 'reflect-metadata';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { DataSource, Repository } from 'typeorm';
import pg from 'pg';

import type { AgentTool, ChatRequest, ExecutorModelPort, ModelConfig } from '@agent-governance/contracts';
import {
  AgentExecution,
  ReactStep,
  ToolCallRecord,
  ToolCallLifecycleService,
} from '@agent-governance/audit-chain';
import { ApprovalEngineService, ApprovalInstance, ApprovalStep, ApprovalProcess, ApprovalPolicyRevisionEntity } from '@agent-governance/approval';
import { GuardrailEngineService, GuardrailRule, GuardrailLog, InMemoryRuleProvider } from '@agent-governance/guardrail';
import { OutboxService, OutboxEvent, InMemoryTransport } from '@agent-governance/outbox';
import { ToolAccessService } from '@agent-governance/permission';
import { ExecutorEngine, ToolRegistry } from '../src/index.js';

const HOST = process.env.EXEC_TEST_PGHOST ?? 'localhost';
const PORT = Number(process.env.EXEC_TEST_PGPORT ?? 5432);
const USER = process.env.EXEC_TEST_PGUSER ?? 'postgres';
const PASSWORD = process.env.EXEC_TEST_PGPASSWORD ?? 'postgres';
const DB = 'nexusclaw_exec_verify_tmp';
const WS = '00000000-0000-4000-8000-000000000001';
const AGENT = '20000000-0000-4000-8000-000000000001';

const LOOKUP = 'demo.customer_lookup';
const SEND = 'demo.send_followup_email';
const LOOKUP_MARKER = 'demo lookup result';
const SEND_MARKER = 'demo-dry-run';

const tools: AgentTool[] = [
  {
    name: LOOKUP,
    description: 'L1 lookup',
    category: 'crm',
    riskLevel: 'L1',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    requiredPermissions: {},
    execute: async () => ({
      success: true,
      output: { customerId: 'C-1', note: LOOKUP_MARKER },
      permissionCheck: 'passed' as const,
      guardrailCheck: 'passed' as const,
      duration: 1,
    }),
  },
  {
    name: SEND,
    description: 'L3 send',
    category: 'external',
    riskLevel: 'L3',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    requiredPermissions: {},
    execute: async () => ({
      success: true,
      output: { accepted: true, channel: SEND_MARKER },
      permissionCheck: 'passed' as const,
      guardrailCheck: 'passed' as const,
      duration: 1,
    }),
  },
];

/** Deterministic 3-phase scenario model (phase from result markers). */
class ScenarioModel implements ExecutorModelPort {
  private readonly model: ModelConfig = {
    tier: 1,
    modelId: 'scenario-v1',
    provider: 'test',
    inputCostPer1k: 0,
    outputCostPer1k: 0,
    maxTokens: 4096,
    supportsStreaming: false,
  };

  async chat(request: ChatRequest) {
    const transcript = JSON.stringify(request.messages);
    const seenLookup = transcript.includes(LOOKUP_MARKER);
    const seenSend = transcript.includes(SEND_MARKER);
    const action = !seenLookup
      ? { type: 'tool_call', toolName: LOOKUP, toolInput: { customerId: 'C-1' } }
      : !seenSend
        ? { type: 'tool_call', toolName: SEND, toolInput: { customerId: 'C-1', subject: 'hi' } }
        : { type: 'finish', generatePrompt: 'done' };
    return {
      content: JSON.stringify({
        thought: { reasoning: 'scenario', plan: 'phase', confidence: 1 },
        action,
      }),
      model: this.model.modelId,
      inputTokens: 1,
      outputTokens: 1,
      finishReason: 'stop',
      aiProviderStamp: {
        providerFamily: 'ai' as const,
        providerKind: 'test',
        modelId: this.model.modelId,
        modelTier: 1,
        resolutionSource: 'test_scenario',
      },
    };
  }
  selectModel(): ModelConfig { return this.model; }
  resolveCostModel(): ModelConfig { return this.model; }
  estimateCost(): number { return 0; }
}

describe('ExecutorEngine — governed closed loop (real Postgres)', () => {
  let admin: pg.Client;
  let dataSource: DataSource;
  let executions: Repository<AgentExecution>;
  let steps: Repository<ReactStep>;
  let instances: Repository<ApprovalInstance>;
  let stepRepo: Repository<ApprovalStep>;
  let outboxEvents: Repository<OutboxEvent>;
  let outboxTransport: InMemoryTransport;
  let engine: ExecutorEngine;

  beforeAll(async () => {
    admin = new pg.Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: 'postgres' });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${DB}`);
    await admin.query(`CREATE DATABASE ${DB}`);
    await admin.end();

    dataSource = new DataSource({
      type: 'postgres',
      host: HOST,
      port: PORT,
      username: USER,
      password: PASSWORD,
      database: DB,
      entities: [
        AgentExecution, ReactStep, ToolCallRecord,
        ApprovalInstance, ApprovalStep, ApprovalProcess, ApprovalPolicyRevisionEntity,
        GuardrailRule, GuardrailLog, OutboxEvent,
      ],
      synchronize: true,
    });
    await dataSource.initialize();
    executions = dataSource.getRepository(AgentExecution);
    steps = dataSource.getRepository(ReactStep);
    instances = dataSource.getRepository(ApprovalInstance);
    stepRepo = dataSource.getRepository(ApprovalStep);

    const guardrailRules = [
      {
        id: '30000000-0000-4000-8000-000000000001',
        workspaceId: WS,
        name: 'lookup L1',
        riskLevel: 'L1',
        priority: 1,
        isActive: true,
        conditions: { operation: LOOKUP },
      },
      {
        id: '30000000-0000-4000-8000-000000000002',
        workspaceId: WS,
        name: 'send L3',
        riskLevel: 'L3',
        priority: 2,
        isActive: true,
        conditions: { operation: SEND },
      },
    ] as GuardrailRule[];

    outboxTransport = new InMemoryTransport();
    const outbox = new OutboxService(dataSource, {
      getTraceContext: () => ({ traceId: 'trace-1', correlationId: 'corr-1' }),
      transport: outboxTransport,
    });
    const approval = new ApprovalEngineService(stepRepo, instances, {});
    const lifecycle = new ToolCallLifecycleService(dataSource.getRepository(ToolCallRecord));
    engine = new ExecutorEngine({
      executions,
      steps,
      lifecycle,
      approval,
      guardrail: new GuardrailEngineService(new InMemoryRuleProvider(guardrailRules)),
      outbox,
      model: new ScenarioModel(),
      registry: new ToolRegistry(),
      tools,
      toolAccess: new ToolAccessService(),
    });
  });

  afterAll(async () => {
    await dataSource.destroy();
    const cleanup = new pg.Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: 'postgres' });
    await cleanup.connect();
    await cleanup.query(`DROP DATABASE IF EXISTS ${DB}`);
    await cleanup.end();
  });

  it('runs the full governed loop: L1 proceeds, L3 pauses, approve resumes, finish', async () => {
    const execution = await engine.run({
      workspaceId: WS,
      agentId: AGENT,
      rawInput: '给客户发一封跟进邮件',
      allowedTools: [LOOKUP, SEND],
    });
    // Paused at the L3 gate with an approval instance and a paused outbox event
    expect(execution.status).toBe('guardrail_pending');
    const approvalRow = await instances.findOneByOrFail({ recordId: execution.id });
    expect(approvalRow.status).toBe('PENDING');
    expect(approvalRow.history[0]!.comments).toContain('__pausedToolCall__:');
    expect(outboxTransport.notifiedTopics).toContain('agent_events');

    // Approve → resume → tool executes once → finish
    await approvalRow.history; // (instance already loaded)
    await engine.resumePaused({
      executionId: execution.id,
      workspaceId: WS,
      approvalInstanceId: approvalRow.id,
      pausedToolCall: {
        toolName: SEND,
        toolInput: { customerId: 'C-1', subject: 'hi' },
        riskLevel: 'L3',
        description: 'send L3',
      },
    });

    const done = await executions.findOneByOrFail({ id: execution.id });
    expect(done.status).toBe('done');

    // Audit chain: steps contain lookup + send + finish
    const stepRows = await steps.find({ where: { executionId: execution.id }, order: { stepIndex: 'ASC' } });
    const toolNames = stepRows.map((s) => s.toolName).filter(Boolean);
    expect(toolNames).toContain(LOOKUP);
    expect(toolNames).toContain(SEND);
    expect(stepRows[stepRows.length - 1]!.actionType).toBe('finish');

    // tool_call_records: both SUCCEEDED
    const calls = await dataSource.getRepository(ToolCallRecord).find({
      where: { executionId: execution.id },
    });
    expect(calls.map((c) => c.toolName).sort()).toEqual([LOOKUP, SEND].sort());
    expect(calls.every((c) => c.status === 'SUCCEEDED')).toBe(true);
    expect(calls.every((c) => c.permissionCheck === 'passed')).toBe(true);
  });

  it('denies by default: tools not in the allow-list never run', async () => {
    const execution = await engine.run({
      workspaceId: WS,
      agentId: AGENT,
      rawInput: '尝试一个未授权工具',
      allowedTools: [], // deny by default
    });
    // The un-grantable tool exhausts the iteration budget — the run fails
    // honestly, no tool ever executes, and the denial is on the audit chain.
    expect(execution.status).toBe('failed');
    const calls = await dataSource.getRepository(ToolCallRecord).find({
      where: { executionId: execution.id },
    });
    expect(calls.length).toBe(0);
    const stepRows = await steps.find({ where: { executionId: execution.id } });
    expect(stepRows.some((s) => s.observationError?.includes('TOOL_NOT_ALLOWED'))).toBe(true);
  });
});
