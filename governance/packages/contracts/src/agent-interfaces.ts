/**
 * Core TypeScript interfaces for Agent Runtime Engine
 */
// ---- Inlined from nexusclaw-core (private) shared/agent-executable-assets
// release-evidence.types.ts + canonical-hash.ts — extraction PR-2 keeps the
// contracts package dependency-free by inlining the exact structural types.

export type Sha256Digest = `sha256:${string}`;

export interface CandidateIsolationBinding {
  readonly isolationBindingId: string;
  readonly sourceWorkspaceId: string;
  readonly executionWorkspaceId: string;
  readonly workspaceMode: 'isolated-test';
  readonly authorizationGeneration: string;
  readonly leaseId: string;
  readonly isolationSnapshotHash: Sha256Digest;
}

export interface ReleaseExecutionSnapshotV1 {
  readonly schemaVersion: 'nexusclaw.release-execution-snapshot/v1';
  readonly mode: 'active_snapshot' | 'candidate_test';
  readonly sourceWorkspaceId: string;
  readonly executionWorkspaceId: string;
  readonly releaseSetId: string;
  readonly sourceDigest: Sha256Digest;
  readonly itemDigest: Sha256Digest;
  readonly materializedDigest: Sha256Digest;
  readonly envelopeDigest: Sha256Digest | null;
  readonly isolationBinding?: CandidateIsolationBinding;
}
// ---- end inlined release snapshot types ----
// Type-only: avoids a runtime cycle (registry does not import interfaces).
// AIRuntimeCapability is a frozen string union owned by the registry, the
// single source of truth for capability names (ARCW-101).
// Inlined from nexusclaw-core (private) agent-runtime
// ai-provider-runtime.registry.ts — the frozen capability string union.
export type AIRuntimeCapability =
  | 'chat'
  | 'embedding'
  | 'vision'
  | 'json'
  | 'tool_calling'
  | 'streaming'
  | 'reasoning';

// === Intent Router ===

export interface ParsedIntent {
  primaryIntent: string;
  secondaryIntent: string;
  confidence: number;
  entities: Record<string, unknown>;
  rawInput: string;
}

export interface IntentRoute {
  intentPattern: string;
  agentId: string;
  requiredCapabilities: string[];
  priority: number;
  preconditions: PreconditionRule[];
  fallback: 'queue' | 'human' | 'reject';
}

export interface PreconditionRule {
  type: 'permission' | 'time_window' | 'quota';
  config: Record<string, unknown>;
}

// === Execution Context ===

export interface ObjectPermission {
  objectApiName: string;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface FieldMaskRule {
  objectApiName: string;
  fieldApiName: string;
  maskType: 'hide' | 'partial' | 'hash' | 'range';
  maskConfig?: Record<string, unknown>;
}

export interface DataScopeRule {
  type: 'all' | 'org_subtree' | 'own' | 'custom';
  orgNodeId?: string;
  orgSubtreeIds?: string[];
  customFilter?: string;
}

export interface SensitiveOpRule {
  objectApiName: string;
  operation: string;
  riskLevel: RiskLevel;
  action: 'allow' | 'audit' | 'confirm' | 'approve' | 'block';
  toolPattern?: string;
  description?: string;
}

export type RiskLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export interface RecordReference {
  objectApiName: string;
  recordId: string;
  label?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface UserPreference {
  language?: string;
  timezone?: string;
}

export interface SOPSnippet {
  id: string;
  title: string;
  content: string;
  relevanceScore: number;
}

export interface KnowledgeChunk {
  id: string;
  content: string;
  sourceType: string;
}

export interface PolicyRule {
  id: string;
  name: string;
  content: string;
}

export type QueryConstraintSource = 'user_explicit' | 'structured_rule';

export interface AuthorizedQueryConstraint {
  objectApiName: string;
  fieldApiName: string;
  operator: string;
  value: unknown;
  source: QueryConstraintSource;
  /** User-input hash or versioned structured-rule reference. */
  sourceRef: string;
  digest: string;
}

export interface QueryRankingHint {
  objectApiName: string;
  fieldApiName?: string;
  value?: unknown;
  source: 'prompt_preference' | 'user_preference' | 'structured_rule';
  sourceRef: string;
}

export interface AgentExecutionContext {
  executionId: string;
  workspaceId: string;
  triggeredBy?: string;
  traceId?: string;
  correlationId?: string;
  actorType?: string;
  actorId?: string;
  source?: string;
  /**
   * Opaque private enrichment. Community never manufactures this projection;
   * the private cognition adapter owns its schema and runtime validation.
   */
  cognitive?: any;
  security: {
    agentId: string;
    roleId: string;
    objectPermissions: ObjectPermission[];
    fieldMasks: FieldMaskRule[];
    dataScope: DataScopeRule;
    sensitiveOps: SensitiveOpRule[];
  };
  business: {
    intent: ParsedIntent;
    relatedRecords: RecordReference[];
    conversationHistory: Message[];
    userPreferences: UserPreference;
    temporalContext?: {
      asOf: string;
      workspaceTimezone: string;
      localDate: string;
    };
    /**
     * Trusted query constraints assembled outside model output. The model may
     * propose filters, but record tools accept them only when their values are
     * explicit in intent.rawInput or match one of these structured constraints.
     */
    queryAuthority?: {
      structuredConstraints: AuthorizedQueryConstraint[];
      rankingHints: QueryRankingHint[];
    };
  };
  knowledge: {
    relevantSOPs: SOPSnippet[];
    domainKnowledge: KnowledgeChunk[];
    companyPolicies: PolicyRule[];
  };
  /**
   * Per-customer AI long-term memory (account.aiMemory), resolved + injected when
   * the task is about a specific account. Read-only context for the agent: the
   * accumulated summary / key facts / commitments / risk signals for that customer.
   */
  customerMemory?: {
    accountId: string;
    accountName: string;
    memory: string;
  } | null;
  constraints: {
    /** Cumulative model-token budget for the complete execution. */
    maxTokens: number;
    /** Maximum output tokens requested from the provider for one model call. */
    maxOutputTokensPerStep?: number;
    timeoutMs: number;
    maxToolCalls: number;
    allowedTools: string[];
    maxReActIterations: number;
    /** Maximum combined input/output tokens charged to one model step. */
    maxStepTokens?: number;
    /** Retries after the initial tool attempt; deterministic errors never retry. */
    maxToolRetryAttempts?: number;
    /** Base delay for exponential tool retry backoff. */
    toolRetryBackoffMs?: number;
    sensitiveOps: SensitiveOpRule[];
    /**
     * Guardrail rule IDs bound to this agent
     * (projected from `agent.guardrailRules.ruleIds` by ContextBuilder.
     * calculateConstraints, alongside sensitiveOps). The executor passes
     * these to `GuardrailEngineService.evaluate` to scope rule loading to
     * this agent.
     *
     * Three-state semantics (design D-1.1):
     *   - `undefined`: agent has no guardrailRules field, or the field has
     *     no `ruleIds` key. Legacy / unbound assistant. Executor SKIPS
     *     evaluate (workspace-level policy shouldn't be forced in the
     *     agent execution context — left to a future spec).
     *   - `[]`: agent explicitly bound an empty array. Agent declares "I
     *     have no guardrail." Executor SKIPS evaluate (avoids `id IN ()`
     *     matching the empty-set degenerate).
     *   - `['id1', 'id2']`: bound rule IDs. Executor calls evaluate with
     *     this filter.
     */
    guardrailRuleIds?: string[];
  };
  /**
   * One-shot approval grant: set by the executor on resume so that
   * the single approved tool call passes the tool-registry L3 escalation gate.
   * Cleared immediately after the approved tool executes once.
   */
  approvalGrant?: ToolApprovalGrant;
  /**
   * Row-/field-level data-access identity threaded into ObjectRecordService
   * (FLS read strip + row-security WHERE clause). Set by the MCP server from
   * the caller's principal so MCP reads enforce the caller-role's FLS and
   * sharing — exactly like a native UI request (docs/specs/mcp-server-v2 P0-A).
   * Structurally a UserDataAccessContext; left as an inline shape to avoid an
   * agent-runtime → data-sharing module dependency. UNDEFINED for native agent
   * runs, which preserves their current ObjectRecordService call shape
   * byte-for-byte (the data layer treats absent context as a system call).
   */
  dataAccessContext?: {
    userId: string;
    roleId: string;
    workspaceId: string;
    orgNodeId?: string;
  };
}

/**
 * Immutable executable-v2 service principal. This is the AgentRuntime owner
 * of the contract (not a shared/package mirror) and extends the same identity
 * and data-scope semantics already used by AgentExecutionContext and
 * UserDataAccessContext.
 */
export interface AgentPrincipalContext {
  readonly workspaceId: string;
  readonly actorType: 'agent';
  readonly agentId: string;
  readonly agentVersionId: string;
  readonly serviceIdentityId: string;
  readonly roleId: string;
  readonly orgNodeId?: string;
  readonly dataScope: Readonly<DataScopeRule>;
  readonly triggeredByUserId?: string;
  readonly executionId: string;
  readonly releaseSetId: string;
}

export type GovernedExecutionParentV1 =
  | {
      readonly kind: 'agent';
      readonly agentExecutionId: string;
      readonly reactStepId?: string;
    }
  | {
      readonly kind: 'flow';
      readonly flowExecutionId: string;
      readonly flowStepLogId: string;
      readonly flowVersionId: string;
      readonly flowNodeId: string;
    };

export interface GovernedToolExecutionContextV1 {
  readonly principal: Readonly<AgentPrincipalContext>;
  readonly release: Readonly<ReleaseExecutionSnapshotV1>;
  readonly parent: Readonly<GovernedExecutionParentV1>;
  readonly traceId: string;
  readonly correlationId: string;
  readonly constraints: Readonly<AgentExecutionContext['constraints']>;
  /**
   * Server-owned one-shot resume grant. Executable-v2 grants carry the exact
   * persisted ToolCall/input/release tuple so the registry can re-enter the
   * existing REQUIRES_APPROVAL row instead of calling begin() again.
   */
  readonly approvalGrant?: Readonly<ToolApprovalGrant>;
}

export interface ToolApprovalGrant {
  toolName: string;
  approvalInstanceId: string;
  /** Required for executable-v2; omitted only by the legacy approval path. */
  toolCallId?: string;
  inputDigest?: string;
  releaseSetId?: string;
  publishedChecksum?: string;
  consumedAt?: string;
}

/**
 * Narrow, cycle-safe port implemented by ApprovalModule. ToolRegistry is the
 * only caller: it hands the immutable resolved-tool/context tuple to the
 * subject owner, which atomically creates the ToolCall, approval and encrypted
 * payload envelope. No mutable ApprovalProcess or current release head is
 * accepted by this contract.
 */
export const TOOL_APPROVAL_SUBJECT_PORT =
  Symbol('TOOL_APPROVAL_SUBJECT_PORT');

export interface SubmitToolApprovalSubjectV1 {
  readonly toolName: string;
  readonly rawInput: unknown;
  readonly resolvedTool: Readonly<{
    functionRevisionId: string;
    descriptorHash: string;
    publishedChecksum: string;
    runtimeProviderId: string;
    exportDescriptor: Readonly<{
      toolName: string;
      declaredRiskLevel: RiskLevel;
    }>;
  }>;
  readonly context: GovernedToolExecutionContextV1;
}

export interface SubmitStaticToolApprovalSubjectV1 {
  readonly toolName: 'slack.message.send' | 'teams.message.send';
  readonly rawInput: unknown;
  readonly context: AgentExecutionContext;
  readonly preparation: StaticToolApprovalPreparationV1;
}

interface ToolApprovalSubjectCreatedBaseV1 {
  readonly toolCallId: string;
  readonly approvalInstanceId: string;
  readonly payloadEnvelopeId: string;
  readonly inputDigest: string;
  readonly riskLevel: RiskLevel;
}

export type ToolApprovalSubjectCreatedV1 =
  | (ToolApprovalSubjectCreatedBaseV1 & {
      readonly assetBindingKind: 'release_tool';
      readonly releaseSetId: string;
      readonly publishedChecksum: string;
    })
  | (ToolApprovalSubjectCreatedBaseV1 & {
      readonly assetBindingKind: 'static_connector';
      readonly staticBindingRevisionId: string;
      readonly staticBindingChecksum: string;
    });

export interface ToolApprovalSubjectPort {
  submitToolSubject(
    input: SubmitToolApprovalSubjectV1,
  ): Promise<ToolApprovalSubjectCreatedV1>;
  submitStaticToolSubject(
    input: SubmitStaticToolApprovalSubjectV1,
  ): Promise<ToolApprovalSubjectCreatedV1>;
}

export interface ApprovalSubjectDecidedEventV1 {
  eventType: 'approval.subject.decided.v1';
  workspaceId: string;
  approvalInstanceId: string;
  subjectType: 'agent_tool' | 'flow_tool' | 'workforce_release';
  subjectId: string;
  toolCallId: string | null;
  decision: 'approved' | 'rejected' | 'expired';
  decisionVersion: 1;
  governanceContextDigest: `sha256:${string}`;
  actor:
    | { kind: 'human'; userId: string }
    | {
        kind: 'system_expiry';
        owner: 'ApprovalExpirySweep';
        runId: string;
      };
  decidedAt: string;
}

export interface StaticToolApprovalPreparationV1 {
  schemaVersion: 'nexusclaw.connector-static-tool-approval/v1';
  toolCallId: string;
  inputDigest: string;
  approvalPolicyRevisionId: string;
  approvalPolicyChecksum: string;
  governanceContext: {
    schemaVersion: 'nexusclaw.connector-static-tool-approval/v1';
    toolCallId: string;
    agentExecutionId: string;
    staticToolCode: 'slack.message.send' | 'teams.message.send';
    staticBindingRevisionId: string;
    staticBindingChecksum: string;
    generation: string;
    connectorInstanceId: string;
    connectorConfigHash: string;
    inputDigest: string;
  };
}

/**
 * Resume context handed to the executor when an approved
 * guardrail_pending execution is re-enqueued (design.md §6.4).
 */
export interface ResumeContext {
  approvalInstanceId: string;
  /** Legacy-null approval path only. */
  pausedToolCall?: {
    toolName: string;
    toolInput: Record<string, unknown>;
    riskLevel: string;
    description: string;
    toolCallId?: string;
    inputDigest?: string;
  };
  /**
   * Executable-v2 durable checkpoint. BullMQ receives references/digests only;
   * the worker reloads and decrypts the exact envelope just in time.
   */
  durableToolApproval?:
    | {
        schemaVersion: 'nexusclaw.tool-approval-resume/v1';
        assetBindingKind: 'release_tool';
        payloadEnvelopeId: string;
        toolCallId: string;
        toolName: string;
        inputDigest: string;
        releaseSetId: string;
        publishedChecksum: string;
      }
    | {
        schemaVersion: 'nexusclaw.tool-approval-resume/v1';
        assetBindingKind: 'static_connector';
        payloadEnvelopeId: string;
        toolCallId: string;
        toolName: 'slack.message.send' | 'teams.message.send';
        inputDigest: string;
        staticBindingRevisionId: string;
        staticBindingChecksum: string;
      };
}

// === ReAct Step ===

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'guardrail_pending'
  | 'done'
  | 'failed'
  | 'timeout'
  | 'cancelled';

export interface ReActStepData {
  iteration: number;
  thought: {
    reasoning: string;
    plan: string;
    confidence: number;
  };
  action: {
    type: 'tool_call' | 'llm_generate' | 'human_handoff' | 'finish';
    toolName?: string;
    toolInput?: Record<string, unknown>;
    generatePrompt?: string;
  };
  observation: {
    success: boolean;
    output: unknown;
    error?: string;
    guardrailTriggered: boolean;
    termination?: {
      reason:
        | 'tool_non_retryable'
        | 'tool_retries_exhausted'
        | 'token_budget'
        | 'step_token_budget'
        | 'max_steps'
        | 'max_tool_calls'
        | 'tool_call_jitter'
        | 'model_response_invalid'
        | 'wall_clock_timeout'
        | 'human_handoff_completed';
      rootCause: string;
      toolName?: string;
      errorClass?: 'governor' | 'permission' | 'validation' | 'network' | 'unknown';
      retryCount?: number;
    };
  };
  tokensUsed: { input: number; output: number };
  model: string;
  duration: number;
  aiProviderStamp?: AIProviderRuntimeStamp;
}

// === Tool Framework ===

/**
 * 工具执行策略声明（声明即契约；本轮由工具自身在 execute 内执行，
 * Registry 不在管线中强制执行，避免动五段式。Registry 级强制执行记入 debt）
 */
export interface ToolExecutionPolicy {
  /** 工具单次执行超时 */
  timeoutMs?: number;
  retry?: {
    /** 1 = 不重试 */
    maxAttempts: number;
    backoffMs?: number;
  };
}

/** 声明式工具提供方（扩展点唯一契约） */
export interface AgentToolProvider {
  /** 全局唯一，命名风格 kebab-case，如 'crm-core'、'external-webhook' */
  readonly providerKey: string;
  buildTools(): AgentTool[];
}

export interface AgentTool {
  name: string;
  description: string;
  category: 'crm' | 'external' | 'internal';
  inputSchema: object;
  outputSchema: object;
  requiredPermissions: {
    objectApiName?: string;
    operation?: string;
    permissionFlag?: string;
  };
  riskLevel: RiskLevel;
  execute: (
    input: unknown,
    context: AgentExecutionContext,
    host?: Readonly<{ toolCallId: string; inputDigest: string }>,
  ) => Promise<ToolCallResult>;
  prepareApproval?: (
    input: unknown,
    context: AgentExecutionContext,
    host: Readonly<{ toolCallId: string; inputDigest: string }>,
  ) => Promise<StaticToolApprovalPreparationV1>;
  executionPolicy?: ToolExecutionPolicy;
}

export interface ToolCallResult {
  success: boolean;
  output: unknown;
  error?: string;
  permissionCheck: 'passed' | 'denied';
  /** Permission-safe, reader-facing authorization/query provenance evidence. */
  permissionDetail?: string;
  guardrailCheck: 'passed' | 'escalated' | 'blocked';
  duration: number;
  /** Durable ToolCall identity for v2 execution / approval checkpoints. */
  toolCallId?: string;
  status?: 'requires_approval';
  toolName?: string;
  inputDigest?: string;
  releaseSetId?: string;
  publishedChecksum?: string;
  riskLevel?: RiskLevel;
  /** Exact durable v2 approval subject and encrypted payload identities. */
  approvalInstanceId?: string;
  payloadEnvelopeId?: string;
  assetBindingKind?: 'release_tool' | 'static_connector';
  staticBindingRevisionId?: string;
  staticBindingChecksum?: string;
  /** Server-built exact static binding/policy snapshot for L3 submission. */
  approvalPreparation?: StaticToolApprovalPreparationV1;
}

// === Model Router ===

export type ModelTier = 1 | 2 | 3;

export interface ModelConfig {
  tier: ModelTier;
  modelId: string;
  provider: string;
  inputCostPer1k: number;
  outputCostPer1k: number;
  maxTokens: number;
  supportsStreaming: boolean;
}

export interface LLMCallOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  timeout?: number;
}

export interface LLMResponse {
  content: string;
  tokensUsed: { input: number; output: number };
  model: string;
  finishReason: string;
}

// === Chat API (Design Doc Interface) ===

export interface ChatRequest {
  messages: Array<RuntimeMessage | { role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  /**
   * Capabilities the caller intends to exercise (ARCW-101). Defaults to
   * `['chat']` at the router boundary, so the legacy chat path is byte-identical
   * when omitted. Each requested capability is gated against the registry and
   * the provider/model's declared capabilities (fail-closed).
   */
  requestedCapabilities?: AIRuntimeCapability[];
  /** Request a streaming response (ARCW streaming wiring, design.md R3). */
  stream?: boolean;
  /** Request a separated, protected reasoning trace (ARCW reasoning, R4). */
  reasoning?: { effort?: 'low' | 'medium' | 'high' };
  /** Native function-calling definitions (ARCW tool_calling, R5). */
  tools?: NativeToolDefinition[];
  toolChoice?: 'auto' | 'none' | { name: string };
}

export interface ChatResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  finishReason: string;
  aiProviderStamp?: AIProviderRuntimeStamp;
  /**
   * Protected model reasoning trace (ARCW-102). Separated from the disclosable
   * `content`. MUST be stripped at every audit / log / GraphQL / learning-capture
   * egress via {@link redactProtected}. Never serialized in full anywhere.
   */
  reasoning?: ProtectedReasoning;
  /**
   * Native provider tool calls (ARCW-105). Present only when the model returned
   * a native function-call response. Dispatched into the governed tool registry
   * identically to JSON-parsed tool actions.
   */
  toolCalls?: NativeToolCall[];
}

export type AIProviderCredentialOwner = 'platform' | 'workspace' | 'unknown';

export type AITokenChargeMode =
  | 'platform_resale'
  | 'byo_exempt'
  | 'unclassified';

export interface AIProviderRuntimeStamp {
  providerFamily?: 'ai';
  providerConfigKey?: string | null;
  orgPolicyKey?: string | null;
  routingMode?: string | null;
  providerKind?: string | null;
  modelId?: string | null;
  modelTier?: number | null;
  capability?: string | null;
  scenario?: string | null;
  fallbackPosition?: number | null;
  fallbackReason?: string | null;
  migrationState?: string | null;
  resolutionSource?: string | null;
  providerRequestId?: string | null;
  credentialOwner?: AIProviderCredentialOwner;
  tokenChargeMode?: AITokenChargeMode;
  credentialConfigRef?: string | null;
}

// === Provider Adapter ===

// Structural stand-in for the product's LlmProviderConfig entity (TypeORM,
// private). The port signatures only consume the config shape; consumers pass
// their own concrete entity, which stays assignable while this contract stays
// dependency-free.
export interface LlmProviderConfig {
  id: string;
  workspaceId: string;
  providerName: string;
  apiEndpoint: string;
  defaultModel: string;
  priority: number;
  isEnabled: boolean;
  capabilities: string[];
  isSystem: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderAdapter {
  name: string;
  chat(request: ChatRequest, config: LlmProviderConfig, encryptionKey?: string): Promise<ChatResponse>;
  testConnection(config: LlmProviderConfig, encryptionKey?: string): Promise<{ success: boolean; latencyMs: number }>;
  /**
   * Optional streaming entry (ARCW-200, design.md R3). Adapters opt in per
   * provider kind. Absence means streaming is NOT executable for that kind —
   * the router fails closed (AI_CAPABILITY_NOT_EXECUTABLE), never buffers a
   * non-streaming response and fakes a stream.
   */
  chatStream?(request: ChatRequest, config: LlmProviderConfig, encryptionKey?: string): AsyncIterable<StreamEvent>;
}

// === Runtime Content Contract (ARCW-100..105) ================================
//
// Single versioned content/transport model shared by vision / streaming /
// reasoning / tool_calling. A capability is wired by extending this contract,
// never by introducing a parallel message type (invariant I1, design.md R1).
//
// This block is additive: the legacy string-only chat path keeps working
// unchanged. {@link normalizeMessages} is the only place legacy
// `{ role, content: string }` messages are converted to {@link RuntimeMessage}.

export const RUNTIME_CONTENT_SCHEMA_VERSION = 'ai-runtime-content/v1';

export const STREAM_EVENT_SCHEMA_VERSION = 'ai-runtime-stream/v1';

/**
 * Text content part. The only part type the legacy string path emits.
 */
export interface TextContentPart {
  type: 'text';
  text: string;
}

/**
 * Vision image input (ARCW vision wiring). `source` is always `'attachment'`:
 * the image MUST resolve through the file-storage contract
 * (ContentDocument → ContentVersion → ContentDocumentLink) gated by
 * FileAccessService.canRead + the scan gate. `documentId` is a
 * ContentDocument.id — never a URL, never a raw `storageRef`. A URL-field
 * bypass of the attachment contract is rejected by guard test (ARCW-305).
 */
export interface ImageContentPart {
  type: 'image';
  source: 'attachment';
  documentId: string;
  /** MIME inferred from magic bytes at upload; never client-trusted. */
  mediaType: string;
  detail?: 'low' | 'high' | 'auto';
}

/**
 * File input part (e.g. PDF for multimodal models that accept documents).
 * Same attachment-contract rule as {@link ImageContentPart}.
 */
export interface FileContentPart {
  type: 'file';
  source: 'attachment';
  documentId: string;
  mediaType: string;
}

export type ContentPart = TextContentPart | ImageContentPart | FileContentPart;

export interface RuntimeMessage {
  role: 'system' | 'user' | 'assistant';
  parts: ContentPart[];
  timestamp?: Date;
}

/**
 * Protected reasoning trace (ARCW-102). The `readonly text` plus the
 * "NEVER serialize" contract makes accidental leakage a review flag, not just a
 * runtime risk. Project at every egress only through {@link redactProtected}.
 */
export interface ProtectedReasoning {
  /** NEVER persisted, logged, audited, or returned to the frontend. */
  readonly text: string;
  effort: 'low' | 'medium' | 'high';
  tokenUsage: { reasoningTokens: number };
}

/**
 * Sanitized projection of {@link ProtectedReasoning} that is safe to persist /
 * log / audit / return. This is the ONLY shape reasoning may take past an
 * egress boundary. The raw `text` is dropped unconditionally.
 */
export interface RedactedReasoning {
  used: boolean;
  effort?: 'low' | 'medium' | 'high';
  reasoningTokens?: number;
}

/**
 * Single egress redaction seam (ARCW-102, design.md R4). Call this at every
 * audit snapshot, structured-log site, GraphQL resolver, and learning-capture
 * input. Returns only metadata; the reasoning text is never exposed.
 */
export function redactProtected(
  reasoning: ProtectedReasoning | undefined,
): RedactedReasoning {
  if (!reasoning) {
    return { used: false };
  }
  return {
    used: true,
    effort: reasoning.effort,
    reasoningTokens: reasoning.tokenUsage.reasoningTokens,
  };
}

/**
 * Pure legacy → runtime message converter (ARCW-103). The ONLY place a legacy
 * `{ role, content: string }` message is wrapped into a {@link RuntimeMessage}.
 * Adapters and the router receive {@link RuntimeMessage}[] exclusively.
 *
 * - A {@link RuntimeMessage} is passed through unchanged.
 * - A legacy `{ role, content }` is wrapped as one {@link TextContentPart}.
 * - No I/O; deterministic.
 */
export function normalizeMessages(
  messages: Array<RuntimeMessage | { role: string; content: string }>,
): RuntimeMessage[] {
  return messages.map((message) => {
    if ('parts' in message && Array.isArray(message.parts)) {
      return message as RuntimeMessage;
    }
    const legacy = message as { role: string; content: string };
    return {
      role: legacy.role as RuntimeMessage['role'],
      parts: [{ type: 'text', text: legacy.content }],
    };
  });
}

/**
 * Collapse a {@link RuntimeMessage}'s parts back to a single string by joining
 * text parts (ARCW-103). Used at legacy call sites that still consume
 * `content: string`; for a legacy message (one text part) the result is
 * byte-identical to the original `content`, so the existing chat path is
 * unchanged. Non-text parts (image/file) are dropped here — vision-aware
 * adapters consume parts directly, not via this helper.
 *
 * No I/O; deterministic.
 */
export function textContentOf(
  message: RuntimeMessage | { role: string; content: string },
): string {
  if ('parts' in message && Array.isArray(message.parts)) {
    return message.parts
      .filter((part): part is TextContentPart => part.type === 'text')
      .map((part) => part.text)
      .join('');
  }
  return (message as { content: string }).content;
}


/**
 * Native tool definition sent to a provider that supports function calling
 * (ARCW-105). Built from a registered {@link AgentTool}; only sent when the
 * selected model declares the `tool_calling` capability.
 */
export interface NativeToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
}

/**
 * A tool call returned by a provider's native function-calling response
 * (ARCW-105). Dispatched into the governed tool registry exactly like a
 * JSON-parsed ReAct action — same permission, risk, approval gates.
 */
export interface NativeToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Unified streaming event protocol (ARCW-104, design.md R3). All capability
 * streams emit these events. `error.code` / `status.code` are stable sanitized
 * strings — never raw provider error text, never secrets.
 */
export type StreamEvent =
  | {
      type: 'stream.started';
      executionId: string;
      model: string;
      provider: string;
      at: string;
    }
  | { type: 'text.delta'; text: string }
  | { type: 'reasoning.marker' }
  | { type: 'tool.call'; toolCall: NativeToolCall }
  | { type: 'tool.result'; toolName: string; result: unknown }
  | { type: 'status'; code: string; message?: string }
  | { type: 'error'; code: string }
  | {
      type: 'stream.final';
      finishReason: string;
      usage: { inputTokens: number; outputTokens: number };
      at: string;
    };

// === Execution Result ===

export interface ExecutionResult {
  status: ExecutionStatus;
  output: {
    type: 'text' | 'record' | 'report' | 'action';
    content: unknown;
    summary: string;
  };
  steps: ReActStepData[];
  totalTokens: { input: number; output: number };
  totalCost: number;
  duration: number;
  /** Set by runSync() so callers (e.g. the test runner) can link the real
   *  AgentExecution and query its tool-call records. Absent from execute(). */
  executionId?: string;
}

// === Queue ===

export interface QueueConfig {
  maxConcurrentPerWorkspace: number;
  maxConcurrentPerAgent: number;
  executionTimeoutMs: number;
  retryAttempts: number;
  retryBackoff: 'exponential';
}

export interface QueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}
