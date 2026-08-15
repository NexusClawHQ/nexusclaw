import type { MarkdownSection } from '@nexusclaw/shared/agent-markdown-policy';

/**
 * AgentDefinition — Complete structured configuration for an Agent,
 * stored as JSONB in the agents table's `definition` column.
 */
export interface AgentDefinition {
  topics: TopicDefinition[];
  toolBindings: ToolBinding[];
  guardrailRuleIds: string[];
  knowledgeBaseIds: string[];
  /** Workspace prompt strategy that is part of this agent's runtime contract. */
  promptStrategyId?: string | null;
  /** SOP documents that must be injected into this agent's runtime context. */
  sopDocumentIds?: string[];
  modelConfig: ModelConfigDefinition;
  permissionConfig: PermissionConfigDefinition;
  canvasLayout: CanvasLayout;
  /** Persona / tone of voice — prepended to the composed system prompt (F3). */
  persona?: string;
  /** Top-level operating instructions — prepended to the composed system prompt (F3). */
  systemInstructions?: string;
  /**
   * User-facing starter questions shown by chat/voice channels before the first
   * turn. These are display prompts only; runtime policy still comes from
   * persona/systemInstructions/promptStrategy and permissionConfig.
   */
  starterPrompts?: string[];
  /**
   * Identity base policy (markdown source text) — describes who this agent
   * acts as and how it should constrain itself within its execution
   * identity/authority boundary. Renders in the "执行身份" tab, alongside
   * `persona`/`systemInstructions` (agent-identity-markdown-policy-v1 Req 1).
   */
  identityPolicy?: string;
  /**
   * Derived markdown section cache for `identityPolicy`/`systemInstructions`,
   * recomputed by `agent-builder.service` on every definition save and
   * versioned alongside the rest of `definition` — callers MUST NOT treat a
   * client-submitted value as authoritative (agent-identity-markdown-policy-v1
   * Req 3.3, design.md FD1).
   */
  markdownSectionIndex?: {
    identityPolicy: MarkdownSection[];
    systemInstructions: MarkdownSection[];
  };
  /**
   * Learning-loop plan for this agent (R6.2 — behavior-learning-loop-closure-v1).
   * Auto-templated from the agent's risk level at creation time (see
   * `buildDefaultLearningPlan()` in `agent-learning-plan-template.ts`); stored
   * on the agent's own JSONB `definition` column so it is versioned alongside
   * every other structural change via `AgentVersionService`. `null`/absent
   * means "no learning plan has been templated yet" (e.g. agents created
   * before this field existed) — callers must not assume it is always
   * present.
   */
  learningPlan?: AgentLearningPlan | null;
  /**
   * Governed success, context, memory, critic and proactive policy snapshot.
   * Absence is a legacy agent and always resolves to A0_disabled.
   */
  cognitivePolicy?: unknown;
  /**
   * Versioned, machine-readable query constraints. Unlike topic instructions,
   * these rules are allowed to narrow record queries after runtime validation.
   * Their immutable AgentVersion snapshot is the authority source.
   */
  queryConstraintRules?: QueryConstraintRuleDefinition[];
  /**
   * Optional runtime exemplar injection config
   * (curated-scenario-exemplar-retrieval-v1, Path D Phase 3).
   *
   * When `scenarioCode` is present, the context-builder retrieves
   * admin-curated scenario exemplars (double-reviewed, role + org-subtree
   * scoped, fail-closed on empty roleCodes) via RAG-Sec and injects them into
   * the system prompt as untrusted, fenced reference data — parallel to, and
   * deliberately not forking, the auto verified-exemplar path. Absent/empty
   * `scenarioCode` = fail-closed skip (no injection, byte-identical behavior
   * for agents not opted in). This is the OD-2 runtime source recommended in
   * the spec design (explicit agent config field); it does not widen the
   * agent's AgentSecurityContext — retrieval only narrows.
   */
  runtimeExemplars?: {
    scenarioCode?: string;
  };
}

export interface QueryConstraintRuleDefinition {
  id: string;
  revision: number;
  enabled: boolean;
  objectApiName: string;
  predicates: Array<{
    fieldApiName: string;
    operator:
      | 'eq'
      | 'neq'
      | 'in'
      | 'not_in'
      | 'gt'
      | 'gte'
      | 'lt'
      | 'lte'
      | 'contains';
    value: unknown;
  }>;
}

/**
 * Risk-level-templated learning-loop configuration for an agent, per
 * design.md §7 ("Learning plan: builder 生成 blueprint 时按 agent 风险等级
 * 模板化生成 learning_plan 段，存入 agent definition JSON"). This is a small
 * templated config block (what gets captured / redacted / produced, and how
 * releases are gated) — not a rich authoring document.
 */
export interface AgentLearningPlan {
  /**
   * What gets captured from this agent's executions. Values reuse the real
   * `ai_workforce_behavior_events` snapshot columns written by
   * `BehaviorLearningCaptureService.capture()` (see that entity's actual
   * column names) rather than inventing new terminology, e.g.
   * `['input_snapshot','output_snapshot','context_snapshot','tool_calls',
   *   'knowledge_refs','approvals','human_edits','final_outcome','feedback']`.
   */
  captureSources: string[];
  /**
   * What is redacted before capture reaches the learning layer. Values reuse
   * the real PII/redaction rule identifiers already produced by
   * `detectPii()`/`scanStringForPii()` in `behavior-learning-capture.service.ts`
   * (`field_name`, `content:phone`, `content:email`, `content:id_card`,
   * `content:api_key`, `content:bank_card`) plus the structural
   * `AiWorkforceRedactionStatus` outcomes (`redacted`/`blocked`) — not new
   * terminology invented for this field.
   */
  redactionScope: string[];
  /**
   * What the learning pipeline is allowed to produce from this agent's
   * captured behavior. Mirrors the real pipeline stages already implemented
   * in Phase 1-3 (`signals` = ai_workforce_learning_signals,
   * `patterns` = pattern clustering output, `recommendations` =
   * ai_workforce_improvement_recommendations).
   */
  learningOutputs: string[];
  /**
   * Release gating for anything the learning loop proposes changing on this
   * agent (guardrails, SOPs, prompts, tool permissions, etc.). Literal values
   * per design.md §7. `draft_then_test_then_approve` requires the full
   * Phase 4/7 release-gate flow (tests → simulation → human approval) before
   * a learning-derived change can publish; `draft_only` stops at a draft
   * artifact and never auto-advances toward publish (used for the lowest,
   * L0 risk tier where the templated default is intentionally
   * conservative-by-omission rather than conservative-by-gate).
   */
  releaseControl: 'draft_then_test_then_approve' | 'draft_only';
  /**
   * True if this plan was auto-populated by `buildDefaultLearningPlan()`
   * because the incoming agent definition did not already specify one — as
   * opposed to a plan a caller explicitly supplied. Purely informational /
   * auditable, has no behavioral effect.
   */
  autoTemplated?: boolean;
}

export interface TopicDefinition {
  id: string;
  name: string;
  description: string;
  priority: number;
  instructions: InstructionDefinition[];
  toolBindingIds: string[];
}

export interface InstructionDefinition {
  id: string;
  content: string;
  order: number;
}

export interface ToolBinding {
  id: string;
  toolName: string;
  topicId: string;
  inputMapping: Record<string, string>;
  outputMapping: Record<string, string>;
  riskLevel: 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
}

export interface ModelConfigDefinition {
  modelId: string;
  provider: string;
  tier: 1 | 2 | 3;
  temperature: number;
  maxTokens: number;
  /**
   * Cumulative token budget for the whole execution (see `PackageModelConfig`).
   * Optional; when absent the context-builder applies its default cap.
   */
  maxTokensPerExecution?: number;
  responseFormat: 'text' | 'json';
  inputCostPer1k: number;
  outputCostPer1k: number;
}

export interface TimeWindow {
  dayOfWeek: number;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export interface PermissionConfigDefinition {
  roleId: string;
  dataScopeType: 'all' | 'org_subtree' | 'own' | 'custom';
  dataScopeOrgNodeId?: string;
  maxQueriesPerMinute: number;
  maxWritesPerMinute: number;
  maxBatchSize: number;
  allowedTools: string[];
  blockedTools: string[];
  runOrgNodeIds?: string[];
  runOrgSubtreeIds?: string[];
  runUserIds?: string[];
  runRoleIds?: string[];
  runPublicGroupIds?: string[];
  activeWindows: TimeWindow[];
}

export interface CanvasLayout {
  nodes: Array<{
    nodeId: string;
    type: string;
    position: { x: number; y: number };
  }>;
  connections: Array<{
    sourceNodeId: string;
    targetNodeId: string;
    type: string;
  }>;
  zoom: number;
  pan: { x: number; y: number };
}
