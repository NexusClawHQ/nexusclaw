import 'reflect-metadata';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { DataSource, Repository } from 'typeorm';
import pg from 'pg';

import { ToolCallLifecycleService, ToolCallRecord, ToolCallStatus, AgentExecution, ReactStep } from '../src/index.js';
import type { AgentExecutionContext } from '@agent-governance/contracts';

const HOST = process.env.AUDIT_TEST_PGHOST ?? 'localhost';
const PORT = Number(process.env.AUDIT_TEST_PGPORT ?? 5432);
const USER = process.env.AUDIT_TEST_PGUSER ?? 'postgres';
const PASSWORD = process.env.AUDIT_TEST_PGPASSWORD ?? 'postgres';
const DB = 'nexusclaw_audit_verify_tmp';

const D = (character: string) => `sha256:${character.repeat(64)}` as const;

const EXECUTION_ID = '10000000-0000-4000-8000-000000000001';
const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';

const legacyContext = {
  executionId: EXECUTION_ID,
  workspaceId: WORKSPACE_ID,
  traceId: 'trace-1',
  correlationId: 'corr-1',
  security: { agentId: 'agent-1', roleId: 'role-1', objectPermissions: [], fieldMasks: [], dataScope: { type: 'own' }, sensitiveOps: [] },
  business: { intent: { type: 'task' }, relatedRecords: [], conversationHistory: [], userPreferences: {} },
  knowledge: { relevantSOPs: [], domainKnowledge: [], companyPolicies: [] },
  constraints: { maxTokens: 4096, maxOutputTokensPerStep: 512, maxStepTokens: 1024, timeoutMs: 60000, maxToolCalls: 4, allowedTools: [], maxReActIterations: 4, maxToolRetryAttempts: 0, toolRetryBackoffMs: 0, sensitiveOps: [] },
  dataAccessContext: { userId: 'user-1', roleId: 'role-1', workspaceId: WORKSPACE_ID },
} as AgentExecutionContext;

describe('ToolCallLifecycleService (real Postgres)', () => {
  let admin: pg.Client;
  let dataSource: DataSource;
  let records: Repository<ToolCallRecord>;
  let service: ToolCallLifecycleService;

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
      entities: [AgentExecution, ReactStep, ToolCallRecord],
      synchronize: true,
    });
    await dataSource.initialize();
    // The tool_call_records FK references agent_executions; seed one so the
    // lifecycle integration can write real rows.
    await dataSource.getRepository(AgentExecution).insert({
      id: EXECUTION_ID,
      workspaceId: WORKSPACE_ID,
      agentId: '20000000-0000-4000-8000-000000000001',
      triggerType: 'manual',
      triggerSource: 'api',
      status: 'running',
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
    });
    records = dataSource.getRepository(ToolCallRecord);
    service = new ToolCallLifecycleService(records);
  });

  afterAll(async () => {
    await dataSource.destroy();
    const cleanup = new pg.Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: 'postgres' });
    await cleanup.connect();
    await cleanup.query(`DROP DATABASE IF EXISTS ${DB}`);
    await cleanup.end();
  });

  it('begin persists a STARTED row with a redacted input preview', async () => {
    const call = await service.begin({
      toolName: 'demo.send_email',
      toolCategory: 'external',
      input: { customerId: 'C-1', body: 'sk-abcdef1234567890' },
      context: legacyContext,
    });
    expect(call.status).toBe(ToolCallStatus.STARTED);
    expect(call.toolName).toBe('demo.send_email');
    expect(call.inputDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    // body is a string containing credential-shaped content -> scrubbed
    expect(JSON.stringify(call.input)).not.toContain('sk-abcdef1234567890');
  });

  it('derives a stable input digest independent of redaction', () => {
    const digest = service.deriveInputDigest({ a: 1, b: [true, 'x'] });
    expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(service.deriveInputDigest({ a: 1, b: [true, 'x'] })).toBe(digest);
  });

  it('transition denies with permission verdict recorded', async () => {
    const call = await service.begin({
      toolName: 'demo.delete',
      toolCategory: 'crm',
      input: { id: 'r-1' },
      context: legacyContext,
    });
    await service.transition(call.id, [ToolCallStatus.STARTED], ToolCallStatus.DENIED, {
      permissionCheck: 'denied',
      permissionDetail: 'OBJECT_PERMISSION_MISSING',
      guardrailCheck: 'blocked',
      errorCode: 'OBJECT_PERMISSION_MISSING',
      durationMs: 3,
    });
    const row = await records.findOneByOrFail({ id: call.id });
    expect(row.status).toBe(ToolCallStatus.DENIED);
    expect(row.permissionCheck).toBe('denied');
    expect(row.guardrailCheck).toBe('blocked');
  });

  it('finalize records output digest and redacted preview', async () => {
    const call = await service.begin({
      toolName: 'demo.lookup',
      toolCategory: 'crm',
      input: { customerId: 'C-1' },
      context: legacyContext,
    });
    await service.finalize(call.id, {
      status: ToolCallStatus.SUCCEEDED,
      output: { customerId: 'C-1', email: 'owner@example.com' },
      permissionCheck: 'passed',
      guardrailCheck: 'passed',
      durationMs: 5,
    });
    const row = await records.findOneByOrFail({ id: call.id });
    expect(row.status).toBe(ToolCallStatus.SUCCEEDED);
    expect(row.outputDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    // email pattern scrubbed from the persisted preview
    expect(JSON.stringify(row.output)).not.toContain('owner@example.com');
  });

  it('markRunning and heartbeat extend the lease', async () => {
    const call = await service.begin({
      toolName: 'demo.long',
      toolCategory: 'internal',
      input: {},
      context: legacyContext,
    });
    await service.markRunning(call.id, 120_000);
    await service.heartbeat(call.id);
    const row = await records.findOneByOrFail({ id: call.id });
    expect(row.status).toBe(ToolCallStatus.RUNNING);
    expect(row.leaseExpiresAt).toBeInstanceOf(Date);
  });
});
