import type { Repository } from 'typeorm';
import type { AgentExecutionContext } from '@agent-governance/contracts';
import { ExecutionStateMachine, ToolCallLifecycleService, ToolCallRecord, ToolCallStatus, AgentExecution } from '@agent-governance/audit-chain';
import type { ApprovalEngineService } from '@agent-governance/approval';
import type { GuardrailEngineService } from '@agent-governance/guardrail';
import { ToolAccessService } from '@agent-governance/permission';
import type { OutboxService } from '@agent-governance/outbox';
import { OutboxTopic } from '@agent-governance/outbox';

export interface GateRequest {
  toolName: string;
  toolInput: Record<string, unknown>;
}

export type GateResult =
  | { decision: 'allow'; executionId: string; toolCallId: string }
  | {
      decision: 'paused';
      executionId: string;
      toolCallId: string;
      approvalId: string;
      riskLevel: string;
    }
  | { decision: 'blocked'; executionId: string; toolCallId: string; reason: string };

export interface GateServiceDeps {
  executions: Repository<AgentExecution>;
  lifecycle: ToolCallLifecycleService;
  approval: ApprovalEngineService;
  guardrail: GuardrailEngineService;
  outbox: OutboxService;
  toolAccess?: ToolAccessService;
  workspaceId: string;
  agentId: string;
  /**
   * Server-side grant list for gated tools. Deny by default: a tool not in
   * this list is blocked before the guardrail is even consulted.
   */
  allowedTools: string[];
}

/**
 * Per-call governance gate for EXTERNAL agent frameworks (LangGraph /
 * CrewAI / n8n / Dify adapters call this over HTTP). Unlike the built-in
 * executor loop, the caller executes the tool locally after an `allow` (or
 * after a human approval) and reports the outcome via `complete` — every
 * decision lands on the same audit chain (execution → tool call → outbox).
 */
export class GateService {
  private readonly toolAccess: ToolAccessService;

  constructor(private readonly deps: GateServiceDeps) {
    this.toolAccess = deps.toolAccess ?? new ToolAccessService();
  }

  async gate(request: GateRequest): Promise<GateResult> {
    const { toolName, toolInput } = request;
    const { workspaceId, agentId, executions, lifecycle, outbox } = this.deps;

    const execution = await executions.save(executions.create({
      id: crypto.randomUUID(),
      workspaceId,
      agentId,
      triggerType: 'event',
      triggerSource: 'governance_gate',
      rawInput: `gate:${toolName}`,
      status: 'running',
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
    }));
    await outbox.runInTransaction(async (_manager, ob) => {
      await ob.enqueue({
        workspaceId, topic: OutboxTopic.AGENT_EVENTS,
        eventType: 'agent.execution.started',
        aggregateType: 'AgentExecution', aggregateId: execution.id,
        payload: { workspaceId, executionId: execution.id, toolName, source: 'governance_gate' },
      });
    });

    const call = await lifecycle.begin({
      toolName,
      toolCategory: 'governed_gate',
      input: toolInput,
      context: {
        executionId: execution.id,
        workspaceId,
        security: {}, business: {}, knowledge: {},
        constraints: { allowedTools: this.deps.allowedTools, timeoutMs: 60_000 },
      } as unknown as AgentExecutionContext,
    });

    // 1. Deny by default: the server-side grant list decides, not the caller.
    if (!this.toolAccess.checkToolAccess(toolName, this.deps.allowedTools, [])) {
      await lifecycle.transition(call.id, [ToolCallStatus.STARTED], ToolCallStatus.DENIED, {
        permissionCheck: 'denied',
        permissionDetail: `TOOL_NOT_ALLOWED:${toolName}`,
        guardrailCheck: 'blocked',
        errorCode: 'TOOL_NOT_ALLOWED',
      } as never);
      await executions.update(execution.id, {
        status: 'failed',
        completedAt: new Date(),
        outputSummary: `TOOL_NOT_ALLOWED:${toolName}`,
      });
      return { decision: 'blocked', executionId: execution.id, toolCallId: call.id, reason: `TOOL_NOT_ALLOWED:${toolName}` };
    }

    // 2. Guardrail risk evaluation (workspace rules).
    const evaluation = await this.deps.guardrail.evaluate(workspaceId, toolName, toolInput);
    if (evaluation.riskLevel === 'L4') {
      await lifecycle.transition(call.id, [ToolCallStatus.STARTED], ToolCallStatus.BLOCKED, {
        permissionCheck: 'passed',
        guardrailCheck: 'blocked',
        errorCode: `GUARDRAIL_BLOCKED:${toolName}`,
      } as never);
      await executions.update(execution.id, {
        status: 'failed',
        completedAt: new Date(),
        outputSummary: `GUARDRAIL_BLOCKED:${toolName}`,
      });
      return { decision: 'blocked', executionId: execution.id, toolCallId: call.id, reason: `GUARDRAIL_BLOCKED:${toolName}` };
    }

    // 3. L2/L3 — pause for human approval.
    if (evaluation.matched && (evaluation.riskLevel === 'L2' || evaluation.riskLevel === 'L3')) {
      const approval = await this.deps.approval.createAgentApproval({
        workspaceId,
        agentExecutionId: execution.id,
        toolName,
        toolInput,
        riskLevel: evaluation.riskLevel,
        description: evaluation.ruleName ?? toolName,
      });
      await lifecycle.transition(call.id, [ToolCallStatus.STARTED], ToolCallStatus.REQUIRES_APPROVAL, {
        permissionCheck: 'passed',
        guardrailCheck: 'escalated',
      } as never);
      await executions.update(execution.id, {
        status: ExecutionStateMachine.handleStateTransition('running', 'guardrail_pending'),
      });
      await outbox.runInTransaction(async (_manager, ob) => {
        await ob.enqueue({
          workspaceId, topic: OutboxTopic.AGENT_EVENTS,
          eventType: 'agent.execution.paused',
          aggregateType: 'AgentExecution', aggregateId: execution.id,
          payload: { workspaceId, executionId: execution.id, toolName, riskLevel: evaluation.riskLevel, approvalInstanceId: approval.id },
        });
      });
      return {
        decision: 'paused',
        executionId: execution.id,
        toolCallId: call.id,
        approvalId: approval.id,
        riskLevel: evaluation.riskLevel,
      };
    }

    // 4. L0/L1/unmatched — allow; the caller executes locally and completes.
    return { decision: 'allow', executionId: execution.id, toolCallId: call.id };
  }

  /**
   * Caller reports the outcome of a locally-executed (allowed or approved)
   * tool call. Finalizes the tool-call record and the execution, and emits
   * the completion event.
   */
  async complete(
    executionId: string,
    outcome: { success: boolean; output?: unknown },
  ): Promise<void> {
    const { executions, lifecycle, outbox, workspaceId } = this.deps;
    const execution = await executions.findOneByOrFail({ id: executionId });
    if (execution.status !== 'running') {
      throw new Error('GATE_EXECUTION_NOT_AWAITING_COMPLETION');
    }
    const calls = await lifecycle_records(executions.manager.getRepository(ToolCallRecord), executionId);
    const call = calls[0];
    if (!call) throw new Error('GATE_TOOL_CALL_MISSING');
    // A paused (approved) call sits in REQUIRES_APPROVAL; resume it before
    // finalizing — finalize only accepts STARTED/RUNNING.
    if (call.status === ToolCallStatus.REQUIRES_APPROVAL) {
      await lifecycle.transition(call.id, [ToolCallStatus.REQUIRES_APPROVAL], ToolCallStatus.RUNNING, {} as never);
    }
    await lifecycle.finalize(call.id, {
      status: outcome.success ? ToolCallStatus.SUCCEEDED : ToolCallStatus.FAILED,
      output: outcome.output,
      permissionCheck: 'passed',
      guardrailCheck: 'passed',
      durationMs: 0,
      errorCode: outcome.success ? undefined : 'GATE_TOOL_REPORTED_FAILURE',
    });
    await executions.update(executionId, {
      status: ExecutionStateMachine.handleStateTransition('running', outcome.success ? 'done' : 'failed'),
      completedAt: new Date(),
    });
    await outbox.runInTransaction(async (_manager, ob) => {
      await ob.enqueue({
        workspaceId, topic: OutboxTopic.AGENT_EVENTS,
        eventType: outcome.success ? 'agent.execution.completed' : 'agent.execution.failed',
        aggregateType: 'AgentExecution', aggregateId: executionId,
        payload: { workspaceId, executionId, source: 'governance_gate', success: outcome.success },
      });
    });
  }
}

async function lifecycle_records(
  repo: Repository<ToolCallRecord>,
  executionId: string,
): Promise<ToolCallRecord[]> {
  return repo.find({ where: { executionId }, order: { createdAt: 'ASC' } });
}
