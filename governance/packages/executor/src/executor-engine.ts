import { Repository } from 'typeorm';
import type {
  AgentExecutionContext,
  AgentTool,
  ExecutionStatus,
  ExecutorModelPort,
  ReActStepData,
  ResumeContext,
  ToolCallResult,
} from '@agent-governance/contracts';
import { ExecutionStateMachine } from '@agent-governance/audit-chain';
import type { ToolCallLifecycleService } from '@agent-governance/audit-chain';
import { AgentExecution, ReactStep, ToolCallRecord, ToolCallStatus } from '@agent-governance/audit-chain';
import { ApprovalEngineService } from '@agent-governance/approval';
import { GuardrailEngineService } from '@agent-governance/guardrail';
import { ToolAccessService } from '@agent-governance/permission';
import { OutboxService } from '@agent-governance/outbox';
import { OutboxTopic } from '@agent-governance/outbox';
import { ToolRegistry } from './tool-registry.js';

export interface ExecutorInput {
  workspaceId: string;
  agentId: string;
  rawInput: string;
  triggeredBy?: string;
  allowedTools?: string[];
  blockedTools?: string[];
  guardrailRuleIds?: string[];
  traceId?: string;
  correlationId?: string;
}

export interface ExecutorOptions {
  executions: Repository<AgentExecution>;
  steps: Repository<ReactStep>;
  lifecycle: ToolCallLifecycleService;
  approval: ApprovalEngineService;
  guardrail: GuardrailEngineService;
  outbox: OutboxService;
  model: ExecutorModelPort;
  registry: ToolRegistry;
  tools: AgentTool[];
  toolAccess?: ToolAccessService;
  maxIterations?: number;
}

interface LoopContext {
  execution: AgentExecution;
  input: ExecutorInput;
  steps: ReActStepData[];
  messages: Array<{ role: string; content: string }>;
}

/**
 * The governed ReAct loop. Deny by default: a tool runs only when the
 * allow-list grants it, the guardrail engine permits it (L0/L1), and — for
 * L2/L3 — a human approval exists. Every iteration, decision, denial and
 * tool call lands on the audit chain (agent_executions → react_steps →
 * tool_call_records → outbox_events).
 */
export class ExecutorEngine {
  private readonly maxIterations: number;
  private readonly toolAccess: ToolAccessService;

  constructor(private readonly options: ExecutorOptions) {
    this.maxIterations = options.maxIterations ?? 8;
    this.toolAccess = options.toolAccess ?? new ToolAccessService();
    options.registry.registerAll(options.tools);
  }

  async run(input: ExecutorInput): Promise<AgentExecution> {
    const execution = await this.options.executions.save(
      this.options.executions.create({
        id: crypto.randomUUID(),
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        triggerType: 'manual',
        triggerSource: 'api',
        triggeredBy: input.triggeredBy,
        rawInput: input.rawInput,
        status: 'pending',
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        traceId: input.traceId,
        correlationId: input.correlationId,
        triggerPayload: {
          policy: {
            allowedTools: input.allowedTools ?? [],
            blockedTools: input.blockedTools ?? [],
            guardrailRuleIds: input.guardrailRuleIds ?? [],
          },
        },
      }),
    );
    await this.options.outbox.runInTransaction(async (_manager, outbox) => {
      await outbox.enqueue({
        workspaceId: input.workspaceId,
        topic: OutboxTopic.AGENT_EVENTS,
        eventType: 'agent.execution.started',
        aggregateType: 'AgentExecution',
        aggregateId: execution.id,
        payload: { workspaceId: input.workspaceId, executionId: execution.id },
      });
    });

    const context: LoopContext = {
      execution,
      input,
      steps: [],
      messages: [{ role: 'user', content: input.rawInput }],
    };
    const finalStatus = await this.runLoop(context);
    await this.options.outbox.runInTransaction(async (_manager, outbox) => {
      await this.options.executions.update(execution.id, {
        status: finalStatus,
        completedAt: new Date(),
      });
      await outbox.enqueue({
        workspaceId: input.workspaceId,
        topic: OutboxTopic.AGENT_EVENTS,
        eventType: finalStatus === 'done' ? 'agent.execution.completed' : 'agent.execution.failed',
        aggregateType: 'AgentExecution',
        aggregateId: execution.id,
        payload: {
          workspaceId: input.workspaceId,
          executionId: execution.id,
          status: finalStatus,
          stepCount: context.steps.length,
        },
      });
    });
    return this.options.executions.findOneByOrFail({ id: execution.id });
  }

  /**
   * Resume a guardrail-paused execution after human approval: execute the
   * approved tool exactly once, then continue the loop.
   */
  async resumePaused(input: {
    executionId: string;
    workspaceId: string;
    approvalInstanceId: string;
    pausedToolCall: ResumeContext['pausedToolCall'];
  }): Promise<AgentExecution> {
    const { executionId, workspaceId, pausedToolCall } = input;
    if (!pausedToolCall) throw new Error('APPROVAL_LEGACY_RESUME_CONTEXT_MISSING');

    const execution = await this.options.executions.findOneByOrFail({ id: executionId });
    if (execution.status !== 'guardrail_pending') {
      throw new Error('EXECUTION_NOT_AWAITING_APPROVAL');
    }
    const validated = ExecutionStateMachine.handleStateTransition(
      execution.status as ExecutionStatus,
      'running',
    );
    await this.options.executions.update(execution.id, { status: validated });
    execution.status = validated;

    const persisted = await this.options.steps.find({
      where: { executionId },
      order: { stepIndex: 'ASC' },
    });
    const policy = (execution.triggerPayload as { policy?: { allowedTools?: string[]; blockedTools?: string[]; guardrailRuleIds?: string[] } } | null)?.policy;
    const context: LoopContext = {
      execution,
      input: {
        workspaceId,
        agentId: execution.agentId,
        rawInput: execution.rawInput ?? '',
        allowedTools: policy?.allowedTools ?? [],
        blockedTools: policy?.blockedTools ?? [],
        guardrailRuleIds: policy?.guardrailRuleIds ?? [],
        traceId: execution.traceId ?? undefined,
        correlationId: execution.correlationId ?? undefined,
      },
      steps: persisted.map((step) => ({
        iteration: step.stepIndex,
        thought: { reasoning: step.thoughtReasoning ?? '', plan: '', confidence: 1 },
        action: { type: 'tool_call', toolName: step.toolName ?? '', toolInput: step.toolInput ?? {} },
        observation: {
          success: step.observationSuccess ?? true,
          output: step.observationOutput,
          error: step.observationError,
        },
        tokensUsed: { input: step.inputTokens, output: step.outputTokens },
        model: step.model,
        duration: step.durationMs,
        aiProviderStamp: step.aiProviderStamp ?? undefined,
      })) as ReActStepData[],
      messages: [
        { role: 'user', content: execution.rawInput ?? '' },
        ...persisted.flatMap((step) => [
          {
            role: 'assistant' as const,
            content: JSON.stringify({
              thought: { reasoning: step.thoughtReasoning ?? '', plan: '', confidence: 1 },
              action: { type: 'tool_call', toolName: step.toolName ?? '', toolInput: step.toolInput ?? {} },
            }),
          },
          {
            role: 'user' as const,
            content: `observation: ${JSON.stringify(step.observationOutput ?? step.observationError)}`,
          },
        ]),
      ],
    };
    // Execute the approved tool exactly once under the one-shot grant, persist
    // the step on the audit chain, and feed the observation to the model.
    const result = await this.executeApprovedTool(
      context,
      pausedToolCall.toolName,
      pausedToolCall.toolInput ?? {},
    );
    await this.persistStep(
      context,
      persisted.length,
      { reasoning: 'approved resume', plan: 'execute approved tool', confidence: 1 },
      { type: 'tool_call', toolName: pausedToolCall.toolName, toolInput: pausedToolCall.toolInput ?? {} },
      {
        success: result.success,
        output: result.output,
        error: result.error,
        guardrailTriggered: false,
      },
    );
    const finalStatus = await this.runLoop(context);
    await this.options.executions.update(execution.id, {
      status: finalStatus,
      completedAt: new Date(),
    });
    return this.options.executions.findOneByOrFail({ id: executionId });
  }

  // ─── internals ───

  private async runLoop(context: LoopContext): Promise<ExecutionStatus> {
    for (let iteration = context.steps.length; iteration < this.maxIterations; iteration++) {
      const response = await this.options.model.chat(
        {
          messages: context.messages,
          responseFormat: 'json',
        },
        1,
        { workspaceId: context.input.workspaceId, agentId: context.input.agentId },
      );
      let action: ReActStepData['action'];
      let thought: ReActStepData['thought'];
      try {
        const parsed = JSON.parse(response.content) as {
          thought: ReActStepData['thought'];
          action: typeof action;
        };
        thought = parsed.thought;
        action = parsed.action;
      } catch {
        return 'failed';
      }

      if (action.type === 'finish') {
        await this.persistStep(context, iteration, thought, action, {
          success: true,
          output: { text: action.generatePrompt ?? '' },
          error: undefined,
          guardrailTriggered: false,
        });
        return 'done';
      }

      if (action.type === 'tool_call' && action.toolName) {
        const gate = await this.gateToolCall(context, action.toolName, action.toolInput ?? {});
        if (gate.status === 'paused') return 'guardrail_pending';
        if (gate.status === 'blocked') {
          await this.persistStep(context, iteration, thought, action, {
            success: false,
            output: null,
            error: gate.error,
            guardrailTriggered: true,
          });
          continue;
        }
        const toolResult = await this.executeApprovedTool(context, action.toolName, action.toolInput ?? {});
        await this.persistStep(context, iteration, thought, action, {
          success: toolResult.success,
          output: toolResult.output,
          error: toolResult.error,
          guardrailTriggered: false,
        });
        context.messages.push({
          role: 'user',
          content: `observation: ${JSON.stringify(toolResult.output ?? toolResult.error)}`,
        });
        continue;
      }

      return 'failed';
    }
    return 'failed';
  }

  private async gateToolCall(
    context: LoopContext,
    toolName: string,
    toolInput: Record<string, unknown>,
  ): Promise<{ status: 'allow' } | { status: 'paused' } | { status: 'blocked'; error: string }> {
    const { workspaceId, allowedTools, blockedTools, guardrailRuleIds } = context.input;
    const granted = this.toolAccess.checkToolAccess(
      toolName,
      allowedTools ?? [],
      blockedTools ?? [],
    );
    if (!granted) {
      return { status: 'blocked', error: `TOOL_NOT_ALLOWED:${toolName}` };
    }

    const evaluation = await this.options.guardrail.evaluate(
      workspaceId,
      toolName,
      toolInput,
      guardrailRuleIds,
    );
    if (!evaluation.matched || evaluation.riskLevel === 'L0' || evaluation.riskLevel === 'L1') {
      return { status: 'allow' };
    }
    if (evaluation.riskLevel === 'L4') {
      return { status: 'blocked', error: `GUARDRAIL_BLOCKED:${toolName}` };
    }

    // L2 / L3 — pause for human approval.
    await this.options.approval.createAgentApproval({
      workspaceId,
      agentExecutionId: context.execution.id,
      toolName,
      toolInput,
      riskLevel: evaluation.riskLevel,
      description: evaluation.ruleName ?? toolName,
      traceId: context.input.traceId,
      correlationId: context.input.correlationId,
    });
    const validated = ExecutionStateMachine.handleStateTransition(
      context.execution.status as ExecutionStatus,
      'guardrail_pending',
    );
    await this.options.executions.update(context.execution.id, { status: validated });
    context.execution.status = validated;
    await this.options.outbox.runInTransaction(async (_manager, outbox) => {
      await outbox.enqueue({
        workspaceId,
        topic: OutboxTopic.AGENT_EVENTS,
        eventType: 'agent.execution.paused',
        aggregateType: 'AgentExecution',
        aggregateId: context.execution.id,
        payload: {
          workspaceId,
          executionId: context.execution.id,
          toolName,
          riskLevel: evaluation.riskLevel,
        },
      });
    });
    return { status: 'paused' };
  }

  private async executeApprovedTool(
    context: LoopContext,
    toolName: string,
    toolInput: Record<string, unknown>,
  ): Promise<ToolCallResult> {
    const grantedContext = {
      executionId: context.execution.id,
      workspaceId: context.input.workspaceId,
      traceId: context.input.traceId,
      correlationId: context.input.correlationId,
      security: {},
      business: {},
      knowledge: {},
      constraints: {
        allowedTools: context.input.allowedTools ?? [],
        timeoutMs: 60_000,
      },
    } as unknown as AgentExecutionContext;
    const call = await this.options.lifecycle.begin({
      toolName,
      toolCategory: 'governed',
      input: toolInput,
      context: grantedContext,
    });
    const result = await this.options.registry.execute(toolName, toolInput, grantedContext);
    await this.options.lifecycle.finalize(call.id, {
      status: result.success ? ToolCallStatus.SUCCEEDED : ToolCallStatus.FAILED,
      output: result.output,
      permissionCheck: result.permissionCheck,
      guardrailCheck: result.guardrailCheck,
      durationMs: result.duration,
      errorCode: result.error,
    });
    return result;
  }

  private async persistStep(
    context: LoopContext,
    iteration: number,
    thought: ReActStepData['thought'],
    action: ReActStepData['action'],
    observation: { success: boolean; output: unknown; error?: string; guardrailTriggered: boolean },
  ): Promise<void> {
    await this.options.steps.save(
      this.options.steps.create({
        id: crypto.randomUUID(),
        executionId: context.execution.id,
        stepIndex: iteration,
        thoughtReasoning: thought?.reasoning,
        thoughtPlan: thought?.plan,
        thoughtConfidence: thought?.confidence,
        actionType: action.type,
        toolName: action.toolName,
        toolInput: action.toolInput,
        generatePrompt: action.generatePrompt,
        observationSuccess: observation.success,
        observationOutput:
          observation.output && typeof observation.output === 'object'
            ? (observation.output as Record<string, unknown>)
            : { value: observation.output },
        observationError: observation.error,
        guardrailTriggered: observation.guardrailTriggered,
        inputTokens: 0,
        outputTokens: 0,
      }),
    );
    const step: ReActStepData = {
      iteration,
      thought,
      action,
      observation: {
        success: observation.success,
        output: observation.output,
        error: observation.error,
        guardrailTriggered: observation.guardrailTriggered,
      },
      tokensUsed: { input: 0, output: 0 },
      model: '',
      duration: 0,
    };
    context.steps.push(step);
    context.messages.push({
      role: 'assistant',
      content: JSON.stringify({ thought, action }),
    });
    context.messages.push({
      role: 'user',
      content: `observation: ${JSON.stringify(observation.output ?? observation.error)}`,
    });
  }
}

export { ToolCallStatus };
