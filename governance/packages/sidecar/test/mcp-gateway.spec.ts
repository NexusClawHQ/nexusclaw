import 'reflect-metadata';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import {
  AgentExecution,
  ToolCallRecord,
} from '@agent-governance/audit-chain';
import type { GuardrailRule } from '@agent-governance/guardrail';
import { buildSidecarRuntime, DEMO_WORKSPACE_ID } from '../src/runtime.js';
import { createSidecarServer } from '../src/server.js';
import { createMcpGateway, decideApproval, PENDING_LOOKUP_TOOL } from '../src/mcp/gateway.js';
import { buildMemoryDemoUpstream } from '../src/mcp/memory-upstream.js';

const HOST = process.env.SIDECAR_PGHOST ?? 'localhost';
const PORT = Number(process.env.SIDECAR_PGPORT ?? 5432);
const USER = process.env.SIDECAR_PGUSER ?? 'postgres';
const PASSWORD = process.env.SIDECAR_PGPASSWORD ?? 'postgres';
const DB = 'nexusclaw_mcp_gw_verify_tmp';

const ALLOWED = ['memory__echo', 'memory__counter', 'memory__send_notice', PENDING_LOOKUP_TOOL];

const L3_RULE: GuardrailRule = {
  id: '30000000-0000-4000-8000-000000000003',
  workspaceId: DEMO_WORKSPACE_ID,
  name: 'MCP demo send_notice — requires human approval',
  riskLevel: 'L3',
  priority: 3,
  isActive: true,
  conditions: { operation: 'memory__send_notice' },
};

let runtime: Awaited<ReturnType<typeof buildSidecarRuntime>>;
let client: Client;

function textOf(result: { content?: Array<{ type: string; text?: string }> }): string {
  return (result.content ?? []).map((part) => part.text ?? '').join('\n');
}

function jsonOf(result: { content?: Array<{ type: string; text?: string }> }): Record<string, unknown> {
  return JSON.parse(textOf(result)) as Record<string, unknown>;
}

beforeAll(async () => {
  const admin = new pg.Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: 'postgres' });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DB}`);
  await admin.query(`CREATE DATABASE ${DB}`);
  await admin.end();

  runtime = await buildSidecarRuntime({
    host: HOST, port: PORT, user: USER, password: PASSWORD, database: DB,
    gateAllowedTools: ALLOWED,
    extraGuardrailRules: [L3_RULE],
  });

  const gateway = await createMcpGateway({
    runtime,
    upstreams: [await buildMemoryDemoUpstream()],
    allowedTools: ALLOWED,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await gateway.createServer().connect(serverTransport);
  client = new Client({ name: 'gateway-e2e-client', version: '0.0.1' });
  await client.connect(clientTransport);
}, 60_000);

afterAll(async () => {
  await client.close().catch(() => undefined);
  await runtime.close().catch(() => undefined);
  const admin = new pg.Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: 'postgres' });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DB}`);
  await admin.end();
});

async function executionStatus(executionId: string): Promise<string> {
  const row = await runtime.dataSource.getRepository(AgentExecution).findOneByOrFail({ id: executionId });
  return row.status;
}

describe('MCP governance gateway', () => {
  it('aggregates downstream tools with namespacing and hides ungranted ones (AC-1.1/1.3/2.1)', async () => {
    const listed = await client.listTools();
    const names = (listed.tools ?? []).map((tool) => tool.name);
    expect(names).toContain('memory__echo');
    expect(names).toContain('memory__counter');
    expect(names).toContain('memory__send_notice');
    expect(names).toContain(PENDING_LOOKUP_TOOL);
    expect(names).not.toContain('memory__danger');
  });

  it('allow path: L0/L1 calls are forwarded, audited and faithfully returned (AC-1.2/2.2)', async () => {
    const result = await client.callTool({ name: 'memory__echo', arguments: { text: 'hello-gov' } });
    expect(textOf(result as never)).toBe('echo:hello-gov');
    expect((result as { isError?: boolean }).isError).toBeUndefined();

    const calls = await runtime.dataSource.getRepository(ToolCallRecord)
      .find({ where: { toolName: 'memory__echo' }, order: { createdAt: 'DESC' }, take: 1 });
    expect(calls[0]?.permissionCheck).toBe('passed');
    expect(calls[0]?.status).toBe('SUCCEEDED');
  });

  it('blocked path: an ungranted direct call is denied, structured and audited (AC-2.1)', async () => {
    const result = await client.callTool({ name: 'memory__danger', arguments: { path: '/tmp/x' } });
    expect((result as { isError?: boolean }).isError).toBe(true);
    const payload = jsonOf(result as never);
    expect(payload.governance).toBe('blocked');
    expect(String(payload.reason)).toContain('TOOL_NOT_ALLOWED');

    const calls = await runtime.dataSource.getRepository(ToolCallRecord)
      .find({ where: { toolName: 'memory__danger' }, order: { createdAt: 'DESC' }, take: 1 });
    expect(calls[0]?.permissionCheck).toBe('denied');
  });

  it('pending fallback: L3 pauses with a structured result, approval proxies execution (AC-2.3/2.4)', async () => {
    const paused = await client.callTool({
      name: 'memory__send_notice',
      arguments: { to: 'C-1001', subject: 'quarterly check-in' },
    });
    expect((paused as { isError?: boolean }).isError).toBeUndefined();
    const payload = jsonOf(paused as never);
    expect(payload.governance).toBe('approval_pending');
    const approvalId = String(payload.approval_id);
    const executionId = String(payload.execution_id);
    expect(approvalId).toBeTruthy();

    await expect(executionStatus(executionId)).resolves.toBe('guardrail_pending');

    await decideApproval(runtime, approvalId, 'APPROVED', 'e2e-approver');

    const fetched = await client.callTool({ name: PENDING_LOOKUP_TOOL, arguments: { approval_id: approvalId } });
    expect(textOf(fetched as never)).toContain('notice-sent#');
    expect(textOf(fetched as never)).toContain('to=C-1001');
    await expect(executionStatus(executionId)).resolves.toBe('done');
  });

  it('pending fallback: rejection never executes the original call (AC-2.4)', async () => {
    const paused = await client.callTool({
      name: 'memory__send_notice',
      arguments: { to: 'C-2002', subject: 'should-not-send' },
    });
    const payload = jsonOf(paused as never);
    const approvalId = String(payload.approval_id);
    const executionId = String(payload.execution_id);

    await decideApproval(runtime, approvalId, 'REJECTED', 'e2e-approver');

    const fetched = await client.callTool({ name: PENDING_LOOKUP_TOOL, arguments: { approval_id: approvalId } });
    expect((fetched as { isError?: boolean }).isError).toBe(true);
    expect(jsonOf(fetched as never).governance).toBe('approval_rejected');
    await expect(executionStatus(executionId)).resolves.toBe('cancelled');
  });

  it('elicitation branch: an elicitation-capable client approves in-request and completes in one turn (AC-2.3)', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const gateway = await createMcpGateway({
      runtime,
      upstreams: [await buildMemoryDemoUpstream()],
      allowedTools: ALLOWED,
    });
    await gateway.createServer().connect(serverTransport);
    const eliciting = new Client({ name: 'elicitation-client', version: '0.0.1' });
    eliciting.registerCapabilities({ elicitation: {} });
    eliciting.setRequestHandler(ElicitRequestSchema, async () => ({
      action: 'accept' as const,
      content: { decision: 'APPROVED' },
    }));
    await eliciting.connect(clientTransport);

    try {
      const result = await eliciting.callTool({
        name: 'memory__send_notice',
        arguments: { to: 'C-3003', subject: 'elicitation path' },
      });
      expect(textOf(result as never)).toContain('notice-sent#');
      expect(textOf(result as never)).toContain('to=C-3003');

      const calls = await runtime.dataSource.getRepository(ToolCallRecord)
        .find({ where: { toolName: 'memory__send_notice' }, order: { createdAt: 'DESC' }, take: 1 });
      expect(calls[0]?.status).toBe('SUCCEEDED');
      expect(calls[0]?.guardrailCheck).toBe('passed');
    } finally {
      await eliciting.close().catch(() => undefined);
      await gateway.close().catch(() => undefined);
    }
  });

  it('exposeDeniedTools=true surfaces ungranted tools in tools/list (AC-2.1 switch)', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const gateway = await createMcpGateway({
      runtime,
      upstreams: [await buildMemoryDemoUpstream()],
      allowedTools: ALLOWED,
      exposeDeniedTools: true,
    });
    await gateway.createServer().connect(serverTransport);
    const plain = new Client({ name: 'expose-client', version: '0.0.1' });
    await plain.connect(clientTransport);
    try {
      const listed = await plain.listTools();
      expect((listed.tools ?? []).map((tool) => tool.name)).toContain('memory__danger');
    } finally {
      await plain.close().catch(() => undefined);
      await gateway.close().catch(() => undefined);
    }
  });

  it('noop regression: without MCP configuration the sidecar serves no /mcp endpoint (AC-5.1)', async () => {
    const server = createSidecarServer(runtime);
    const { url, close } = await server.listen(0);
    try {
      const response = await fetch(`${url}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      });
      expect(response.status).toBe(404);
    } finally {
      await close();
    }
  });
});
