import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';

import { AgentExecution } from '../../modules/agent-runtime/entities/agent-execution.entity';

/** Pending agent-tool approval surfaced to the browser console. */
@ObjectType('CommunityPendingApproval')
export class CommunityPendingApproval {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  executionId: string;

  @Field()
  toolName: string;

  @Field()
  riskLevel: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => GraphQLJSON)
  toolInput: Record<string, any>;

  @Field()
  status: string;

  @Field()
  submittedAt: Date;
}

/** Result of communityDecideApproval. */
@ObjectType('CommunityApprovalDecisionResult')
export class CommunityApprovalDecisionResult {
  @Field(() => ID)
  instanceId: string;

  /** Stable decision code: APPROVED | REJECTED. */
  @Field()
  decision: string;

  @Field(() => ID)
  executionId: string;

  @Field()
  executionStatus: string;
}

/** Outbox event row projected for the audit-chain view. */
@ObjectType('CommunityOutboxEventView')
export class CommunityOutboxEventView {
  @Field(() => ID)
  id: string;

  @Field()
  topic: string;

  @Field()
  eventType: string;

  @Field(() => GraphQLJSON)
  payload: Record<string, any>;

  @Field()
  createdAt: Date;
}

/** Read-only model-source metadata for the console badge. Stable kind code,
 *  display-safe ids only — never the API key or endpoint URL. */
@ObjectType('CommunityModelSource')
export class CommunityModelSource {
  /** Stable code (never a display string): deterministic_smoke | byo_env. */
  @Field()
  kind: string;

  @Field()
  modelId: string;

  @Field()
  providerKind: string;
}

/** One node of a digital employee's growth timeline (spec
 *  product-showcase-dashboard AC-6.1). Derived from governance data —
 *  approval decisions, L3 escalations, execution milestones. No new writes. */
@ObjectType('CommunityGrowthEntry')
export class CommunityGrowthEntry {
  /** Stable kind code: coaching | escalation | milestone. */
  @Field()
  kind: string;

  /** For coaching entries: APPROVED | REJECTED. */
  @Field(() => String, { nullable: true })
  decision?: string | null;

  /** For coaching entries: the approver's comment (coaching note). */
  @Field(() => String, { nullable: true })
  comment?: string | null;

  @Field(() => String, { nullable: true })
  toolName?: string | null;

  @Field(() => String, { nullable: true })
  riskLevel?: string | null;

  @Field(() => ID)
  executionId: string;

  @Field()
  at: Date;

  @Field(() => String, { nullable: true })
  actorName?: string | null;

  /** For milestone entries: terminal execution status. */
  @Field(() => String, { nullable: true })
  status?: string | null;
}

/** Audit-chain-derived statistics for one digital employee (AC-6.4).
 *  Null (not 0) when there is no sample — never a fabricated number. */
@ObjectType('CommunityAgentStats')
export class CommunityAgentStats {
  @Field(() => Int)
  totalExecutions: number;

  @Field(() => Float, { nullable: true })
  successRate?: number | null;

  @Field(() => Float, { nullable: true })
  approvalRate?: number | null;

  @Field(() => Int)
  l3EscalationCount: number;

  @Field(() => Float, { nullable: true })
  avgDurationMs?: number | null;
}

/** Enriched list row for the employee card wall (AC-5.1). */
@ObjectType('CommunityAgentSummary')
export class CommunityAgentSummary {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  status: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => CommunityAgentStats)
  stats: CommunityAgentStats;
}

/** Employee detail aggregate (AC-5.2). Read-only. */
@ObjectType('CommunityAgentDetail')
export class CommunityAgentDetail {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  status: string;

  @Field(() => String, { nullable: true })
  apiName?: string | null;

  @Field(() => String, { nullable: true })
  agentType?: string | null;

  @Field(() => Int, { nullable: true })
  version?: number | null;

  @Field(() => String, { nullable: true })
  updatedAt?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => String, { nullable: true })
  prompt?: string | null;

  /** guardrailRules JSON column projected read-only (AC-7.1). */
  @Field(() => GraphQLJSON, { nullable: true })
  guardrailRules?: Record<string, any> | null;

  @Field(() => [AgentExecution])
  recentExecutions: AgentExecution[];

  @Field(() => [CommunityGrowthEntry])
  growthTimeline: CommunityGrowthEntry[];

  @Field(() => CommunityAgentStats)
  stats: CommunityAgentStats;
}
