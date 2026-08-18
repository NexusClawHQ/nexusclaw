/**
 * Community agent insights — the read model behind the product-showcase
 * dashboard (spec product-showcase-dashboard, design §3–§4).
 *
 * A thin mapping layer over the pure derivation module: repository rows in,
 * view DTOs out. Everything is DERIVED from governance persistence
 * (agent_executions + approval instances); no new writes, no fabricated
 * numbers (AC-5.3 / AC-6.4).
 *
 * Naming discipline (AC-9.2): growth / coaching vocabulary only — the
 * commercial learning-loop terms stay out of the Community tree.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Agent } from '../../modules/agent/entities/agent.entity';
import { AgentExecution } from '../../modules/agent-runtime/entities/agent-execution.entity';
import { ApprovalInstance } from '../../modules/approval/entities/approval-instance.entity';
import {
  deriveAgentStats,
  deriveGrowthTimeline,
  parsePausedToolSnapshot,
  type GrowthApprovalInput,
  type GrowthExecutionInput,
} from './community-agent-growth.derivation';
import {
  CommunityAgentDetail,
  CommunityAgentStats,
  CommunityAgentSummary,
  CommunityGrowthEntry,
} from './community-console.dto';

const APPROVAL_OBJECT = 'AgentExecution';
const PAUSED_TOOL_CALL_MARKER = '__pausedToolCall__:';

@Injectable()
export class CommunityAgentInsightsService {
  constructor(
    @InjectRepository(Agent)
    private readonly agents: Repository<Agent>,
    @InjectRepository(AgentExecution)
    private readonly executions: Repository<AgentExecution>,
    @InjectRepository(ApprovalInstance)
    private readonly approvals: Repository<ApprovalInstance>,
  ) {}

  /** Enriched card-wall rows: active agents + audit-derived stats (AC-5.1). */
  async summaries(workspaceId: string): Promise<CommunityAgentSummary[]> {
    const rows = await this.agents.find({
      where: { workspaceId, isActive: true },
      order: { createdAt: 'ASC' },
    });
    if (rows.length === 0) return [];
    const [executions, approvals] = await Promise.all([
      this.executions.find({
        where: { workspaceId, agentId: In(rows.map((row) => row.id)) },
      }),
      this.approvals.find({
        where: { workspaceId, objectName: APPROVAL_OBJECT },
      }),
    ]);
    return rows.map((row) => {
      const own = executions.filter((exec) => exec.agentId === row.id);
      const ownApprovals = this.approvalsFor(approvals, own);
      return {
        id: row.id,
        name: row.name,
        status: row.status,
        description: row.description ?? null,
        stats: deriveAgentStats(
          own.map(executionInput),
          ownApprovals.map(approvalInput),
        ) as CommunityAgentStats,
      };
    });
  }

  /** Growth timeline: coaching / escalation / milestone nodes (AC-6.1/6.2). */
  async growthTimeline(
    workspaceId: string,
    agentId: string,
  ): Promise<CommunityGrowthEntry[]> {
    const executions = await this.executions.find({
      where: { workspaceId, agentId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    if (executions.length === 0) return [];
    const approvals = await this.approvals.find({
      where: {
        workspaceId,
        objectName: APPROVAL_OBJECT,
        recordId: In(executions.map((row) => row.id)),
      },
    });
    return deriveGrowthTimeline(
      executions.map(executionInput),
      approvals.map(approvalInput),
    ) as CommunityGrowthEntry[];
  }

  /** Detail aggregate for the employee page (AC-5.2). */
  async detail(
    workspaceId: string,
    agentId: string,
  ): Promise<CommunityAgentDetail | null> {
    const agent = await this.agents.findOne({
      where: { id: agentId, workspaceId },
    });
    if (!agent) return null;
    const [executions, approvals] = await Promise.all([
      this.executions.find({
        where: { workspaceId, agentId },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
      this.approvals.find({ where: { workspaceId, objectName: APPROVAL_OBJECT } }),
    ]);
    const relatedApprovals = this.approvalsFor(approvals, executions);
    return {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      apiName: agent.apiName ?? null,
      agentType: agent.type ?? null,
      version: typeof agent.version === 'number' ? agent.version : null,
      updatedAt: agent.updatedAt ? agent.updatedAt.toISOString() : null,
      description: agent.description ?? null,
      prompt: agent.prompt ?? null,
      guardrailRules: (agent.guardrailRules as Record<string, unknown> | null) ?? null,
      recentExecutions: executions.slice(0, 10),
      growthTimeline: deriveGrowthTimeline(
        executions.map(executionInput),
        relatedApprovals.map(approvalInput),
      ) as CommunityGrowthEntry[],
      stats: deriveAgentStats(
        executions.map(executionInput),
        relatedApprovals.map(approvalInput),
      ) as CommunityAgentStats,
    };
  }

  private approvalsFor(
    approvals: ApprovalInstance[],
    executions: AgentExecution[],
  ): ApprovalInstance[] {
    const ids = new Set(executions.map((row) => row.id));
    return approvals.filter((approval) => ids.has(approval.recordId));
  }
}

function executionInput(row: AgentExecution): GrowthExecutionInput {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? null,
    durationMs: typeof row.durationMs === 'number' ? row.durationMs : null,
  };
}

function approvalInput(row: ApprovalInstance): GrowthApprovalInput {
  const paused = parsePausedToolSnapshot(row.history, PAUSED_TOOL_CALL_MARKER);
  return {
    recordId: row.recordId,
    status: row.status,
    submittedAt: row.submittedAt,
    history: row.history ?? null,
    pausedToolName: paused.toolName,
    pausedRiskLevel: paused.riskLevel,
  };
}
