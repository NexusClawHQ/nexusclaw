
/**
 * Employee Package v1 — shared types for the "AI Employee Package Deployment v1" spec.
 *
 * An employee package bundles everything needed to deploy one AI employee into a
 * workspace: an agent definition, guardrail rules, knowledge documents, and
 * evaluation cases. All environment-specific ids (knowledge base ids, guardrail
 * rule ids) are referenced by *resource key* inside the package — the installer
 * resolves them to real per-workspace uuids via `deriveStableId` at install time
 * (see design.md §4.5 / §3). This is why `PackageAgentDefinition` mirrors
 * `AgentDefinition` (backend agent-definition.interface.ts) but narrows the
 * id-referencing arrays to `string[]` resource keys instead of real uuids.
 */

export type AssertionType =
  | 'output_contains'
  | 'output_not_contains'
  | 'output_equals'
  | 'output_matches_regex'
  | 'output_json_path_exists'
  | 'intent_equals'
  | 'status_done'
  | 'tool_called'
  | 'tool_not_called'
  | 'retrieval_hit'
  | 'success_criterion_passed'
  | 'goal_snapshot_locked'
  | 'context_manifest_complete'
  | 'success_evaluation_hard_gate_passed'
  | 'memory_decision_allowed'
  | 'proactive_a1_no_dispatch'
  | 'proactive_a2_confirmed_dispatch'
  | 'guardrail_not_triggered'
  | 'no_permission_denied'
  | 'no_guardrail_block';

export const ASSERTION_TYPES: readonly AssertionType[] = [
  'output_contains',
  'output_not_contains',
  'output_equals',
  'output_matches_regex',
  'output_json_path_exists',
  'intent_equals',
  'status_done',
  'tool_called',
  'tool_not_called',
  'retrieval_hit',
  'success_criterion_passed',
  'goal_snapshot_locked',
  'context_manifest_complete',
  'success_evaluation_hard_gate_passed',
  'memory_decision_allowed',
  'proactive_a1_no_dispatch',
  'proactive_a2_confirmed_dispatch',
  'guardrail_not_triggered',
  'no_permission_denied',
  'no_guardrail_block',
];

export interface PackageAssertionDef {
  type: AssertionType;
  value?: string;
  path?: string;
  expected?: unknown;
  minScore?: number;
}

export type EvalCaseTag = 'readonly' | 'mutating';

export interface PackageEvalCase {
  /** Resource key, stable across reinstalls — resolved via deriveStableId. */
  key: string;
  name: string;
  input: string;
  expectedIntent?: string;
  assertions: PackageAssertionDef[];
  /** Must include exactly one of 'readonly' | 'mutating' (Q3 signed decision). */
  tags: string[];
  enabled?: boolean;
}

export type RiskLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export interface PackageGuardrailRule {
  /** Resource key, stable across reinstalls — resolved via deriveStableId. */
  key: string;
  name: string;
  description?: string;
  isActive?: boolean;
  priority?: number;
  /**
   * jsonb column at the DB layer — the entity's inline TS shape
   * ({objectApiName?, operation?, fieldApiNames?, amountThreshold?, batchSize?})
   * is a common case, not an enforced schema; real deployments (e.g. the
   * medtech seed) also key conditions off {code, category, triggerCondition,
   * auditCategory}. Package authors may use either shape.
   */
  conditions: Record<string, unknown>;
  riskLevel: RiskLevel;
  /** jsonb column, same flexibility as `conditions` — see note above. */
  action: Record<string, unknown>;
}

export type KnowledgeAccessLevel = 'public' | 'private' | 'org_subtree';

export interface PackageKnowledgeDocument {
  /** Resource key, stable across reinstalls — resolved via deriveStableId. */
  key: string;
  title: string;
  content: string;
  accessLevel?: KnowledgeAccessLevel;
  sourceType?: 'record' | 'email' | 'document' | 'sop' | 'manual' | 'domain' | 'web';
  metadata?: Record<string, unknown>;
}

export interface PackageTopicInstruction {
  id: string;
  content: string;
  order: number;
}

export interface PackageTopicDefinition {
  id: string;
  name: string;
  description: string;
  priority: number;
  instructions: PackageTopicInstruction[];
  toolBindingIds: string[];
}

export interface PackageToolBinding {
  id: string;
  toolName: string;
  topicId: string;
  inputMapping: Record<string, string>;
  outputMapping: Record<string, string>;
  riskLevel: RiskLevel;
}

export interface PackageModelConfig {
  modelId: string;
  provider: string;
  tier: 1 | 2 | 3;
  temperature: number;
  maxTokens: number;
  /**
   * Cumulative token budget for the WHOLE agent execution (input+output across
   * all ReAct iterations). Distinct from `maxTokens` (per-call output cap).
   * When unset, `ContextBuilderService` falls back to its 16k default
   * (`context-builder.service.ts` `calculateConstraints`).
   */
  maxTokensPerExecution?: number;
  responseFormat: 'text' | 'json';
  inputCostPer1k?: number;
  outputCostPer1k?: number;
}

export interface PackageTimeWindow {
  dayOfWeek: number;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export interface PackagePermissionConfig {
  roleId?: string;
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
  activeWindows: PackageTimeWindow[];
}

export interface PackageQueryConstraintRule {
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

export interface PackageAgentDefinition {
  apiName: string;
  name: string;
  description?: string;
  type: 'sales' | 'service' | 'analytics' | 'admin' | 'custom';
  topics: PackageTopicDefinition[];
  toolBindings: PackageToolBinding[];
  /** Resource keys resolved against guardrails[].key at install time. */
  guardrailRuleKeys: string[];
  /** Resource keys resolved against knowledge[].key at install time. */
  knowledgeBaseKeys: string[];
  modelConfig: PackageModelConfig;
  permissionConfig: PackagePermissionConfig;
  persona?: string;
  systemInstructions?: string;
  starterPrompts?: string[];
  identityPolicy?: string;
  /** Optional governed success/memory/agency policy, versioned with the agent. */
  cognitivePolicy?: Record<string, unknown>;
  /**
   * Machine-readable, versioned rules that may narrow queries. Natural
   * language topic instructions are never promoted into this field.
   */
  queryConstraintRules?: PackageQueryConstraintRule[];
  /**
   * Optional runtime exemplar injection config (curated-scenario-exemplar-
   * retrieval-v1, Path D Phase 3). Mirrors
   * `AgentDefinition.runtimeExemplars` so a formal employee package can carry
   * the curated-scenario `scenarioCode` end-to-end into the release snapshot
   * and the installed agent definition. Absent/empty = fail-closed skip
   * (byte-identical behavior for agents not opted in; canonical-JSON digest is
   * stable because undefined object members are omitted by RFC 8785 JCS).
   */
  runtimeExemplars?: {
    scenarioCode?: string;
  };
}

// ── G-P0-03: asset-declared routing contract (remediation design §5.3) ──────

/** Conflict resolution policy for routing; frozen to one value in v1. */
export type EmployeeRoutingConflictPolicy = 'priority_then_agent_api_name';

/**
 * Asset-declared routing contract (remediation R-03 / design §5.3). A v2
 * Employee Package MUST declare this so a CLI-deployed employee can be
 * deterministically matched by the Intent Router; a v1 package has none and
 * remains manually-routed.
 *
 * Rules (design §5.3):
 * - `code` is a stable key (not translated text); industry content stays in
 *   package data, core adds no industry heuristic.
 * - `descriptions` is a `Record<locale, text>` map (package data, not core).
 * - exact `agent.apiName` is the deterministic tie-break (no agentKey alias).
 * - `manual_only` is an explicit mode, not a fallback for missing routing.
 */
export interface EmployeeRoutingCapability {
  /** Stable capability code, e.g. `prospect_research.market_scan`. */
  code: string;
  /** Localised descriptions keyed by locale (`zh-CN`, `en`, ...). */
  descriptions: Readonly<Record<string, string>>;
  /** Optional example utterances (package data). */
  examples?: ReadonlyArray<string>;
  /** Optional priority within the agent; higher wins. Used by tie-break. */
  priority?: number;
}

export interface EmployeeRoutingContract {
  mode: 'automatic' | 'manual_only';
  capabilities: ReadonlyArray<EmployeeRoutingCapability>;
  conflictPolicy: EmployeeRoutingConflictPolicy;
}

/** Agent definition carrying an optional v2 routing contract. */
export interface PackageAgentDefinitionV2 extends PackageAgentDefinition {
  /**
   * Required for a v2 package: the asset-declared routing contract projected
   * onto `agent.capabilities` at install time. Absent on v1 packages.
   */
  routing?: EmployeeRoutingContract;
}

// ── Manifest: v1 (legacy) | v2 (routing-aware) discriminated union ──────────

/** Legacy v1 manifest — unchanged semantics, no routing contract. */
export interface EmployeePackageManifestV1 {
  schemaVersion: 'v1';
  name: string;
  version: string;
  description?: string;
  agent: PackageAgentDefinition;
  guardrails: PackageGuardrailRule[];
  knowledge: PackageKnowledgeDocument[];
  evalCases: PackageEvalCase[];
  /** Pass threshold for the deploy-time eval gate. Default 1.0 (Q2 signed decision). */
  minPassRate?: number;
  /** Whether the gate should attempt to activate the agent when it passes. Default true. */
  activateOnPass?: boolean;
}

/**
 * v2 manifest (remediation R-03 / design §5.3). Adds a required routing
 * contract and FORCES `activateOnPass: false` — v2 activation only happens via
 * the release-set promote owner (executable-asset Phase 8). Until that owner
 * exists a v2 package can reach install/candidate but not auto-activate.
 */
export interface EmployeePackageManifestV2 {
  schemaVersion: 'v2';
  name: string;
  version: string;
  description?: string;
  agent: PackageAgentDefinitionV2;
  guardrails: PackageGuardrailRule[];
  knowledge: PackageKnowledgeDocument[];
  evalCases: PackageEvalCase[];
  minPassRate?: number;
  /** Forced to false; v2 activation is release-set promote only. */
  activateOnPass: false;
}

export type EmployeePackageManifest = EmployeePackageManifestV1 | EmployeePackageManifestV2;
