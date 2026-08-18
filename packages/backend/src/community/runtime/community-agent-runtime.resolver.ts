import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
  CommunityModelSource,
  CommunityOutboxEventView,
  CommunityPendingApproval,
} from './community-console.dto';
import { CommunityModelSourceService } from '../byo/community-model-source.service';
import { CommunityAgentInsightsService } from './community-agent-insights.service';

const PAUSED_TOOL_CALL_MARKER = '__pausedToolCall__:';

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
}
