import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { AgentExecution, ToolCallRecord } from '@agent-governance/audit-chain';
import type { GuardrailRule } from '@agent-governance/guardrail';
import { buildSidecarRuntime, DEMO_WORKSPACE_ID, type SidecarRuntime } from '../src/runtime.js';

const HOST = process.env.SIDECAR_PGHOST ?? 'localhost';
const PORT = Number(process.env.SIDECAR_PGPORT ?? 5432);
const USER = process.env.SIDECAR_PGUSER ?? 'postgres';
const PASSWORD = process.env.SIDECAR_PGPASSWORD ?? 'postgres';
const DB = 'nexusclaw_storage_verify_tmp';

const L3_RULE: GuardrailRule = {
  id: '30000000-0000-4000-8000-000000000004',
  workspaceId: DEMO_WORKSPACE_ID,
  name: 'storage-test send — requires human approval',
  riskLevel: 'L3',
  priority: 4,
  isActive: true,
  conditions: { operation: 'storage.send' },
};

async function runScenario(runtime: SidecarRuntime) {
  const allow = await runtime.gate.gate({ toolName: 'storage.echo', toolInput: { args: ['hi'] } });
  await runtime.gate.complete(allow.executionId, { success: true, output: 'done' });
  const paused = await runtime.gate.gate({ toolName: 'storage.send', toolInput: { args: ['x'] } });
  const execution = await runtime.dataSource.getRepository(AgentExecution).findOneByOrFail({ id: paused.executionId });
  const calls = await runtime.dataSource.getRepository(ToolCallRecord).find({ order: { createdAt: 'ASC' } });
  return {
    allowDecision: allow.decision,
    pausedDecision: paused.decision,
    executionStatusAfterPause: execution.status,
    toolCalls: calls.map((c) => ({
      toolName: c.toolName,
      status: c.status,
      permissionCheck: c.permissionCheck,
      guardrailCheck: c.guardrailCheck,
    })),
  };
}

let postgresRuntime: SidecarRuntime;
let memoryRuntime: SidecarRuntime;

beforeAll(async () => {
  const admin = new pg.Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: 'postgres' });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DB}`);
  await admin.query(`CREATE DATABASE ${DB}`);
  await admin.end();

  const options = {
    gateAllowedTools: ['storage.echo', 'storage.send'],
    extraGuardrailRules: [L3_RULE],
  };
  postgresRuntime = await buildSidecarRuntime({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: DB, ...options });
  memoryRuntime = await buildSidecarRuntime({ storage: 'memory' as const, ...options });
}, 120_000);

afterAll(async () => {
  await memoryRuntime.close().catch(() => undefined);
  await postgresRuntime.close().catch(() => undefined);
  const admin = new pg.Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: 'postgres' });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DB}`);
  await admin.end();
});

describe('storage modes (Phase F)', () => {
  it('memory mode produces the same audit-chain structure as postgres (AC-6.2)', async () => {
    const fromPostgres = await runScenario(postgresRuntime);
    const fromMemory = await runScenario(memoryRuntime);

    expect(fromMemory.allowDecision).toBe('allow');
    expect(fromMemory.pausedDecision).toBe('paused');
    expect(fromMemory.executionStatusAfterPause).toBe('guardrail_pending');
    expect(fromMemory).toEqual(fromPostgres);
  });

  it('memory mode needs no provisioned Postgres (AC-6.1 precondition)', () => {
    expect(memoryRuntime.storage).toBe('memory');
  });

  it('local mode persists the audit chain across restarts (AC-6.2)', async () => {
    const dir = `/tmp/ag-storage-local-${Date.now()}`;
    const first = await buildSidecarRuntime({
      storage: 'local',
      localDataDir: dir,
      gateAllowedTools: ['storage.echo'],
    });
    const allow = await first.gate.gate({ toolName: 'storage.echo', toolInput: {} });
    await first.gate.complete(allow.executionId, { success: true, output: 'persisted' });
    await first.close();

    const second = await buildSidecarRuntime({
      storage: 'local',
      localDataDir: dir,
      gateAllowedTools: ['storage.echo'],
    });
    const rows = await second.dataSource.getRepository(AgentExecution).find();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((row) => row.id === allow.executionId && row.status === 'done')).toBe(true);
    await second.close();
  }, 120_000);
});
