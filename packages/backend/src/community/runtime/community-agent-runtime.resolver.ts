import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { BadRequestException, NotFoundException, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CurrentUser } from '../../modules/auth/decorators/current-user.decorator';
import { AgentExecution } from '../../modules/agent-runtime/entities/agent-execution.entity';
import { ExecutorEngineService } from '../../modules/agent-runtime/executor/executor-engine.service';
import { CommunityGqlAuthGuard } from '../auth/community-gql-auth.guard';
import type { CommunityPrincipal } from '../auth/community-auth.service';

@Resolver(() => AgentExecution)
@UseGuards(CommunityGqlAuthGuard)
export class CommunityAgentRuntimeResolver {
  constructor(
    @InjectRepository(AgentExecution)
    private readonly executions: Repository<AgentExecution>,
    private readonly executor: ExecutorEngineService,
  ) {}

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
}
