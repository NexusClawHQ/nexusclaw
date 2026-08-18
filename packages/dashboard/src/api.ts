export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'guardrail_pending'
  | 'done'
  | 'failed'
  | 'timeout'
  | 'cancelled';

export interface AgentStats {
  totalExecutions: number;
  successRate: number | null;
  approvalRate: number | null;
  l3EscalationCount: number;
  avgDurationMs: number | null;
}

export interface AgentSummary {
  id: string;
  name: string;
  status: string;
  description: string | null;
  stats: AgentStats;
}

export interface GrowthEntry {
  kind: 'coaching' | 'escalation' | 'milestone';
  decision?: 'APPROVED' | 'REJECTED' | null;
  comment?: string | null;
  toolName?: string | null;
  riskLevel?: string | null;
  executionId: string;
  at: string;
  actorName?: string | null;
  status?: string | null;
}

export interface SensitiveOpRule {
  objectApiName: string;
  operation: string;
  riskLevel: string;
  action: string;
  toolPattern?: string;
  description?: string;
}

export interface AgentDetail {
  id: string;
  name: string;
  status: string;
  apiName: string | null;
  agentType: string | null;
  version: number | null;
  updatedAt: string | null;
  description: string | null;
  prompt: string | null;
  guardrailRules: { sensitiveOps?: SensitiveOpRule[] } | null;
  recentExecutions: ExecutionSummary[];
  growthTimeline: GrowthEntry[];
  stats: AgentStats;
}

export interface ModelSource {
  kind: 'deterministic_smoke' | 'byo_env';
  modelId: string;
  providerKind: string;
}

export interface ExecutionSummary {
  id: string;
  agentId: string;
  status: ExecutionStatus;
  rawInput: string;
  outputSummary: string | null;
  createdAt: string;
  completedAt: string | null;
  durationMs: number | null;
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
  totalCost: number | null;
}

export interface ReactStep {
  id: string;
  stepIndex: number;
  thoughtReasoning: string | null;
  actionType: string | null;
  toolName: string | null;
  toolInput: unknown;
  observationSuccess: string | null;
  observationError: string | null;
  observationOutput: string | null;
  guardrailTriggered: boolean;
  createdAt: string;
}

export interface ToolCallRecord {
  id: string;
  toolName: string;
  status: string;
  permissionCheck: string | null;
  guardrailCheck: string | null;
  durationMs: number | null;
  input: unknown;
  output: unknown;
  createdAt: string;
}

export interface ExecutionDetail extends ExecutionSummary {
  reactSteps: ReactStep[];
  toolCallRecords: ToolCallRecord[];
}

export interface PendingApproval {
  id: string;
  executionId: string;
  toolName: string;
  riskLevel: string;
  description: string | null;
  toolInput: Record<string, unknown>;
  status: string;
  submittedAt: string;
}

export interface OutboxEventView {
  id: string;
  topic: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ApprovalDecisionResult {
  instanceId: string;
  decision: string;
  executionId: string;
  executionStatus: string;
}

export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized');
  }
}

export class GraphQLError extends Error {
  constructor(
    message: string,
    readonly errors: ReadonlyArray<{ message: string }>,
  ) {
    super(message);
  }
}

const endpoint = (import.meta.env.VITE_GRAPHQL_URL as string) ?? '/graphql';

async function request<TData>(
  query: string,
  variables: Record<string, unknown>,
  token: string | null,
): Promise<TData> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  if (response.status === 401) throw new UnauthorizedError();
  const body = (await response.json()) as {
    data?: TData;
    errors?: Array<{ message: string }>;
  };
  if (body.errors?.length) {
    throw new GraphQLError(body.errors[0]?.message ?? 'graphql error', body.errors);
  }
  if (body.data === undefined) throw new GraphQLError('empty graphql response', []);
  return body.data;
}

const operations = {
  signIn: `mutation SignIn($u: String!, $p: String!) {
    communitySignIn(username: $u, password: $p) { token expiresAt }
  }`,
  agents: `query Agents {
    communityAgents {
      id name status description
      stats { totalExecutions successRate approvalRate l3EscalationCount avgDurationMs }
    }
  }`,
  agentDetail: `query AgentDetail($id: ID!) {
    communityAgentDetail(id: $id) {
      id name status apiName agentType version updatedAt description prompt guardrailRules
      recentExecutions {
        id agentId status rawInput outputSummary createdAt completedAt
        durationMs totalInputTokens totalOutputTokens totalCost
      }
      growthTimeline { kind decision comment toolName riskLevel executionId at actorName status }
      stats { totalExecutions successRate approvalRate l3EscalationCount avgDurationMs }
    }
  }`,
  growthTimeline: `query GrowthTimeline($agentId: ID!) {
    communityAgentGrowthTimeline(agentId: $agentId) {
      kind decision comment toolName riskLevel executionId at actorName status
    }
  }`,
  modelSource: `query ModelSource {
    communityModelSource { kind modelId providerKind }
  }`,
  executions: `query Executions($n: Int!) {
    communityAgentExecutions(limit: $n) {
      id agentId status rawInput outputSummary createdAt completedAt
      durationMs totalInputTokens totalOutputTokens totalCost
    }
  }`,
  execution: `query Execution($id: ID!) {
    communityAgentExecution(id: $id) {
      id agentId status rawInput outputSummary createdAt completedAt
      durationMs totalInputTokens totalOutputTokens totalCost
      reactSteps {
        id stepIndex thoughtReasoning actionType toolName toolInput
        observationSuccess observationError observationOutput
        guardrailTriggered createdAt
      }
      toolCallRecords {
        id toolName status permissionCheck guardrailCheck durationMs
        input output createdAt
      }
    }
  }`,
  pendingApprovals: `query PendingApprovals {
    communityPendingApprovals {
      id executionId toolName riskLevel description toolInput status submittedAt
    }
  }`,
  events: `query ExecutionEvents($e: ID!) {
    communityExecutionEvents(executionId: $e) {
      id topic eventType payload createdAt
    }
  }`,
  execute: `mutation Execute($a: ID!, $i: String!) {
    communityExecuteAgent(agentId: $a, input: $i) { id status }
  }`,
  decide: `mutation Decide($i: ID!, $d: String!, $c: String) {
    communityDecideApproval(instanceId: $i, decision: $d, comment: $c) {
      instanceId decision executionId executionStatus
    }
  }`,
} as const;

export async function signIn(
  username: string,
  password: string,
): Promise<{ token: string; expiresAt: string }> {
  const data = await request<{ communitySignIn: { token: string; expiresAt: string } }>(
    operations.signIn,
    { u: username, p: password },
    null,
  );
  return data.communitySignIn;
}

export function fetchAgents(token: string): Promise<AgentSummary[]> {
  return request<{ communityAgents: AgentSummary[] }>(operations.agents, {}, token).then(
    (d) => d.communityAgents,
  );
}

export function fetchAgentDetail(
  token: string,
  id: string,
): Promise<AgentDetail | null> {
  return request<{ communityAgentDetail: AgentDetail | null }>(
    operations.agentDetail,
    { id },
    token,
  ).then((d) => d.communityAgentDetail);
}

export function fetchGrowthTimeline(
  token: string,
  agentId: string,
): Promise<GrowthEntry[]> {
  return request<{ communityAgentGrowthTimeline: GrowthEntry[] }>(
    operations.growthTimeline,
    { agentId },
    token,
  ).then((d) => d.communityAgentGrowthTimeline);
}

export function fetchModelSource(token: string): Promise<ModelSource> {
  return request<{ communityModelSource: ModelSource }>(
    operations.modelSource,
    {},
    token,
  ).then((d) => d.communityModelSource);
}

export function fetchExecutions(
  token: string,
  limit = 20,
): Promise<ExecutionSummary[]> {
  return request<{ communityAgentExecutions: ExecutionSummary[] }>(
    operations.executions,
    { n: limit },
    token,
  ).then((d) => d.communityAgentExecutions);
}

export function fetchExecution(
  token: string,
  id: string,
): Promise<ExecutionDetail | null> {
  return request<{ communityAgentExecution: ExecutionDetail | null }>(
    operations.execution,
    { id },
    token,
  ).then((d) => d.communityAgentExecution);
}

export function fetchPendingApprovals(token: string): Promise<PendingApproval[]> {
  return request<{ communityPendingApprovals: PendingApproval[] }>(
    operations.pendingApprovals,
    {},
    token,
  ).then((d) => d.communityPendingApprovals);
}

export function fetchExecutionEvents(
  token: string,
  executionId: string,
): Promise<OutboxEventView[]> {
  return request<{ communityExecutionEvents: OutboxEventView[] }>(
    operations.events,
    { e: executionId },
    token,
  ).then((d) => d.communityExecutionEvents);
}

export function executeAgent(
  token: string,
  agentId: string,
  input: string,
): Promise<{ id: string; status: ExecutionStatus }> {
  return request<{ communityExecuteAgent: { id: string; status: ExecutionStatus } }>(
    operations.execute,
    { a: agentId, i: input },
    token,
  ).then((d) => d.communityExecuteAgent);
}

export function decideApproval(
  token: string,
  instanceId: string,
  decision: 'APPROVED' | 'REJECTED',
  comment: string | null,
): Promise<ApprovalDecisionResult> {
  return request<{ communityDecideApproval: ApprovalDecisionResult }>(
    operations.decide,
    { i: instanceId, d: decision, c: comment },
    token,
  ).then((d) => d.communityDecideApproval);
}
