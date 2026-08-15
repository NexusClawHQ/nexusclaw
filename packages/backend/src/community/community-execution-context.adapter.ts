import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  type ExecutionContextAgentInput,
  type ExecutionContextPort,
} from '../modules/agent-runtime/contracts/runtime-boundary-ports';
import type {
  AgentExecutionContext,
  ParsedIntent,
} from '../modules/agent-runtime/interfaces';
import { ObjectMetadata } from '../modules/object-metadata/entities/object-metadata.entity';
import { ObjectPermission } from '../modules/permission/entities/object-permission.entity';

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/**
 * Public, conservative execution-context owner. It derives the effective role
 * from the frozen two-field Agent identity rule and projects only persisted
 * role/object grants. Missing identity or grants never widens access.
 */
@Injectable()
export class CommunityExecutionContextAdapter implements ExecutionContextPort {
  constructor(
    @InjectRepository(ObjectPermission)
    private readonly objectPermissions: Repository<ObjectPermission>,
    @InjectRepository(ObjectMetadata)
    private readonly objectMetadata: Repository<ObjectMetadata>,
  ) {}

  /**
   * Community executions carry no cognitive projection and no exemplar
   * capability (the private-edition ports report
   * `CAPABILITY_UNAVAILABLE_IN_COMMUNITY`) — nothing to attach.
   */
  async attachRuntimeExemplars(): Promise<void> {
    return undefined;
  }

  async buildContext(
    agent: ExecutionContextAgentInput,
    intent: ParsedIntent,
    workspaceId: string,
    executionId = '',
    authenticatedCaller?: {
      userId: string;
      roleId: string;
      workspaceId: string;
      orgNodeId?: string;
    },
  ): Promise<AgentExecutionContext> {
    if (agent.workspaceId !== workspaceId) {
      throw new Error('COMMUNITY_EXECUTION_WORKSPACE_MISMATCH');
    }
    const independent = Boolean(agent.serviceUserId && agent.roleId);
    const roleId = independent ? agent.roleId : authenticatedCaller?.roleId;
    if (!roleId || (!independent && authenticatedCaller?.workspaceId !== workspaceId)) {
      throw new Error('COMMUNITY_EXECUTION_PRINCIPAL_REQUIRED');
    }

    const grants = await this.objectPermissions.find({ where: { roleId } });
    const metadataIds = [...new Set(grants.map((grant) => grant.objectMetadataId))];
    const metadata = metadataIds.length
      ? await this.objectMetadata
          .createQueryBuilder('object')
          .where('object.id IN (:...ids)', { ids: metadataIds })
          .andWhere('object.workspaceId = :workspaceId', { workspaceId })
          .getMany()
      : [];
    const apiNames = new Map(metadata.map((item) => [item.id, item.nameSingular]));
    const rules = asRecord(agent.guardrailRules);
    const allowedTools = Array.isArray(rules.allowedTools)
      ? rules.allowedTools.filter((value): value is string => typeof value === 'string')
      : [];
    const sensitiveOps = Array.isArray(rules.sensitiveOps)
      ? (rules.sensitiveOps as AgentExecutionContext['security']['sensitiveOps'])
      : [];

    return {
      executionId,
      workspaceId,
      triggeredBy: authenticatedCaller?.userId,
      actorType: independent ? 'agent' : 'user',
      actorId: independent ? agent.serviceUserId! : authenticatedCaller!.userId,
      source: 'community_api',
      security: {
        agentId: agent.id,
        roleId,
        objectPermissions: grants.flatMap((grant) => {
          const objectApiName = apiNames.get(grant.objectMetadataId);
          return objectApiName
            ? [{
                objectApiName,
                canRead: grant.canRead,
                canCreate: grant.canCreate,
                canUpdate: grant.canEdit,
                canDelete: grant.canDelete,
              }]
            : [];
        }),
        fieldMasks: [],
        dataScope: independent && agent.orgNodeId
          ? { type: 'org_subtree', orgNodeId: agent.orgNodeId, orgSubtreeIds: [agent.orgNodeId] }
          : { type: 'own', orgNodeId: authenticatedCaller?.orgNodeId },
        sensitiveOps,
      },
      business: {
        intent,
        relatedRecords: [],
        conversationHistory: [],
        userPreferences: {},
        queryAuthority: { structuredConstraints: [], rankingHints: [] },
      },
      knowledge: {
        relevantSOPs: [],
        domainKnowledge: [],
        companyPolicies: [],
      },
      constraints: {
        maxTokens: 4_096,
        maxOutputTokensPerStep: 512,
        maxStepTokens: 1_024,
        timeoutMs: 60_000,
        maxToolCalls: 4,
        allowedTools,
        maxReActIterations: 4,
        maxToolRetryAttempts: 0,
        toolRetryBackoffMs: 0,
        sensitiveOps,
        guardrailRuleIds: Array.isArray(rules.ruleIds)
          ? rules.ruleIds.filter((value): value is string => typeof value === 'string')
          : undefined,
      },
      dataAccessContext: authenticatedCaller,
    };
  }
}
