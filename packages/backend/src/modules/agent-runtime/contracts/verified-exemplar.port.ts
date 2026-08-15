export const VERIFIED_EXEMPLAR_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/verified-exemplar-port',
);

export type VerifiedExemplarLabel = 'positive' | 'negative';

export interface VerifiedRuntimeExemplarV1 {
  exemplarId: string;
  content: string;
  label: VerifiedExemplarLabel;
  sourceExecutionId: string;
  finalEvaluationId: string;
  outcomeId: string;
  releaseSetId: string;
  agentVersionId: string;
  cognitivePolicyDigest: string;
  rankScore: number;
  rankReason: string;
  tokenCount: number;
  digest: string;
}

export interface VerifiedExemplarDecisionV1 {
  exemplarId: string;
  selected: boolean;
  reasonCode: string;
  rankScore: number;
}

export interface VerifiedExemplarLineageV1 {
  successContractId: string;
  releaseSetId: string;
  agentVersionId: string;
  cognitivePolicyDigest: string;
}

export interface VerifiedExemplarRequestV1 {
  workspaceId: string;
  agentId: string;
  principalRoleId: string;
  principalOrgSubtreeIds: ReadonlyArray<string>;
  readableObjectApiNames: ReadonlyArray<string>;
  query: string;
  goalLineage: VerifiedExemplarLineageV1;
  taskType?: string;
  limit?: number;
  tokenBudget?: number;
  now?: Date;
}

export interface VerifiedExemplarProjectionV1 {
  selected: VerifiedRuntimeExemplarV1[];
  criticOnly: VerifiedRuntimeExemplarV1[];
  decisions: VerifiedExemplarDecisionV1[];
  candidateSetDigest: string;
}

export type VerifiedExemplarPortResultV1 =
  | ({ status: 'available' } & VerifiedExemplarProjectionV1)
  | ({
      status: 'unavailable';
      reasonCode: 'CAPABILITY_UNAVAILABLE_IN_COMMUNITY';
    } & VerifiedExemplarProjectionV1);

export interface VerifiedExemplarPort {
  retrieve(
    input: VerifiedExemplarRequestV1,
  ): Promise<VerifiedExemplarPortResultV1>;
}

export function unavailableVerifiedExemplars(): VerifiedExemplarPortResultV1 {
  return {
    status: 'unavailable',
    reasonCode: 'CAPABILITY_UNAVAILABLE_IN_COMMUNITY',
    selected: [],
    criticOnly: [],
    decisions: [],
    candidateSetDigest: '',
  };
}
