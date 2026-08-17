import { Field, ID, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';

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
