import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { CurrentUser } from '../../modules/auth/decorators/current-user.decorator';
import { Agent } from '../../modules/agent/entities/agent.entity';
import { AgentExecution } from '../../modules/agent-runtime/entities/agent-execution.entity';
import { ExecutorEngineService } from '../../modules/agent-runtime/executor/executor-engine.service';
import { ExecutionStateMachine } from '../../modules/agent-runtime/executor/execution-state-machine';
import type { ExecutionStatus, ResumeContext } from '../../modules/agent-runtime/interfaces';
import { ApprovalInstance } from '../../modules/approval/entities/approval-instance.entity';
import type { ApprovalHistoryEntry } from '../../modules/approval/entities/approval-instance.entity';
import { OutboxEvent } from '../../modules/outbox/entities/outbox-event.entity';
import { OutboxTopic } from '../../modules/outbox/enums/outbox-topic.enum';
import { OutboxService } from '../../modules/outbox/services/outbox.service';
import { CommunityGqlAuthGuard } from '../auth/community-gql-auth.guard';
import type { CommunityPrincipal } from '../auth/community-auth.service';
import {
  CommunityAgentSummary,
  CommunityApprovalDecisionResult,
  CommunityApprovalHistoryEntry,
  CommunityCreateAgentInput,
  CommunityCreateAgentResult,
  CommunityExecutionConstraintsInput,
  CommunityModelSource,
  CommunityOutboxEventView,
  CommunityPendingApproval,
  CommunityUpdateAgentConfigInput,
  CommunityUpdateAgentConfigResult,
} from './community-console.dto';
import { CommunityModelSourceService } from '../byo/community-model-source.service';
import { CommunityAgentInsightsService } from './community-agent-insights.service';
import { PlaygroundSessionRegistry } from '../playground/community-playground.registry';

const PAUSED_TOOL_CALL_MARKER = '__pausedToolCall__:';

const RISK_LEVELS = new Set(['L0', 'L1', 'L2', 'L3', 'L4']);
const RULE_ACTIONS = new Set(['allow', 'audit', 'confirm', 'approve', 'block']);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

interface PausedToolCall {
  toolName: string;
  toolInput: Record<string, unknown>;
  riskLevel: string;
  description?: string;
}

function parsePausedToolCall(
  history: ApprovalHistoryEntry[] | undefined | null,
): PausedToolCall | null {
  for (const entry of history ?? []) {
    const comments = entry.comments ?? '';
    const markerAt = comments.indexOf(PAUSED_TOOL_CALL_MARKER);
    if (markerAt < 0) continue;
    try {
      const parsed = JSON.parse(
        comments.slice(markerAt + PAUSED_TOOL_CALL_MARKER.length),
      ) as PausedToolCall;
      if (parsed && typeof parsed.toolName === 'string') return parsed;
    } catch {
      // fall through — a malformed marker row is skipped, never trusted
    }
  }
  return null;
}

@Resolver(() => AgentExecution)
@UseGuards(CommunityGqlAuthGuard)
export class CommunityAgentRuntimeResolver {
  private readonly logger = new Logger(CommunityAgentRuntimeResolver.name);

  constructor(
    @InjectRepository(AgentExecution)
    private readonly executions: Repository<AgentExecution>,
    @InjectRepository(Agent)
    private readonly agents: Repository<Agent>,
    @InjectRepository(ApprovalInstance)
    private readonly approvals: Repository<ApprovalInstance>,
    @InjectRepository(OutboxEvent)
    private readonly outboxEvents: Repository<OutboxEvent>,
    private readonly executor: ExecutorEngineService,
    private readonly outbox: OutboxService,
    private readonly modelSourceService: CommunityModelSourceService,
    private readonly insights: CommunityAgentInsightsService,
    private readonly playgroundRegistry: PlaygroundSessionRegistry,
  ) {}

  /** Read-only runtime metadata backing the console model badge (AC-2.7). */
  @Query(() => CommunityModelSource, { name: 'communityModelSource' })
  modelSource(): CommunityModelSource {
    return this.modelSourceService.view();
  }

  @Mutation(() => AgentExecution, { name: 'communityExecuteAgent' })
  async executeAgent(
    @Args('agentId', { type: () => ID }) agentId: string,
    @Args('input') input: string,
    @CurrentUser() principal: CommunityPrincipal,
  ): Promise<AgentExecution> {
    const text = input.trim();
    if (!text) throw new BadRequestException('Agent task input must not be empty');
    // Playground sessions only (AC-2.3): per-session and per-IP hourly caps.
    this.playgroundRegistry.assertExecutionAllowed(principal.defaultWorkspaceId);
    this.playgroundRegistry.countExecution(principal.defaultWorkspaceId);
    const result = await this.executor.runSync({
      workspaceId: principal.defaultWorkspaceId,
      agentId,
      rawInput: text,
      triggeredBy: principal.id,
      authenticatedCaller: {
        userId: principal.id,
        roleId: principal.roleId,
        workspaceId: principal.defaultWorkspaceId,
        orgNodeId: principal.orgNodeId,
      },
      triggerSource: 'community_api',
      triggerPayload: {
        actorType: 'human_user',
        actorId: principal.id,
        source: 'community_api',
      },
    });
    const execution = await this.executions.findOne({
      where: { id: result.executionId, workspaceId: principal.defaultWorkspaceId },
    });
    if (!execution) throw new NotFoundException('Execution audit row not found');
    return execution;
  }

  @Query(() => AgentExecution, { name: 'communityAgentExecution', nullable: true })
  execution(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() principal: CommunityPrincipal,
  ): Promise<AgentExecution | null> {
    return this.executions.findOne({
      where: { id, workspaceId: principal.defaultWorkspaceId },
      relations: ['reactSteps', 'toolCallRecords'],
    });
  }

  @Query(() => [CommunityAgentSummary], { name: 'communityAgents' })
  listAgents(
    @CurrentUser() principal: CommunityPrincipal,
  ): Promise<CommunityAgentSummary[]> {
    return this.insights.summaries(principal.defaultWorkspaceId);
  }

  @Query(() => [AgentExecution], { name: 'communityAgentExecutions' })
  listExecutions(
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @CurrentUser() principal: CommunityPrincipal,
  ): Promise<AgentExecution[]> {
    return this.executions.find({
      where: { workspaceId: principal.defaultWorkspaceId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 50),
    });
  }

  @Query(() => [CommunityPendingApproval], { name: 'communityPendingApprovals' })
  async pendingApprovals(
    @CurrentUser() principal: CommunityPrincipal,
  ): Promise<CommunityPendingApproval[]> {
    const rows = await this.approvals.find({
      where: {
        workspaceId: principal.defaultWorkspaceId,
        status: 'PENDING',
        objectName: 'AgentExecution',
      },
      order: { submittedAt: 'ASC' },
    });
    const projected: CommunityPendingApproval[] = [];
    for (const row of rows) {
      const paused = parsePausedToolCall(row.history);
      if (!paused) continue;
      projected.push({
        id: row.id,
        executionId: row.recordId,
        toolName: paused.toolName,
        riskLevel: paused.riskLevel,
        description: paused.description,
        toolInput: (paused.toolInput ?? {}) as Record<string, any>,
        status: row.status,
        submittedAt: row.submittedAt,
      });
    }
    return projected;
  }

  @Query(() => [CommunityOutboxEventView], { name: 'communityExecutionEvents' })
  async executionEvents(
    @Args('executionId', { type: () => ID }) executionId: string,
    @CurrentUser() principal: CommunityPrincipal,
  ): Promise<CommunityOutboxEventView[]> {
    const rows = await this.outboxEvents.find({
      where: {
        workspaceId: principal.defaultWorkspaceId,
        aggregateType: 'AgentExecution',
        aggregateId: executionId,
      },
      order: { createdAt: 'ASC' },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      topic: row.topic,
      eventType: row.eventType,
      payload: row.payload,
      createdAt: row.createdAt,
    }));
  }

  /** Cross-execution outbox event feed for the event-stream view —
   *  newest first, bounded, workspace-scoped. Read-only. */
  @Query(() => [CommunityOutboxEventView], { name: 'communityRecentEvents' })
  async recentEvents(
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @CurrentUser() principal: CommunityPrincipal,
  ): Promise<CommunityOutboxEventView[]> {
    const rows = await this.outboxEvents.find({
      where: {
        workspaceId: principal.defaultWorkspaceId,
        aggregateType: In(['AgentExecution', 'Agent']),
      },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 50),
    });
    return rows.map((row) => ({
      id: row.id,
      topic: row.topic,
      eventType: row.eventType,
      payload: row.payload,
      createdAt: row.createdAt,
    }));
  }

  /** Decided approval instances (APPROVED / REJECTED), newest first —
   *  the audit-chain side of the approvals queue. Read-only. */
  @Query(() => [CommunityApprovalHistoryEntry], {
    name: 'communityApprovalHistory',
  })
  async approvalHistory(
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @CurrentUser() principal: CommunityPrincipal,
  ): Promise<CommunityApprovalHistoryEntry[]> {
    const rows = await this.approvals.find({
      where: {
        workspaceId: principal.defaultWorkspaceId,
        status: In(['APPROVED', 'REJECTED']),
        objectName: 'AgentExecution',
      },
      order: { completedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 50),
    });
    return rows.map((row) => {
      const paused = parsePausedToolCall(row.history);
      const terminal = [...(row.history ?? [])]
        .reverse()
        .find((entry) => entry.action === 'APPROVED' || entry.action === 'REJECTED');
      return {
        id: row.id,
        executionId: row.recordId,
        decision: row.status,
        toolName: paused?.toolName ?? '',
        riskLevel: paused?.riskLevel ?? '',
        comment: terminal?.comments?.trim() ? terminal.comments : null,
        actorName: terminal?.actorName ?? null,
        decidedAt: row.completedAt ?? new Date(),
        submittedAt: row.submittedAt,
      };
    });
  }

  @Mutation(() => CommunityApprovalDecisionResult, {
    name: 'communityDecideApproval',
  })
  async decideApproval(
    @Args('instanceId', { type: () => ID }) instanceId: string,
    @Args('decision') decision: string,
    @Args('comment', { nullable: true, type: () => String }) comment: string | undefined,
    @CurrentUser() principal: CommunityPrincipal,
  ): Promise<CommunityApprovalDecisionResult> {
    const normalized = decision.trim().toUpperCase();
    if (normalized !== 'APPROVED' && normalized !== 'REJECTED') {
      throw new BadRequestException('Decision must be APPROVED or REJECTED');
    }
    // Keep the playground session alive on human decisions (AC-2.2 touch).
    this.playgroundRegistry.touch(principal.defaultWorkspaceId);
    const workspaceId = principal.defaultWorkspaceId;
    const instance = await this.approvals.findOne({
      where: { id: instanceId, workspaceId },
    });
    if (!instance || instance.objectName !== 'AgentExecution') {
      throw new NotFoundException('Approval instance not found');
    }
    if (instance.status !== 'PENDING') {
      throw new ConflictException('APPROVAL_ALREADY_DECIDED');
    }
    const paused = parsePausedToolCall(instance.history);
    if (!paused) {
      throw new ConflictException('APPROVAL_PAUSED_TOOL_CALL_MISSING');
    }
    const execution = await this.executions.findOne({
      where: { id: instance.recordId, workspaceId },
    });
    if (!execution) {
      throw new NotFoundException('Paused execution not found');
    }
    if (execution.status !== 'guardrail_pending') {
      throw new ConflictException('EXECUTION_NOT_AWAITING_APPROVAL');
    }

    const decidedAt = new Date();
    instance.history = [
      ...instance.history,
      {
        stepIndex: instance.currentStepIndex + 1,
        stepName: 'Agent Sensitive Operation',
        action: normalized,
        actorId: principal.id,
        actorName: 'Community Console',
        comments: comment ?? '',
        timestamp: decidedAt.toISOString(),
      },
    ];
    instance.status = normalized;
    instance.completedAt = decidedAt;
    await this.approvals.save(instance);

    if (normalized === 'REJECTED') {
      // guardrail_pending → cancelled is a legal state-machine transition;
      // the rejection lands on the audit chain via the outbox event below.
      await this.outbox.runInTransaction(async (manager, ob) => {
        await manager.getRepository(AgentExecution).update(execution.id, {
          status: 'cancelled',
          completedAt: decidedAt,
        });
        await ob.enqueue({
          workspaceId,
          topic: OutboxTopic.AGENT_EVENTS,
          eventType: 'agent.execution.cancelled',
          aggregateType: 'AgentExecution',
          aggregateId: execution.id,
          payload: {
            workspaceId,
            executionId: execution.id,
            approvalInstanceId: instance.id,
            decision: 'rejected',
            decidedBy: principal.id,
            toolName: paused.toolName,
            riskLevel: paused.riskLevel,
          },
        });
      });
      return {
        instanceId: instance.id,
        decision: normalized,
        executionId: execution.id,
        executionStatus: 'cancelled',
      };
    }

    // APPROVED — resume the paused execution, mirroring the worker resume
    // branch (P0-D §6.3): state-machine-validated guardrail_pending →
    // running, persisted AND synced on the in-memory entity (execute()'s
    // finalStatus check reads the in-memory status), then the executor
    // rebuilds history, executes the approved tool exactly once under a
    // one-shot grant, and continues the ReAct loop to completion.
    const validatedStatus = ExecutionStateMachine.handleStateTransition(
      execution.status as ExecutionStatus,
      'running',
    );
    await this.executions.update(execution.id, { status: validatedStatus });
    execution.status = validatedStatus;

    const resume: ResumeContext = {
      approvalInstanceId: instance.id,
      pausedToolCall: {
        toolName: paused.toolName,
        toolInput: paused.toolInput,
        riskLevel: paused.riskLevel,
        description: paused.description ?? paused.toolName,
      },
    };
    await this.executor.execute(execution, resume, 'sync');
    const refreshed = await this.executions.findOne({
      where: { id: execution.id, workspaceId },
    });
    return {
      instanceId: instance.id,
      decision: normalized,
      executionId: execution.id,
      executionStatus: refreshed?.status ?? execution.status,
    };
  }

  /** Editable employee policy configuration. Server-side validated, then
   *  written inside the same transaction as its audit event; the version
   *  counter increments on every change. Deny-by-default semantics: an
   *  empty allowedTools list disables every tool. */
  @Mutation(() => CommunityUpdateAgentConfigResult, {
    name: 'communityUpdateAgentConfig',
  })
  async updateAgentConfig(
    @Args('agentId', { type: () => ID }) agentId: string,
    @Args('input', { type: () => CommunityUpdateAgentConfigInput })
    input: CommunityUpdateAgentConfigInput,
    @CurrentUser() principal: CommunityPrincipal,
  ): Promise<CommunityUpdateAgentConfigResult> {
    const workspaceId = principal.defaultWorkspaceId;
    const agent = await this.agents.findOne({ where: { id: agentId, workspaceId } });
    if (!agent) throw new NotFoundException('Agent not found');

    const rules: Record<string, any> = { ...asRecord(agent.guardrailRules) };
    const changedFields: string[] = [];
    const patch: Partial<Agent> = {};

    if (input.prompt !== undefined && input.prompt !== null) {
      patch.prompt = String(input.prompt);
      changedFields.push('prompt');
    }
    if (input.allowedTools !== undefined && input.allowedTools !== null) {
      if (
        !Array.isArray(input.allowedTools) ||
        input.allowedTools.some((tool) => typeof tool !== 'string' || tool.length === 0)
      ) {
        throw new BadRequestException('allowedTools must be a list of non-empty tool names');
      }
      rules.allowedTools = input.allowedTools;
      changedFields.push('allowedTools');
    }
    if (input.sensitiveOps !== undefined && input.sensitiveOps !== null) {
      this.validateSensitiveOps(input.sensitiveOps);
      rules.sensitiveOps = input.sensitiveOps;
      changedFields.push('sensitiveOps');
    }
    if (input.execution !== undefined && input.execution !== null) {
      rules.execution = this.resolveExecutionConstraints(input.execution, asRecord(rules.execution));
      changedFields.push('execution');
    }

    const nextVersion = (agent.version ?? 0) + 1;
    await this.outbox.runInTransaction(async (manager, ob) => {
      const updateRow: Partial<Agent> = { guardrailRules: rules, version: nextVersion };
      if (patch.prompt !== undefined) updateRow.prompt = patch.prompt;
      // TypeORM's QueryDeepPartialEntity mishandles jsonb columns typed as
      // Record<string, any>; the row is a plain Partial<Agent> at runtime.
      await manager.getRepository(Agent).update(agent.id, updateRow as never);
      await ob.enqueue({
        workspaceId,
        topic: OutboxTopic.AGENT_EVENTS,
        eventType: 'agent.config.updated',
        aggregateType: 'Agent',
        aggregateId: agent.id,
        payload: {
          workspaceId,
          agentId: agent.id,
          version: nextVersion,
          changedFields,
          by: principal.id,
        },
      });
    });
    const refreshed = await this.agents.findOne({ where: { id: agent.id, workspaceId } });
    return {
      id: agent.id,
      version: refreshed?.version ?? nextVersion,
      updatedAt: refreshed?.updatedAt ?? new Date(),
    };
  }

  /** Create a new digital employee in the caller workspace. The initial
   *  policy is fully configurable; every creation lands on the audit chain.
   *  The new employee executes under the authenticated caller's role until
   *  it is bound to its own service identity. */
  @Mutation(() => CommunityCreateAgentResult, { name: 'communityCreateAgent' })
  async createAgent(
    @Args('input', { type: () => CommunityCreateAgentInput })
    input: CommunityCreateAgentInput,
    @CurrentUser() principal: CommunityPrincipal,
  ): Promise<CommunityCreateAgentResult> {
    const workspaceId = principal.defaultWorkspaceId;
    const name = input.name?.trim();
    const apiName = input.apiName?.trim();
    if (!name) throw new BadRequestException('name must not be empty');
    if (!apiName) throw new BadRequestException('apiName must not be empty');
    const existing = await this.agents.findOne({ where: { workspaceId, apiName } });
    if (existing) throw new ConflictException(`AGENT_API_NAME_TAKEN:${apiName}`);

    const rules: Record<string, any> = {};
    if (input.allowedTools !== undefined && input.allowedTools !== null) {
      if (
        !Array.isArray(input.allowedTools) ||
        input.allowedTools.some((tool) => typeof tool !== 'string' || tool.length === 0)
      ) {
        throw new BadRequestException('allowedTools must be a list of non-empty tool names');
      }
      rules.allowedTools = input.allowedTools;
    } else {
      rules.allowedTools = [];
    }
    if (input.sensitiveOps !== undefined && input.sensitiveOps !== null) {
      this.validateSensitiveOps(input.sensitiveOps);
      rules.sensitiveOps = input.sensitiveOps;
    } else {
      rules.sensitiveOps = [];
    }
    if (input.execution !== undefined && input.execution !== null) {
      rules.execution = this.resolveExecutionConstraints(input.execution, {});
    }

    const agent = this.agents.create({
      workspaceId,
      name,
      apiName,
      description: input.description || undefined,
      prompt: input.prompt || undefined,
      guardrailRules: rules,
      isCustom: true,
      isActive: true,
      status: 'active',
      type: 'custom',
      version: 1,
    });
    await this.outbox.runInTransaction(async (manager, ob) => {
      await manager.getRepository(Agent).save(agent);
      await ob.enqueue({
        workspaceId,
        topic: OutboxTopic.AGENT_EVENTS,
        eventType: 'agent.created',
        aggregateType: 'Agent',
        aggregateId: agent.id,
        payload: {
          workspaceId,
          agentId: agent.id,
          name,
          apiName,
          by: principal.id,
        },
      });
    });
    return {
      id: agent.id,
      name,
      apiName,
      version: agent.version,
      createdAt: agent.createdAt ?? new Date(),
    };
  }

  /** Merge validated execution constraints over an existing base; malformed
   *  values are rejected rather than silently accepted. Shared by the
   *  create and update mutations. */
  private resolveExecutionConstraints(
    input: CommunityExecutionConstraintsInput | null | undefined,
    base: Record<string, unknown>,
  ): Record<string, unknown> {
    const execution = { ...base };
    if (input?.maxReActIterations != null) {
      const steps = input.maxReActIterations;
      if (!Number.isInteger(steps) || steps < 1 || steps > 50) {
        throw new BadRequestException('maxReActIterations must be an integer between 1 and 50');
      }
      execution.maxReActIterations = steps;
    }
    if (input?.timeoutMs != null) {
      const timeout = input.timeoutMs;
      if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 600_000) {
        throw new BadRequestException('timeoutMs must be between 1000 and 600000');
      }
      execution.timeoutMs = timeout;
    }
    return execution;
  }

  /** Server-side sensitiveOps validation — the adapter reads these rows
   *  defensively but a malformed write would break the executor, so the
   *  mutation is the authority. */
  private validateSensitiveOps(rows: unknown): asserts rows is Record<string, any>[] {
    if (!Array.isArray(rows)) {
      throw new BadRequestException('sensitiveOps must be an array of rules');
    }
    for (const row of rows) {
      if (typeof row !== 'object' || row === null || Array.isArray(row)) {
        throw new BadRequestException('Each sensitive-op rule must be an object');
      }
      const rule = row as Record<string, unknown>;
      if (typeof rule.operation !== 'string' || rule.operation.length === 0) {
        throw new BadRequestException('Each rule needs a non-empty operation');
      }
      if (typeof rule.toolPattern !== 'string' || rule.toolPattern.length === 0) {
        throw new BadRequestException(`Rule "${rule.operation}": toolPattern must be a non-empty string`);
      }
      if (typeof rule.riskLevel !== 'string' || !RISK_LEVELS.has(rule.riskLevel)) {
        throw new BadRequestException(`Rule "${rule.operation}": riskLevel must be one of L0–L4`);
      }
      if (typeof rule.action !== 'string' || !RULE_ACTIONS.has(rule.action)) {
        throw new BadRequestException(
          `Rule "${rule.operation}": action must be allow|audit|confirm|approve|block`,
        );
      }
      if (rule.description != null && typeof rule.description !== 'string') {
        throw new BadRequestException(`Rule "${rule.operation}": description must be a string`);
      }
    }
  }
}
