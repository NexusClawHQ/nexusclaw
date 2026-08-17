export type RuntimeJsonPrimitive = string | number | boolean | null;
export type RuntimeJsonValue =
  | RuntimeJsonPrimitive
  | RuntimeJsonValue[]
  | { [key: string]: RuntimeJsonValue };

export const MODEL_INVOCATION_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/model-invocation-port',
);
export const EXECUTION_USAGE_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/execution-usage-port',
);
export const BEHAVIOR_FEEDBACK_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/behavior-feedback-port',
);
export const AUTONOMY_GATE_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/autonomy-gate-port',
);
export const KNOWLEDGE_CONTEXT_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/knowledge-context-port',
);
export const EXECUTION_ADMISSION_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/execution-admission-port',
);
export const EXECUTION_BUDGET_POLICY_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/execution-budget-policy-port',
);
export const RUNTIME_BEHAVIOR_EVENT_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/runtime-behavior-event-port',
);
export const EXECUTOR_MODEL_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/executor-model-port',
);
export const EXECUTION_CONTEXT_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/execution-context-port',
);
export const EXECUTION_APPROVAL_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/execution-approval-port',
);
export const EXECUTION_CONSTITUTION_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/execution-constitution-port',
);
export const POST_EXECUTION_MEMORY_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/post-execution-memory-port',
);
export const GOVERNED_EXECUTION_CONTEXT_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/governed-execution-context-port',
);
export const EXECUTION_COGNITION_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/execution-cognition-port',
);
export const SUCCESS_EVALUATION_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/success-evaluation-port',
);
export const DURABLE_APPROVAL_SUBJECT_PORT = Symbol.for(
  '@nexusclaw/agent-runtime/durable-approval-subject-port',
);

export interface ExecutionContextAgentInput {
  id: string;
  workspaceId: string;
  roleId?: string | null;
  serviceUserId?: string | null;
  orgNodeId?: string | null;
  guardrailRules?: Record<string, unknown> | null;
}

export interface AuthenticatedExecutionCaller {
  userId: string;
  roleId: string;
  workspaceId: string;
  orgNodeId?: string;
}

export interface ExecutionContextPort {
  buildContext(
    agent: ExecutionContextAgentInput,
    intent: ParsedIntent,
    workspaceId: string,
    executionId?: string,
    authenticatedCaller?: AuthenticatedExecutionCaller,
  ): Promise<AgentExecutionContext>;

  /**
   * Re-run the verified + curated exemplar retrieval onto an EXISTING
   * cognitive projection. The executor's lazy goal-freeze path
   * calls this after `loadProjection` succeeds — buildContext ran before the
   * goal snapshot existed for such executions, so the exemplar passes were
   * skipped there and the fresh projection would otherwise carry empty
   * exemplars (no prompt injection, no persisted curated decision audit).
   */
  attachRuntimeExemplars(input: {
    agent: ExecutionContextAgentInput;
    intent: ParsedIntent;
    workspaceId: string;
    cognitive: NonNullable<AgentExecutionContext['cognitive']>;
    authenticatedCaller?: AuthenticatedExecutionCaller;
  }): Promise<void>;
}

export interface ExecutionApprovalRequest {
  workspaceId: string;
  agentExecutionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  riskLevel: string;
  description: string;
  traceId?: string;
  correlationId?: string;
  actorType?: string;
  actorId?: string;
  source?: string;
  approvalPreparation?: StaticToolApprovalPreparationV1;
}

export interface ExecutionApprovalPort {
  createAgentApproval(request: ExecutionApprovalRequest): Promise<{ id: string }>;
}

export interface ExecutionConstitutionPort {
  getActiveText(workspaceId: string): Promise<string | null>;
}

export interface PostExecutionMemoryPort {
  distillAfterExecution(
    execution: { id: string; workspaceId: string; outputSummary?: string; rawInput?: string },
    context: AgentExecutionContext,
    summary: string,
  ): Promise<void>;
}

export interface GovernedExecutionContextPort {
  prepareAgentContext(
    executionId: string,
    legacyContext: AgentExecutionContext,
    options: { allowActiveHeadResolution: boolean },
  ): Promise<(AgentExecutionContext & GovernedToolExecutionContextV1) | null>;
}

export interface ExecutionCognitionPort {
  freezeGoal(execution: unknown): Promise<unknown>;
  loadProjection(executionId: string, workspaceId: string): Promise<any>;
  nextContextManifestOrdinal(executionId: string, workspaceId: string): Promise<number>;
  freezeContextManifest(
    execution: unknown,
    context: AgentExecutionContext,
    ordinal: number,
    renderedInput: unknown,
  ): Promise<unknown>;
}

export interface SuccessEvaluationPort {
  appendEvaluation(input: {
    workspaceId: string;
    executionId: string;
    idempotencyKey: string;
  }): Promise<unknown>;
}

/** Opaque private durable-payload handoff. Community never registers this port. */
export interface DurableApprovalSubjectPort {
  claimApprovedToolPayloadByIds(input: Record<string, unknown>): Promise<any>;
  acknowledgeToolPayloadHandoff(
    workspaceId: string,
    payloadEnvelopeId: string,
    claimOwnerId: string,
  ): Promise<unknown>;
}

export interface ExecutorModelPort {
  chat(
    request: ChatRequest,
    tier: number,
    context?: {
      workspaceId?: string;
      agentId?: string;
      executionId?: string;
      traceId?: string;
      correlationId?: string;
      actorType?: string;
      actorId?: string;
      source?: string;
      taskType?: string;
      agentModelId?: string;
      agentProvider?: string;
      [key: string]: unknown;
    },
  ): Promise<ChatResponse>;
  selectModel(
    taskType: string,
    agentModelConfig?: { tier?: number; modelId?: string } | null,
  ): ModelConfig;
  resolveCostModel(
    observedModelId?: string | null,
    fallback?: ModelConfig,
  ): ModelConfig;
  estimateCost(
    inputTokens: number,
    outputTokens: number,
    model: ModelConfig,
  ): number;
}

export interface RuntimeBehaviorEventInput {
  workspaceId: string;
  executionId: string;
  agentId?: string | null;
  eventType: string;
  eventSource: string;
  riskLevel?: 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
  knowledgeRefs?: Array<{
    sourceId: string;
    chunkId?: string | null;
    sourceRef?: string | null;
    score?: number | null;
    cited?: boolean | null;
    verified?: boolean | null;
    gapDetected?: boolean | null;
    conflictDetected?: boolean | null;
  }>;
  [key: string]: unknown;
}

export interface RuntimeBehaviorEventPort {
  capture(input: RuntimeBehaviorEventInput): Promise<
    | { status: 'recorded'; auditRef: string }
    | { status: 'unavailable'; reasonCode: 'CAPABILITY_UNAVAILABLE_IN_COMMUNITY' }
    | {
        status: 'failed';
        reasonCode: 'BEHAVIOR_FEEDBACK_CAPTURE_FAILED';
        auditRequired: true;
      }
  >;
}

export type ExecutionBudgetDecision =
  | { decision: 'allow' }
  | { decision: 'pause'; reasonCode: string }
  | { decision: 'downgrade'; reasonCode: string; modelTier: number };

export interface ExecutionBudgetPolicyPort {
  preflight(input: {
    workspaceId: string;
    agentId: string;
  }): Promise<ExecutionBudgetDecision>;
  checkIteration(input: {
    workspaceId: string;
    agentId: string;
    iteration: number;
  }): Promise<{ allowed: true } | { allowed: false; reasonCode: string }>;
}

export interface ExecutionAdmissionPort {
  assertExecutionAllowed(input: {
    workspaceId: string;
    agentId: string;
    executionId?: string;
    mode: 'standard' | 'candidate_test';
  }): void | Promise<void>;
}

export interface ModelInvocationRequest {
  workspaceId: string;
  executionId: string;
  agentId: string;
  messages: ReadonlyArray<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
  }>;
  tools?: ReadonlyArray<{
    name: string;
    description?: string;
    inputSchema: RuntimeJsonValue;
  }>;
  maxOutputTokens?: number;
}

export interface ModelInvocationResponse {
  content: string;
  finishReason: 'stop' | 'tool_call' | 'length' | 'error';
  toolCalls?: ReadonlyArray<{
    id: string;
    name: string;
    input: RuntimeJsonValue;
  }>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  providerRef: string;
  modelRef: string;
}

export interface ModelInvocationPort {
  invoke(request: ModelInvocationRequest): Promise<ModelInvocationResponse>;
}

export interface ExecutionUsageObservation {
  workspaceId: string;
  executionId: string;
  agentId: string;
  providerRef: string;
  modelRef: string;
  inputTokens: number;
  outputTokens: number;
  observedAt: string;
}

export interface ExecutionUsagePort {
  assertWithinOperationalBudget(input: {
    workspaceId: string;
    executionId: string;
    agentId: string;
    iteration: number;
  }): Promise<{ allowed: true } | { allowed: false; reasonCode: string }>;

  recordUsage(observation: ExecutionUsageObservation): Promise<void>;
}

export interface BehaviorFeedbackObservation {
  workspaceId: string;
  executionId: string;
  agentId: string;
  traceId?: string;
  correlationId?: string;
  status: 'completed' | 'failed' | 'blocked';
  redactedSummary?: string;
  successEvaluation?: {
    evaluationId: string;
    lifecycle: string;
    review: string;
    decision: string;
    hardGatePassed: boolean;
    softUtility?: number;
  };
}

export interface BehaviorFeedbackPort {
  capture(
    observation: BehaviorFeedbackObservation,
  ): Promise<
    | { status: 'recorded'; auditRef: string }
    | { status: 'unavailable'; reasonCode: 'CAPABILITY_UNAVAILABLE_IN_COMMUNITY' }
    | {
        status: 'failed';
        reasonCode: 'BEHAVIOR_FEEDBACK_CAPTURE_FAILED';
        auditRequired: true;
      }
  >;
}

export interface AutonomyGateInput {
  workspaceId: string;
  executionId: string;
  agentId: string;
  actionCode: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  policyRef?: string;
}

export type AutonomyGateDecision =
  | {
      decision: 'allow';
      reasonCode: string;
      auditRequired: true;
      policyRef: string;
    }
  | {
      decision: 'approval_required';
      reasonCode: string;
      auditRequired: true;
      policyRef: string;
    }
  | {
      decision: 'deny';
      reasonCode: string;
      auditRequired: true;
      policyRef?: string;
    };

export interface AutonomyGatePort {
  evaluate(input: AutonomyGateInput): Promise<AutonomyGateDecision>;
}

export function missingAutonomyPolicyDecision(): AutonomyGateDecision {
  return {
    decision: 'deny',
    reasonCode: 'AUTHORIZATION_POLICY_MISSING',
    auditRequired: true,
  };
}

export interface KnowledgeContextRequest {
  workspaceId: string;
  executionId: string;
  agentId: string;
  principalRoleId: string;
  query: string;
  objectApiName?: string;
  recordId?: string;
}

export type KnowledgeContextResult =
  | {
      status: 'available';
      authorizationDecisionRef: string;
      blocks: ReadonlyArray<{
        sourceRef: string;
        content: string;
        trust: 'verified' | 'unverified';
      }>;
    }
  | {
      status: 'unavailable';
      reasonCode: 'CAPABILITY_UNAVAILABLE_IN_COMMUNITY';
      blocks: readonly [];
    };

export interface KnowledgeContextPort {
  load(request: KnowledgeContextRequest): Promise<KnowledgeContextResult>;
}

export function unavailableKnowledgeContext(): KnowledgeContextResult {
  return {
    status: 'unavailable',
    reasonCode: 'CAPABILITY_UNAVAILABLE_IN_COMMUNITY',
    blocks: [],
  };
}
import type {
  AgentExecutionContext,
  ChatRequest,
  ChatResponse,
  ModelConfig,
  ParsedIntent,
  StaticToolApprovalPreparationV1,
  GovernedToolExecutionContextV1,
} from './agent-interfaces.js';
