/**
 * Ephemeral playground sessions (spec hosted-playground design §2–§3).
 *
 * Workspace-per-session: a fresh workspace is seeded with the minimal
 * governed demo graph (role / user / membership / object metadata /
 * permissions / demo agent with dry-run tools), a short-lived JWT is signed
 * on the SAME path communitySignIn uses, and the session lands in the
 * registry. Deleting the workspace invalidates the token naturally — the
 * auth guard re-queries the user/membership on every request.
 *
 * No idempotency semantics here (unlike the demo seed): every session is a
 * new throwaway world with fresh UUIDs.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';

import { generateId } from '../../common/utils/generate-id';
import { Agent } from '../../modules/agent/entities/agent.entity';
import { AgentExecution } from '../../modules/agent-runtime/entities/agent-execution.entity';
import { ApprovalInstance } from '../../modules/approval/entities/approval-instance.entity';
import { GuardrailLog } from '../../modules/guardrail/entities/guardrail-log.entity';
import { ObjectMetadata } from '../../modules/object-metadata/entities/object-metadata.entity';
import { ObjectPermission } from '../../modules/permission/entities/object-permission.entity';
import { OutboxEvent } from '../../modules/outbox/entities/outbox-event.entity';
import { Role } from '../../modules/role/entities/role.entity';
import { User } from '../../modules/user/entities/user.entity';
import { Workspace } from '../../modules/workspace/entities/workspace.entity';
import { WorkspaceMember } from '../../modules/workspace/entities/workspace-member.entity';
import {
  COMMUNITY_DEMO_TOOL_LOOKUP,
  COMMUNITY_DEMO_TOOL_SEND_EMAIL,
} from '../closed-loop/community-demo.constants';
import { PlaygroundSessionRegistry } from './community-playground.registry';

const SESSION_TTL_SECONDS = 30 * 60;

const AGENT_DESCRIPTION =
  'Demo digital employee: looks up a customer, then asks a human to approve an outbound follow-up email.';
const AGENT_PROMPT =
  'You are a governed demo digital employee. Look up the customer first, then draft the follow-up email and request human approval before sending.';

@Injectable()
export class PlaygroundSessionService {
  constructor(
    private readonly jwt: JwtService,
    private readonly registry: PlaygroundSessionRegistry,
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
    @InjectRepository(GuardrailLog)
    private readonly guardrailLogs: Repository<GuardrailLog>,
    @InjectRepository(OutboxEvent)
    private readonly outboxEvents: Repository<OutboxEvent>,
  ) {}

  /** AC-1.1/2.1: create an isolated throwaway governed world. */
  async createSession(ip: string): Promise<{
    token: string;
    expiresAt: Date;
    agentId: string;
    workspaceId: string;
  }> {
    this.registry.assertSessionAllowed(ip);

    const workspaceId = generateId();
    const roleId = generateId();
    const userId = generateId();
    const memberId = generateId();
    const objectMetadataId = generateId();
    const objectPermissionId = generateId();
    const agentId = generateId();
    // Username/email short ids come from an INDEPENDENT uuidv7's random tail:
    // the workspace id's leading bits are a millisecond timestamp, so two
    // sessions created in the same millisecond would collide on the unique
    // username/email constraints if derived from it.
    const short = generateId().replace(/-/g, '').slice(-10);

    await this.workspaces.insert({
      id: workspaceId,
      displayName: `Playground ${short}`,
    });
    await this.roles.insert({
      id: roleId,
      workspaceId,
      label: 'Playground Visitor',
      apiName: `pg_visitor_${short}`,
      name: 'PlaygroundVisitor',
      isActive: true,
    });
    await this.users.insert({
      id: userId,
      username: `pg_${short}`,
      email: `pg_${short}@playground.local`,
      passwordHash: await bcrypt.hash(generateId(), 10),
      firstName: 'Playground',
      lastName: 'Visitor',
      hasPasswordSet: true,
      isActive: true,
      defaultWorkspaceId: workspaceId,
      roleId,
    });
    await this.members.insert({
      id: memberId,
      workspaceId,
      userId,
      firstName: 'Playground',
      lastName: 'Visitor',
    });
    await this.objects.insert({
      id: objectMetadataId,
      workspaceId,
      nameSingular: 'Contact',
      namePlural: 'Contacts',
      labelSingular: 'Contact',
      labelPlural: 'Contacts',
    });
    await this.objectPermissions.insert({
      id: objectPermissionId,
      roleId,
      objectMetadataId,
      canRead: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
    });
    await this.agents.insert({
      id: agentId,
      workspaceId,
      name: 'Follow-up Assistant',
      apiName: `pg_followup_${short}`,
      description: AGENT_DESCRIPTION,
      prompt: AGENT_PROMPT,
      type: 'custom',
      status: 'active',
      isActive: true,
      version: 1,
      roleId,
      serviceUserId: userId,
      guardrailRules: {
        allowedTools: [COMMUNITY_DEMO_TOOL_LOOKUP, COMMUNITY_DEMO_TOOL_SEND_EMAIL],
        sensitiveOps: [
          {
            objectApiName: '*',
            operation: 'customer_lookup',
            riskLevel: 'L1',
            action: 'audit',
            toolPattern: COMMUNITY_DEMO_TOOL_LOOKUP,
            description: 'Read-only customer lookup — audited, allowed to proceed',
          },
          {
            objectApiName: '*',
            operation: 'send_followup_email',
            riskLevel: 'L3',
            action: 'approve',
            toolPattern: COMMUNITY_DEMO_TOOL_SEND_EMAIL,
            description: 'Outbound follow-up email — requires human approval',
          },
        ],
      },
    });

    const token = await this.jwt.signAsync(
      {
        sub: userId,
        workspaceId,
        roleId,
        tokenUse: 'community_access',
      },
      { expiresIn: SESSION_TTL_SECONDS },
    );

    this.registry.register({
      workspaceId,
      userId,
      roleId,
      ip,
      lastActiveAt: new Date(),
      executions: 0,
      decisions: 0,
    });

    return {
      token,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      agentId,
      workspaceId,
    };
  }

  /** AC-2.2: recycle one session — workspace-scoped cascade by hand (the
   *  execution table has no workspace FK; steps/tools cascade from their
   *  execution). Order matters: leaves first. */
  async recycleWorkspace(workspaceId: string, roleId?: string | null): Promise<void> {
    const user = await this.users.findOne({
      where: { defaultWorkspaceId: workspaceId },
    });
    const effectiveRoleId = roleId ?? user?.roleId ?? null;
    await this.approvals.delete({ workspaceId });
    await this.executions.delete({ workspaceId });
    await this.guardrailLogs.delete({ workspaceId });
    await this.outboxEvents.delete({ workspaceId });
    await this.agents.delete({ workspaceId });
    await this.members.delete({ workspaceId });
    if (effectiveRoleId) {
      await this.objectPermissions.delete({ roleId: effectiveRoleId });
    }
    if (user) {
      await this.users.delete({ id: user.id });
    }
    if (effectiveRoleId) {
      await this.roles.delete({ id: effectiveRoleId });
    }
    await this.objects.delete({ workspaceId });
    await this.workspaces.delete({ id: workspaceId });
    this.registry.forget(workspaceId);
  }

  /** Startup sweep: any leftover playground workspace is an orphan —
   *  sessions never survive restarts by design. */
  async sweepOrphans(): Promise<number> {
    const rows = await this.workspaces
      .createQueryBuilder('w')
      .where("w.\"display_name\" LIKE 'Playground %'")
      .getMany()
      .catch(() => [] as Workspace[]);
    let swept = 0;
    for (const row of rows) {
      const user = await this.users.findOne({
        where: { defaultWorkspaceId: row.id },
      });
      await this.recycleWorkspace(row.id, user?.roleId);
      swept += 1;
    }
    this.registry.clear();
    return swept;
  }

  /** Page helper: ensure the playground profile is on. */
  assertEnabled(enabled: boolean): void {
    if (!enabled) throw new NotFoundException('Playground is not enabled');
  }
}
