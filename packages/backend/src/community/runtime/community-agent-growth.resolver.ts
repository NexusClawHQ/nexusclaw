/**
 * Product-showcase read surface for digital-employee training & growth
 * (spec product-showcase-dashboard Phase H/I). Read-only queries over the
 * insights service — no new writes, no commercial-boundary vocabulary.
 */
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { UseGuards, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Agent } from '../../modules/agent/entities/agent.entity';
import { CommunityGqlAuthGuard } from '../auth/community-gql-auth.guard';
import type { CommunityPrincipal } from '../auth/community-auth.service';
import { CurrentUser } from '../../modules/auth/decorators/current-user.decorator';
import {
  CommunityAgentDetail,
  CommunityGrowthEntry,
} from './community-console.dto';
import { CommunityAgentInsightsService } from './community-agent-insights.service';

@Resolver(() => Agent)
@UseGuards(CommunityGqlAuthGuard)
export class CommunityAgentGrowthResolver {
  constructor(
    @InjectRepository(Agent)
    private readonly agents: Repository<Agent>,
    private readonly insights: CommunityAgentInsightsService,
  ) {}

  @Query(() => [CommunityGrowthEntry], { name: 'communityAgentGrowthTimeline' })
  growthTimeline(
    @Args('agentId', { type: () => ID }) agentId: string,
    @CurrentUser() principal: CommunityPrincipal,
  ): Promise<CommunityGrowthEntry[]> {
    return this.insights.growthTimeline(principal.defaultWorkspaceId, agentId);
  }

  @Query(() => CommunityAgentDetail, { name: 'communityAgentDetail' })
  async agentDetail(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() principal: CommunityPrincipal,
  ): Promise<CommunityAgentDetail> {
    const detail = await this.insights.detail(principal.defaultWorkspaceId, id);
    if (!detail) throw new NotFoundException('Agent not found');
    return detail;
  }
}
