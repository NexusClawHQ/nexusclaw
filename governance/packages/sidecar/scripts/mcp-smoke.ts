/**
 * MCP gateway smoke (Phase D2): boots the sidecar in zero-config mode
 * (embedded Postgres + demo upstream) and walks the full governance loop over
 * real Streamable HTTP — handshake, tools/list (visibility-as-permission),
 * allow, blocked, L3 pause, console approval, proxy execution, audit chain.
 *
 * Usage: pnpm --filter @agent-governance/sidecar exec tsx scripts/mcp-smoke.ts
 * Exit code 0 = all checks passed.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = 7895;
const BASE = `http://127.0.0.1:${PORT}`;

function fail(message: string): never {
  throw new Error(message);
}

async function waitFor(text: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (logs.includes(text)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  fail(`timed out waiting for "${text}"`);
}

const child = spawn(process.execPath, [fileURLToPath(new URL('../dist/bin/sidecar.js', import.meta.url))], {
  env: { ...process.env, SIDECAR_PORT: String(PORT), SIDECAR_MCP_DEMO: 'memory' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout!.on('data', (chunk) => { logs += chunk; console.log(String(chunk).trimEnd()); });
child.stderr!.on('data', (chunk) => { logs += chunk; console.error(String(chunk).trimEnd()); });

try {
  await waitFor('SIDECAR_MCP_READY');

  const client = new Client({ name: 'mcp-smoke', version: '0.0.1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`)));

  const tools = (await client.listTools()).tools ?? [];
  const names = tools.map((tool) => tool.name);
  if (!['memory__echo', 'memory__send_notice', 'governance_pending__lookup'].every((name) => names.includes(name))) {
    fail(`tools/list missing granted tools: ${names.join(',')}`);
  }
  if (names.includes('memory__danger')) fail('ungranted memory__danger must be hidden');
  console.log('SMOKE_OK visibility (granted visible, danger hidden)');

  const echo = await client.callTool({ name: 'memory__echo', arguments: { text: 'smoke' } });
  if (!String((echo.content ?? [])[0]?.text ?? '').includes('echo:smoke')) fail('allow path broken');
  console.log('SMOKE_OK allow path');

  const danger = await client.callTool({ name: 'memory__danger', arguments: { path: 'x' } });
  if (danger.isError !== true) fail('blocked path must be isError');
  console.log('SMOKE_OK blocked path');

  const paused = await client.callTool({ name: 'memory__send_notice', arguments: { to: 'C-1', subject: 'smoke' } });
  const payload = JSON.parse(String((paused.content ?? [])[0]?.text ?? '{}'));
  if (payload.governance !== 'approval_pending') fail(`expected approval_pending, got ${payload.governance}`);
  console.log('SMOKE_OK L3 pause');

  const decide = await fetch(`${BASE}/approvals/${payload.approval_id}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision: 'APPROVED' }),
  });
  if (!decide.ok) fail('console approval failed');

  const lookup = await client.callTool({
    name: 'governance_pending__lookup',
    arguments: { approval_id: payload.approval_id },
  });
  if (!String((lookup.content ?? [])[0]?.text ?? '').includes('notice-sent#')) fail('proxy execution failed');
  console.log('SMOKE_OK approval -> proxy execution');

  const audit = await (await fetch(`${BASE}/audit/list`)).json();
  const statuses = audit.executions.map((execution: { status: string }) => execution.status);
  if (!statuses.includes('done') || !statuses.includes('failed')) fail(`audit chain incomplete: ${statuses.join(',')}`);
  console.log('SMOKE_OK audit chain');

  await client.close();
  console.log('SMOKE_PASS all governance paths verified over Streamable HTTP');
} catch (error) {
  console.error(`SMOKE_FAIL ${(error as Error).message}`);
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
}
