import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';

import { Agent } from '../../modules/agent/entities/agent.entity';
import { AgentExecution } from '../../modules/agent-runtime/entities/agent-execution.entity';
import { ApprovalInstance } from '../../modules/approval/entities/approval-instance.entity';
import { ObjectMetadata } from '../../modules/object-metadata/entities/object-metadata.entity';
import { ObjectPermission } from '../../modules/permission/entities/object-permission.entity';
import { Role } from '../../modules/role/entities/role.entity';
import { User } from '../../modules/user/entities/user.entity';
import { Workspace } from '../../modules/workspace/entities/workspace.entity';
import { WorkspaceMember } from '../../modules/workspace/entities/workspace-member.entity';
import {
  COMMUNITY_DEMO_AGENT_ID,
  COMMUNITY_DEMO_GROWTH_APPR_APPROVED_ID,
  COMMUNITY_DEMO_GROWTH_APPR_REJECTED_ID,
  COMMUNITY_DEMO_GROWTH_EXEC_APPROVED_ID,
  COMMUNITY_DEMO_GROWTH_EXEC_REJECTED_ID,
  COMMUNITY_DEMO_GROWTH_PROCESS_APPROVED_ID,
  COMMUNITY_DEMO_GROWTH_PROCESS_REJECTED_ID,
  COMMUNITY_DEMO_MEMBER_ID,
  COMMUNITY_DEMO_OBJECT_METADATA_ID,
  COMMUNITY_DEMO_OBJECT_PERMISSION_ID,
  COMMUNITY_DEMO_PASSWORD,
  COMMUNITY_DEMO_ROLE_ID,
  COMMUNITY_DEMO_SEED_ENV,
  COMMUNITY_DEMO_TOOL_LOOKUP,
  COMMUNITY_DEMO_TOOL_SEND_EMAIL,
  COMMUNITY_DEMO_USER_ID,
  COMMUNITY_DEMO_USERNAME,
  COMMUNITY_DEMO_WORKSPACE_ID,
} from './community-demo.constants';

/**
 * Idempotent runtime seed for the Community demo closed loop.
 *
 * Deliberately NOT a migration: the frozen baseline stays DDL-only. Every
 * row carries a fixed UUID and is only inserted when missing, so restarts
 * and re-exports stay deterministic. Set COMMUNITY_DEMO_SEED=false to skip.
 */
@Injectable()
export class CommunityDemoSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CommunityDemoSeedService.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaces: Repository<Workspace>,
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(WorkspaceMember)
    private readonly members: Repository<WorkspaceMember>,
    @InjectRepository(ObjectMetadata)
    private readonly objects: Repository<ObjectMetadata>,
    @InjectRepository(ObjectPermission)
    private readonly objectPermissions: Repository<ObjectPermission>,
    @InjectRepository(Agent)
    private readonly agents: Repository<Agent>,
    @InjectRepository(AgentExecution)
    private readonly executions: Repository<AgentExecution>,
    @InjectRepository(ApprovalInstance)
    private readonly approvals: Repository<ApprovalInstance>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if ((process.env[COMMUNITY_DEMO_SEED_ENV] ?? 'true').toLowerCase() === 'false') {
      this.logger.log('Community demo seed disabled by env');
      return;
    }
    try {
      await this.seed();
    } catch (error) {
      // A failed seed must not take the whole service down, but it must be
      // loud: without it the browser closed loop has nothing to sign in to.
      this.logger.error(
        `Community demo seed failed: ${(error as Error)?.message ?? error}`,
      );
    }
  }

  private async seed(): Promise<void> {
    const workspaceId = COMMUNITY_DEMO_WORKSPACE_ID;

    if (!(await this.workspaces.findOne({ where: { id: workspaceId } }))) {
      await this.workspaces.insert({
        id: workspaceId,
        displayName: 'NexusClaw Demo Workspace',
      });
    }

    if (!(await this.roles.findOne({ where: { id: COMMUNITY_DEMO_ROLE_ID } }))) {
      await this.roles.insert({
        id: COMMUNITY_DEMO_ROLE_ID,
        workspaceId,
        label: 'Demo Operator',
        apiName: 'demo_operator',
        name: 'DemoOperator',
        isActive: true,
      });
    }

    if (!(await this.users.findOne({ where: { id: COMMUNITY_DEMO_USER_ID } }))) {
      await this.users.insert({
        id: COMMUNITY_DEMO_USER_ID,
        username: COMMUNITY_DEMO_USERNAME,
        email: 'demo@example.com',
        passwordHash: await bcrypt.hash(COMMUNITY_DEMO_PASSWORD, 10),
        firstName: 'Demo',
        lastName: 'Operator',
        hasPasswordSet: true,
        isActive: true,
        defaultWorkspaceId: workspaceId,
        roleId: COMMUNITY_DEMO_ROLE_ID,
      });
    }

    if (!(await this.members.findOne({ where: { id: COMMUNITY_DEMO_MEMBER_ID } }))) {
      await this.members.insert({
        id: COMMUNITY_DEMO_MEMBER_ID,
        workspaceId,
        userId: COMMUNITY_DEMO_USER_ID,
        firstName: 'Demo',
        lastName: 'Operator',
      });
    }

    if (
      !(await this.objects.findOne({
        where: { id: COMMUNITY_DEMO_OBJECT_METADATA_ID },
      }))
    ) {
      await this.objects.insert({
        id: COMMUNITY_DEMO_OBJECT_METADATA_ID,
        workspaceId,
        nameSingular: 'Contact',
        namePlural: 'Contacts',
        labelSingular: 'Contact',
        labelPlural: 'Contacts',
      });
    }

    if (
      !(await this.objectPermissions.findOne({
        where: { id: COMMUNITY_DEMO_OBJECT_PERMISSION_ID },
      }))
    ) {
      await this.objectPermissions.insert({
        id: COMMUNITY_DEMO_OBJECT_PERMISSION_ID,
        roleId: COMMUNITY_DEMO_ROLE_ID,
        objectMetadataId: COMMUNITY_DEMO_OBJECT_METADATA_ID,
        canRead: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
      });
    }

    if (!(await this.agents.findOne({ where: { id: COMMUNITY_DEMO_AGENT_ID } }))) {
      await this.agents.insert({
        id: COMMUNITY_DEMO_AGENT_ID,
        workspaceId,
        name: 'Follow-up Assistant',
        apiName: 'demo_followup_assistant',
        description:
          'Demo digital employee: looks up a customer, then asks a human to approve an outbound follow-up email.',
        prompt:
          'You are a governed demo digital employee. Look up the customer first, then draft the follow-up email and request human approval before sending.',
        type: 'custom',
        status: 'active',
        isActive: true,
        version: 1,
        roleId: COMMUNITY_DEMO_ROLE_ID,
        serviceUserId: COMMUNITY_DEMO_USER_ID,
        guardrailRules: {
          allowedTools: [COMMUNITY_DEMO_TOOL_LOOKUP, COMMUNITY_DEMO_TOOL_SEND_EMAIL],
          // objectApiName '*': the toolPattern already scopes each rule to
          // exactly one demo tool; the executor's toolPattern/object
          // conjunction must not erase the match (toolInput carries the
          // object anyway).
          sensitiveOps: [
            {
              objectApiName: '*',
              operation: 'customer_lookup',
              riskLevel: 'L1',
              action: 'audit',
              toolPattern: COMMUNITY_DEMO_TOOL_LOOKUP,
              description:
                'Read-only customer lookup — audited, allowed to proceed',
            },
            {
              objectApiName: '*',
              operation: 'send_followup_email',
              riskLevel: 'L3',
              action: 'approve',
              toolPattern: COMMUNITY_DEMO_TOOL_SEND_EMAIL,
              description:
                'Outbound follow-up email to a customer — requires human approval',
            },
          ],
        },
      });
    }

    await this.seedGrowthHistory(workspaceId);

    this.logger.log('Community demo seed ready (demo/nexusclaw-demo)');
  }

  /**
   * Growth seed (spec product-showcase-dashboard AC-6.5): two backdated
   * historical executions — one approved to completion, one rejected at the
   * L3 gate with a coaching comment — so the training & growth view carries
   * real, honest content on first boot. Idempotent: fixed UUIDs, inserted
   * only when missing.
   */
  private async seedGrowthHistory(workspaceId: string): Promise<void> {
    const now = Date.now();
    const day = 86_400_000;

    const approvedAt = new Date(now - 2 * day);
    const rejectedAt = new Date(now - 1 * day);

    if (
      !(await this.executions.findOne({
        where: { id: COMMUNITY_DEMO_GROWTH_EXEC_APPROVED_ID },
      }))
    ) {
      await this.executions.insert({
        id: COMMUNITY_DEMO_GROWTH_EXEC_APPROVED_ID,
        workspaceId,
        agentId: COMMUNITY_DEMO_AGENT_ID,
        triggerType: 'manual',
        triggerSource: 'web',
        status: 'done',
        rawInput: '查询客户 C-1001 并发送跟进邮件。',
        outputSummary:
          'Customer C-1001 looked up (L1, audited); follow-up email approved by reviewer and sent (L3).',
        totalInputTokens: 96,
        totalOutputTokens: 128,
        createdAt: approvedAt,
        completedAt: new Date(approvedAt.getTime() + 4_200),
        durationMs: 4_200,
      });
    }

    if (
      !(await this.approvals.findOne({
        where: { id: COMMUNITY_DEMO_GROWTH_APPR_APPROVED_ID },
      }))
    ) {
      await this.approvals.insert({
        id: COMMUNITY_DEMO_GROWTH_APPR_APPROVED_ID,
        workspaceId,
        processId: COMMUNITY_DEMO_GROWTH_PROCESS_APPROVED_ID,
        recordId: COMMUNITY_DEMO_GROWTH_EXEC_APPROVED_ID,
        submittedBy: COMMUNITY_DEMO_USER_ID,
        objectName: 'AgentExecution',
        status: 'APPROVED',
        submittedAt: new Date(approvedAt.getTime() + 3_000),
        completedAt: new Date(approvedAt.getTime() + 3_800),
        history: [
          {
            stepIndex: 0,
            stepName: 'Agent Sensitive Operation',
            action: 'SUBMITTED',
            actorId: COMMUNITY_DEMO_USER_ID,
            actorName: 'executor',
            comments:
              '__pausedToolCall__:' +
              JSON.stringify({
                toolName: COMMUNITY_DEMO_TOOL_SEND_EMAIL,
                toolInput: {
                  customerId: 'C-1001',
                  subject: 'Follow-up: service check-in',
                },
                riskLevel: 'L3',
                description:
                  'Outbound follow-up email to a customer — requires human approval',
              }),
            timestamp: new Date(approvedAt.getTime() + 3_000).toISOString(),
          },
          {
            stepIndex: 1,
            stepName: 'Agent Sensitive Operation',
            action: 'APPROVED',
            actorId: COMMUNITY_DEMO_USER_ID,
            actorName: 'Demo Operator',
            comments: '内容准确、语气得体，批准发送。',
            timestamp: new Date(approvedAt.getTime() + 3_800).toISOString(),
          },
        ],
      });
    }

    if (
      !(await this.executions.findOne({
        where: { id: COMMUNITY_DEMO_GROWTH_EXEC_REJECTED_ID },
      }))
    ) {
      await this.executions.insert({
        id: COMMUNITY_DEMO_GROWTH_EXEC_REJECTED_ID,
        workspaceId,
        agentId: COMMUNITY_DEMO_AGENT_ID,
        triggerType: 'manual',
        triggerSource: 'web',
        status: 'cancelled',
        rawInput: '马上给客户发一封限时折扣邮件。',
        outputSummary:
          'Follow-up email rejected by reviewer — execution cancelled at the L3 gate.',
        totalInputTokens: 64,
        totalOutputTokens: 88,
        createdAt: rejectedAt,
        completedAt: new Date(rejectedAt.getTime() + 3_100),
        durationMs: 3_100,
      });
    }

    if (
      !(await this.approvals.findOne({
        where: { id: COMMUNITY_DEMO_GROWTH_APPR_REJECTED_ID },
      }))
    ) {
      await this.approvals.insert({
        id: COMMUNITY_DEMO_GROWTH_APPR_REJECTED_ID,
        workspaceId,
        processId: COMMUNITY_DEMO_GROWTH_PROCESS_REJECTED_ID,
        recordId: COMMUNITY_DEMO_GROWTH_EXEC_REJECTED_ID,
        submittedBy: COMMUNITY_DEMO_USER_ID,
        objectName: 'AgentExecution',
        status: 'REJECTED',
        submittedAt: new Date(rejectedAt.getTime() + 2_400),
        completedAt: new Date(rejectedAt.getTime() + 3_100),
        history: [
          {
            stepIndex: 0,
            stepName: 'Agent Sensitive Operation',
            action: 'SUBMITTED',
            actorId: COMMUNITY_DEMO_USER_ID,
            actorName: 'executor',
            comments:
              '__pausedToolCall__:' +
              JSON.stringify({
                toolName: COMMUNITY_DEMO_TOOL_SEND_EMAIL,
                toolInput: {
                  customerId: 'C-1001',
                  subject: 'Limited-time discount — act now',
                },
                riskLevel: 'L3',
                description:
                  'Outbound follow-up email to a customer — requires human approval',
              }),
            timestamp: new Date(rejectedAt.getTime() + 2_400).toISOString(),
          },
          {
            stepIndex: 1,
            stepName: 'Agent Sensitive Operation',
            action: 'REJECTED',
            actorId: COMMUNITY_DEMO_USER_ID,
            actorName: 'Demo Operator',
            comments: '语气过于急切——先确认客户预算，再谈折扣方案。',
            timestamp: new Date(rejectedAt.getTime() + 3_100).toISOString(),
          },
        ],
      });
    }
  }
}
