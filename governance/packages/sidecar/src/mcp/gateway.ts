import type { Express } from 'express';
import { AgentExecution } from '@agent-governance/audit-chain';
import { ApprovalInstance } from '@agent-governance/approval';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type ElicitRequestFormParams,
} from '@modelcontextprotocol/sdk/types.js';
import type { SidecarRuntime } from '../runtime.js';
import type { Upstream, UpstreamCallResult, UpstreamTool } from './upstream.js';

export const PENDING_LOOKUP_TOOL = 'governance_pending__lookup';
const PAUSED_MARKER = '__pausedToolCall__:';

interface AggregatedTool extends UpstreamTool {
  upstream: Upstream;
  aggregatedName: string;
}

interface PausedToolCall {
  toolName: string;
  toolInput: Record<string, unknown>;
  riskLevel: string;
}

export interface McpGatewayOptions {
  runtime: SidecarRuntime;
  upstreams: Upstream[];
  /** The gate's server-side grant list (deny by default). */
  allowedTools: string[];
  /** Expose ungranted tools in tools/list (default hidden — visibility IS permission). */
  exposeDeniedTools?: boolean;
}

export interface McpGateway {
  /** A fresh MCP server bound to the gateway state (one per stateless request). */
  createServer(): Server;
  /** Mount the stateless Streamable-HTTP endpoint (POST {path}). */
  attach(app: Express, path?: string): void;
  close(): Promise<void>;
}

/**
 * The governance gateway: an MCP server form over the existing gate pipeline
 * (deny-by-default permissions → L0–L4 guardrails → L2/L3 human approval →
 * audit chain). Downstream MCP servers are fronted with `<server>__<tool>`
 * namespacing; the gate, approval store and audit chain are reused untouched.
 *
 * Pause semantics on a synchronous RPC protocol:
 *  - client declares elicitation capability → the approval question is asked
 *    in-request and the call completes (or is rejected) in the same turn;
 *  - otherwise a structured `approval_pending` tool result is returned; the
 *    human decides via the sidecar console / POST /approvals/:id/decide, and
 *    the agent fetches the executed outcome via `governance_pending__lookup`.
 */
export async function createMcpGateway(options: McpGatewayOptions): Promise<McpGateway> {
  const { runtime, allowedTools } = options;

  const aggregated: AggregatedTool[] = [];
  for (const upstream of options.upstreams) {
    for (const tool of await upstream.listTools()) {
      aggregated.push({ ...tool, upstream, aggregatedName: `${upstream.name}__${tool.name}` });
    }
  }
  const byAggregatedName = new Map(aggregated.map((tool) => [tool.aggregatedName, tool]));
  const visible =
    options.exposeDeniedTools === true
      ? aggregated
      : aggregated.filter((tool) => allowedTools.includes(tool.aggregatedName));

  const createServer = (): Server => {
    const server = new Server(
      { name: 'agent-governance-gateway', version: '0.1.0' },
      { capabilities: { tools: { listChanged: false } } },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        ...visible.map((tool) => ({
          name: tool.aggregatedName,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
        {
          name: PENDING_LOOKUP_TOOL,
          description:
            'Fetch the outcome of a gated call that paused for human approval: still pending, the executed result (after approval), or the rejection.',
          inputSchema: {
            type: 'object',
            properties: { approval_id: { type: 'string' } },
            required: ['approval_id'],
          },
        },
      ],
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
      const { name, arguments: args = {} } = request.params;
      if (name === PENDING_LOOKUP_TOOL) {
        return pendingLookup(runtime, byAggregatedName, String((args as { approval_id?: string }).approval_id ?? ''));
      }
      const tool = byAggregatedName.get(name);
      if (!tool) {
        return textResult(JSON.stringify({ governance: 'blocked', reason: `TOOL_NOT_ALLOWED:${name}` }), true);
      }

      const verdict = await runtime.gate.gate({ toolName: name, toolInput: args });
      if (verdict.decision === 'blocked') {
        return textResult(
          JSON.stringify({ governance: 'blocked', reason: verdict.reason, execution_id: verdict.executionId }),
          true,
        );
      }
      if (verdict.decision === 'allow') {
        return executeAndComplete(runtime, tool, verdict.executionId, args);
      }

      // paused (L2/L3) — elicitation first when the client speaks it.
      if (server.getClientCapabilities()?.elicitation) {
        const form: ElicitRequestFormParams = {
          message: `Governance approval required: ${name} (risk ${verdict.riskLevel}).`,
          requestedSchema: {
            type: 'object',
            properties: { decision: { type: 'string', enum: ['APPROVED', 'REJECTED'] } },
            required: ['decision'],
          },
        };
        const answer = await server.elicitInput(form);
        const decision =
          answer.action === 'accept'
            ? (answer.content as { decision?: string } | undefined)?.decision
            : undefined;
        if (decision === 'APPROVED') {
          await decideApproval(runtime, verdict.approvalId, 'APPROVED', 'mcp-elicitation');
          return executeAndComplete(runtime, tool, verdict.executionId, args);
        }
        await decideApproval(runtime, verdict.approvalId, 'REJECTED', 'mcp-elicitation');
        return textResult(
          JSON.stringify({ governance: 'approval_rejected', tool: name, execution_id: verdict.executionId }),
          true,
        );
      }

      // Fallback: structured pending result; decide via the sidecar console
      // or POST /approvals/:id/decide, then fetch the outcome via the meta-tool.
      return textResult(
        JSON.stringify({
          governance: 'approval_pending',
          approval_id: verdict.approvalId,
          execution_id: verdict.executionId,
          tool: name,
          risk_level: verdict.riskLevel,
          hint: `Approve or reject via the sidecar console, then call ${PENDING_LOOKUP_TOOL} with approval_id.`,
        }),
      );
    });

    return server;
  };

  return {
    createServer,
    attach(app: Express, path = '/mcp'): void {
      // Stateless mode (the 2026-07-28 spec direction): a fresh server +
      // transport per request, no session state on the gateway.
      app.post(path, async (req, res) => {
        try {
          const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
          const server = createServer();
          res.on('close', () => void transport.close());
          await server.connect(transport);
          await transport.handleRequest(req, res, req.body);
        } catch (error) {
          if (!res.headersSent) res.status(500).json({ error: (error as Error)?.message ?? 'mcp gateway failed' });
        }
      });
      app.get(path, (_req, res) => {
        res.status(405).json({ error: 'stateless MCP endpoint — POST only' });
      });
      app.delete(path, (_req, res) => {
        res.status(405).json({ error: 'stateless MCP endpoint — no sessions to terminate' });
      });
    },
    async close(): Promise<void> {
      await Promise.all(options.upstreams.map((upstream) => upstream.close()));
    },
  };
}

/**
 * Record a human decision on a pending approval and move the execution to
 * the state the gate expects (`running` for approve — the caller/gateway then
 * completes it; `cancelled` for reject — the original call never executes).
 */
export async function decideApproval(
  runtime: SidecarRuntime,
  approvalId: string,
  decision: 'APPROVED' | 'REJECTED',
  actor: string,
): Promise<void> {
  const repo = runtime.dataSource.getRepository(ApprovalInstance);
  const row = await repo.findOneByOrFail({ id: approvalId });
  if (row.status !== 'PENDING') throw new Error('APPROVAL_ALREADY_DECIDED');
  await repo.update(row.id, {
    status: decision,
    completedAt: new Date(),
    history: [...(row.history ?? []), {
      stepIndex: (row.currentStepIndex ?? 0) + 1,
      stepName: 'MCP Human Gate',
      action: decision,
      actorId: 'mcp-gateway',
      actorName: actor,
      comments: '',
      timestamp: new Date().toISOString(),
    }],
  });
  await runtime.dataSource.getRepository(AgentExecution).update(row.recordId, decision === 'APPROVED'
    ? { status: 'running' }
    : { status: 'cancelled', completedAt: new Date() });
}

async function executeAndComplete(
  runtime: SidecarRuntime,
  tool: AggregatedTool,
  executionId: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  let result: UpstreamCallResult;
  try {
    result = await tool.upstream.callTool(tool.name, args);
  } catch (error) {
    await runtime.gate.complete(executionId, { success: false, output: { error: String(error) } });
    return textResult(JSON.stringify({ governance: 'error', reason: String(error) }), true);
  }
  const text = result.content.map((part) => (typeof part.text === 'string' ? part.text : JSON.stringify(part))).join('\n');
  await runtime.gate.complete(executionId, { success: result.isError !== true, output: text });
  return {
    content: result.content as unknown as CallToolResult['content'],
    ...(result.isError === true ? { isError: true } : {}),
  };
}

/**
 * Proxy execution for the pending-fallback path: after a human decides, the
 * gateway executes the original call (parameters recovered from the approval
 * record — no in-memory pending state to lose) and completes the audit chain.
 */
async function pendingLookup(
  runtime: SidecarRuntime,
  byAggregatedName: Map<string, AggregatedTool>,
  approvalId: string,
): Promise<CallToolResult> {
  if (!approvalId) {
    return textResult(JSON.stringify({ governance: 'error', reason: 'approval_id is required' }), true);
  }
  const repo = runtime.dataSource.getRepository(ApprovalInstance);
  const row = await repo.findOneBy({ id: approvalId });
  if (!row) {
    return textResult(JSON.stringify({ governance: 'error', reason: `UNKNOWN_APPROVAL:${approvalId}` }), true);
  }
  const execution = await runtime.dataSource.getRepository(AgentExecution).findOneByOrFail({ id: row.recordId });

  // The console approve path sets the execution running while leaving the
  // approval row PENDING — treat that combination as approved.
  const decided = row.status === 'PENDING' && execution.status === 'running' ? 'APPROVED' : row.status;
  if (decided === 'PENDING') {
    return textResult(JSON.stringify({ governance: 'approval_pending', approval_id: approvalId, status: 'waiting' }));
  }

  const paused = parsePausedToolCall(row);
  if (decided === 'REJECTED') {
    if (execution.status !== 'cancelled') {
      await runtime.dataSource.getRepository(AgentExecution)
        .update(row.recordId, { status: 'cancelled', completedAt: new Date() });
    }
    if (row.status === 'PENDING') {
      await repo.update(row.id, { status: 'REJECTED', completedAt: new Date() });
    }
    return textResult(
      JSON.stringify({ governance: 'approval_rejected', tool: paused?.toolName, execution_id: row.recordId }),
      true,
    );
  }

  if (row.status === 'PENDING') {
    await repo.update(row.id, { status: 'APPROVED', completedAt: new Date() });
  }
  const tool = paused ? byAggregatedName.get(paused.toolName) : undefined;
  if (!tool || !paused) {
    return textResult(JSON.stringify({ governance: 'error', reason: 'PAUSED_CALL_UNAVAILABLE' }), true);
  }
  const args = (paused.toolInput ?? {}) as Record<string, unknown>;
  let result: UpstreamCallResult;
  try {
    result = await tool.upstream.callTool(tool.name, args);
  } catch (error) {
    await runtime.gate.complete(row.recordId, { success: false, output: { error: String(error) } });
    return textResult(JSON.stringify({ governance: 'error', reason: String(error) }), true);
  }
  const text = result.content.map((part) => (typeof part.text === 'string' ? part.text : JSON.stringify(part))).join('\n');
  await runtime.gate.complete(row.recordId, { success: result.isError !== true, output: text });
  return {
    content: result.content as unknown as CallToolResult['content'],
    ...(result.isError === true ? { isError: true } : {}),
  };
}

function parsePausedToolCall(row: ApprovalInstance): PausedToolCall | null {
  const comments = row.history?.[0]?.comments ?? '';
  const index = comments.indexOf(PAUSED_MARKER);
  if (index < 0) return null;
  try {
    return JSON.parse(comments.slice(index + PAUSED_MARKER.length)) as PausedToolCall;
  } catch {
    return null;
  }
}

function textResult(text: string, isError = false): CallToolResult {
  return { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) };
}
