/**
 * Sidecar end-to-end verifier — the library's own `pnpm verify` closed loop.
 *
 * Boots the sidecar runtime + HTTP server against a scratch Postgres database
 * and walks the governed scenario over HTTP:
 *   POST /executions (L1 proceeds, L3 pauses)
 *   GET  /approvals/pending
 *   POST /approvals/:id/decide APPROVED
 *   GET  /executions/:id  (status done, steps, tool calls)
 *   GET  /audit/list
 *   GET  /console
 *
 * Requires a reachable Postgres (same env contract as the integration tests:
 * SIDECAR_PGHOST/PORT/USER/PASSWORD or defaults localhost:5432 postgres/postgres).
 */
import 'reflect-metadata';
import pg from 'pg';
import { buildSidecarRuntime } from '../src/runtime.js';
import { createSidecarServer } from '../src/server.js';

const HOST = process.env.SIDECAR_PGHOST ?? 'localhost';
const PORT = Number(process.env.SIDECAR_PGPORT ?? 5432);
const USER = process.env.SIDECAR_PGUSER ?? 'postgres';
const PASSWORD = process.env.SIDECAR_PGPASSWORD ?? 'postgres';
const DB = 'nexusclaw_sidecar_verify_tmp';

async function main(): Promise<void> {
  const admin = new pg.Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: 'postgres' });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DB}`);
  await admin.query(`CREATE DATABASE ${DB}`);
  await admin.end();

  const runtime = await buildSidecarRuntime({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: DB });
  const server = createSidecarServer(runtime);
  const { url, close } = await server.listen(0);
  try {
    const get = async (path: string) => {
      const res = await fetch(url + path);
      return res.json();
    };
    const post = async (path: string, body: unknown) => {
      const res = await fetch(url + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return res.json();
    };

    // 0. console shell
    const consoleRes = await fetch(url + '/console');
    if (consoleRes.status !== 200 || !(await consoleRes.text()).includes('agent-governance sidecar console')) {
      throw new Error('console shell missing');
    }
    console.log('STEP0 console-shell: ok');

    // 1. run -> paused at the L3 gate
    const run = await post('/executions', { input: '给客户发一封跟进邮件' });
    if (run.status !== 'guardrail_pending') throw new Error(`expected guardrail_pending, got ${run.status}`);
    console.log('STEP1 execute-paused: ok');

    // 2. pending approval
    const pending = await get('/approvals/pending');
    const mine = (pending.approvals ?? []).find((a: { executionId: string }) => a.executionId === run.executionId);
    if (!mine) throw new Error('no pending approval');
    if (mine.pausedToolCall?.toolName !== 'demo.send_followup_email') {
      throw new Error('unexpected paused tool: ' + JSON.stringify(mine.pausedToolCall));
    }
    console.log('STEP2 pending-approval: ' + mine.pausedToolCall.toolName + ' ' + mine.pausedToolCall.riskLevel);

    // 3. approve -> resume -> done
    const decided = await post(`/approvals/${mine.id}/decide`, { decision: 'APPROVED' });
    if (decided.executionStatus !== 'done') throw new Error(`expected done, got ${decided.executionStatus}`);
    console.log('STEP3 approve-resume: done');

    // 4. audit chain: execution + steps + tool calls
    const detail = await get(`/executions/${run.executionId}`);
    const toolNames = (detail.toolCalls ?? []).map((c: { toolName: string }) => c.toolName);
    if (!toolNames.includes('demo.customer_lookup') || !toolNames.includes('demo.send_followup_email')) {
      throw new Error('audit chain missing tool calls: ' + JSON.stringify(toolNames));
    }
    if (!(detail.toolCalls ?? []).every((c: { status: string }) => c.status === 'SUCCEEDED')) {
      throw new Error('not all tool calls succeeded');
    }
    const stepTypes = (detail.steps ?? []).map((s: { actionType: string }) => s.actionType);
    if (!stepTypes.includes('finish')) throw new Error('missing finish step');
    console.log('STEP4 audit-chain: steps=' + (detail.steps ?? []).length + ' toolCalls=' + (detail.toolCalls ?? []).length);

    // 5. audit list + reject path
    const list = await get('/audit/list');
    if (!(list.executions ?? []).some((e: { id: string }) => e.id === run.executionId)) {
      throw new Error('execution missing from audit list');
    }
    const run2 = await post('/executions', { input: '再来一封' });
    const pending2 = await get('/approvals/pending');
    const mine2 = (pending2.approvals ?? []).find((a: { executionId: string }) => a.executionId === run2.executionId);
    if (!mine2) throw new Error('no second pending approval');
    const rejected = await post(`/approvals/${mine2.id}/decide`, { decision: 'REJECTED' });
    if (rejected.executionStatus !== 'cancelled') throw new Error(`expected cancelled, got ${rejected.executionStatus}`);
    console.log('STEP5 audit-list + reject-path: ok');

    console.log('LOOP-RESULT: PASS');
  } finally {
    await close();
    await runtime.close();
    const cleanup = new pg.Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: 'postgres' });
    await cleanup.connect();
    await cleanup.query(`DROP DATABASE IF EXISTS ${DB}`);
    await cleanup.end();
  }
}

main().catch((error) => {
  console.error('LOOP-RESULT: FAIL —', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
