import {
  ASSERTION_TYPES,
  type EmployeePackageManifest,
  type EmployeeRoutingContract,
  type PackageAgentDefinition,
  type PackageAgentDefinitionV2,
  type PackageEvalCase,
  type PackageGuardrailRule,
  type PackageKnowledgeDocument,
} from './types';

export interface PackageValidationIssue {
  path: string;
  message: string;
}

export interface PackageValidationResult {
  valid: boolean;
  issues: PackageValidationIssue[];
}

const RISK_LEVELS = new Set(['L0', 'L1', 'L2', 'L3', 'L4']);
const ACCESS_LEVELS = new Set(['public', 'private', 'org_subtree']);
const AGENT_TYPES = new Set(['sales', 'service', 'analytics', 'admin', 'custom']);
const EVAL_TAGS = new Set(['readonly', 'mutating']);
const RESOURCE_KEY_PATTERN = /^[a-z][a-z0-9_.:-]*$/;
/**
 * Stable routing capability code: lowercase, dot-segmented
 * (`<primary>[.<secondary>]`), e.g. `prospect_research.market_scan`. Core
 * stores this verbatim — it is a key, never localised text (design §5.3).
 */
const ROUTING_CAPABILITY_CODE_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/;

function issue(path: string, message: string): PackageValidationIssue {
  return { path, message };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateResourceKey(key: unknown, path: string, issues: PackageValidationIssue[]): void {
  if (!isNonEmptyString(key)) {
    issues.push(issue(path, 'resource key must be a non-empty string'));
    return;
  }
  if (!RESOURCE_KEY_PATTERN.test(key)) {
    issues.push(
      issue(path, `resource key "${key}" must match ${RESOURCE_KEY_PATTERN} (lowercase, start with a letter)`),
    );
  }
}

function validateGuardrail(
  rule: PackageGuardrailRule,
  index: number,
  issues: PackageValidationIssue[],
): void {
  const path = `guardrails[${index}]`;
  validateResourceKey(rule?.key, `${path}.key`, issues);
  if (!isNonEmptyString(rule?.name)) {
    issues.push(issue(`${path}.name`, 'guardrail name is required'));
  }
  if (!rule?.riskLevel || !RISK_LEVELS.has(rule.riskLevel)) {
    issues.push(issue(`${path}.riskLevel`, `riskLevel must be one of ${[...RISK_LEVELS].join('|')}`));
  }
  if (!rule?.conditions || typeof rule.conditions !== 'object') {
    issues.push(issue(`${path}.conditions`, 'conditions object is required (may be empty {})'));
  }
  if (!rule?.action || typeof rule.action !== 'object') {
    issues.push(issue(`${path}.action`, 'action object is required (may be empty {})'));
  }
}

function validateKnowledgeDocument(
  doc: PackageKnowledgeDocument,
  index: number,
  issues: PackageValidationIssue[],
): void {
  const path = `knowledge[${index}]`;
  validateResourceKey(doc?.key, `${path}.key`, issues);
  if (!isNonEmptyString(doc?.title)) {
    issues.push(issue(`${path}.title`, 'title is required'));
  }
  if (!isNonEmptyString(doc?.content)) {
    issues.push(issue(`${path}.content`, 'content is required'));
  }
  if (doc?.accessLevel !== undefined && !ACCESS_LEVELS.has(doc.accessLevel)) {
    issues.push(issue(`${path}.accessLevel`, `accessLevel must be one of ${[...ACCESS_LEVELS].join('|')}`));
  }
}

function validateEvalCase(
  evalCase: PackageEvalCase,
  index: number,
  issues: PackageValidationIssue[],
): void {
  const path = `evalCases[${index}]`;
  validateResourceKey(evalCase?.key, `${path}.key`, issues);
  if (!isNonEmptyString(evalCase?.name)) {
    issues.push(issue(`${path}.name`, 'name is required'));
  }
  if (!isNonEmptyString(evalCase?.input)) {
    issues.push(issue(`${path}.input`, 'input is required'));
  }

  const tags = evalCase?.tags;
  if (!Array.isArray(tags) || tags.length === 0) {
    issues.push(issue(`${path}.tags`, 'tags must be a non-empty array'));
  } else {
    const knownTagCount = tags.filter((t) => EVAL_TAGS.has(t)).length;
    if (knownTagCount !== 1) {
      issues.push(
        issue(
          `${path}.tags`,
          `tags must include exactly one of "readonly"|"mutating" (Q3 signed decision), found ${knownTagCount}`,
        ),
      );
    }
  }

  const assertions = evalCase?.assertions;
  if (!Array.isArray(assertions) || assertions.length === 0) {
    issues.push(issue(`${path}.assertions`, 'assertions must be a non-empty array'));
  } else {
    assertions.forEach((a, aIndex) => {
      if (!a || !ASSERTION_TYPES.includes(a.type)) {
        issues.push(
          issue(
            `${path}.assertions[${aIndex}].type`,
            `unknown assertion type "${a?.type}"; must be one of ${ASSERTION_TYPES.join('|')}`,
          ),
        );
      }
    });
  }
}

function validateAgent(
  agent: PackageAgentDefinition,
  knowledgeKeys: Set<string>,
  guardrailKeys: Set<string>,
  issues: PackageValidationIssue[],
): void {
  const path = 'agent';
  if (!isNonEmptyString(agent?.apiName)) {
    issues.push(issue(`${path}.apiName`, 'apiName is required (this is the idempotent deploy identity key)'));
  }
  if (!isNonEmptyString(agent?.name)) {
    issues.push(issue(`${path}.name`, 'name is required'));
  }
  if (!agent?.type || !AGENT_TYPES.has(agent.type)) {
    issues.push(issue(`${path}.type`, `type must be one of ${[...AGENT_TYPES].join('|')}`));
  }
  if (!Array.isArray(agent?.topics)) {
    issues.push(issue(`${path}.topics`, 'topics must be an array (may be empty)'));
  }
  if (!Array.isArray(agent?.toolBindings)) {
    issues.push(issue(`${path}.toolBindings`, 'toolBindings must be an array (may be empty)'));
  }
  if (!agent?.modelConfig || !isNonEmptyString(agent.modelConfig.modelId)) {
    issues.push(issue(`${path}.modelConfig.modelId`, 'modelConfig.modelId is required'));
  }
  if (!agent?.permissionConfig) {
    issues.push(issue(`${path}.permissionConfig`, 'permissionConfig is required'));
  }

  (agent?.knowledgeBaseKeys ?? []).forEach((key, i) => {
    if (!knowledgeKeys.has(key)) {
      issues.push(
        issue(`${path}.knowledgeBaseKeys[${i}]`, `references unknown knowledge key "${key}"`),
      );
    }
  });
  (agent?.guardrailRuleKeys ?? []).forEach((key, i) => {
    if (!guardrailKeys.has(key)) {
      issues.push(
        issue(`${path}.guardrailRuleKeys[${i}]`, `references unknown guardrail key "${key}"`),
      );
    }
  });

  (agent?.toolBindings ?? []).forEach((binding, i) => {
    if (!binding?.riskLevel || !RISK_LEVELS.has(binding.riskLevel)) {
      issues.push(
        issue(`${path}.toolBindings[${i}].riskLevel`, `riskLevel must be one of ${[...RISK_LEVELS].join('|')}`),
      );
    }
  });

  const queryRuleIds = new Set<string>();
  (agent?.queryConstraintRules ?? []).forEach((rule, ruleIndex) => {
    const rulePath = `${path}.queryConstraintRules[${ruleIndex}]`;
    if (
      !isNonEmptyString(rule?.id) ||
      queryRuleIds.has(rule.id) ||
      !Number.isInteger(rule?.revision) ||
      rule.revision < 1 ||
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(rule?.objectApiName ?? '') ||
      !Array.isArray(rule?.predicates) ||
      rule.predicates.length === 0
    ) {
      issues.push(issue(rulePath, 'query constraint rule must have a unique id, positive revision, objectApiName and predicates'));
      return;
    }
    queryRuleIds.add(rule.id);
    rule.predicates.forEach((predicate, predicateIndex) => {
      if (
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(predicate?.fieldApiName ?? '') ||
        !['eq', 'neq', 'in', 'not_in', 'gt', 'gte', 'lt', 'lte', 'contains']
          .includes(predicate?.operator)
      ) {
        issues.push(issue(
          `${rulePath}.predicates[${predicateIndex}]`,
          'invalid structured query predicate',
        ));
      }
    });
  });

  // runtimeExemplars is optional, but when present it must be a
  // well-formed { scenarioCode?: string }. A malformed value would silently
  // disable curated-exemplar injection (context-builder trims scenarioCode to
  // '' for non-strings), so fail closed at deploy-time validation instead.
  if (agent?.runtimeExemplars != null) {
    const re = agent.runtimeExemplars as { scenarioCode?: unknown };
    if (
      typeof agent.runtimeExemplars !== 'object' ||
      Array.isArray(agent.runtimeExemplars) ||
      (re.scenarioCode != null && !isNonEmptyString(re.scenarioCode as string))
    ) {
      issues.push(
        issue(
          `${path}.runtimeExemplars`,
          'runtimeExemplars must be an object with optional non-empty string scenarioCode',
        ),
      );
    }
  }
}

function validateDuplicateKeys(
  items: Array<{ key?: string }>,
  section: string,
  issues: PackageValidationIssue[],
): void {
  const seen = new Map<string, number>();
  items.forEach((item, index) => {
    if (!item?.key) return;
    if (seen.has(item.key)) {
      issues.push(
        issue(`${section}[${index}].key`, `duplicate resource key "${item.key}" (first seen at index ${seen.get(item.key)})`),
      );
    } else {
      seen.set(item.key, index);
    }
  });
}

/**
 * Validate an employee package manifest. Pure function, no I/O — safe to run
 * in `nexus employee deploy --dry-run` before any workspace is touched.
 */
export function validateEmployeePackage(manifest: unknown): PackageValidationResult {
  const issues: PackageValidationIssue[] = [];
  const pkg = manifest as Partial<EmployeePackageManifest> | null | undefined;

  if (!pkg || typeof pkg !== 'object') {
    return { valid: false, issues: [issue('$', 'manifest must be an object')] };
  }

  if (pkg.schemaVersion !== 'v1' && pkg.schemaVersion !== 'v2') {
    issues.push(issue('schemaVersion', 'schemaVersion must be exactly "v1" or "v2"'));
  }
  // G-P0-03 (remediation R-03): a v2 package MUST force activateOnPass:false
  // (activation is release-set promote only) and MUST declare a routing
  // contract. v1 keeps its original semantics unchanged.
  if (pkg.schemaVersion === 'v2') {
    if (pkg.activateOnPass !== false) {
      issues.push(issue('activateOnPass', 'v2 package must set activateOnPass:false (activation is release-set promote only)'));
    }
  }
  if (!isNonEmptyString(pkg.name)) {
    issues.push(issue('name', 'name is required'));
  }
  if (!isNonEmptyString(pkg.version)) {
    issues.push(issue('version', 'version is required'));
  }
  if (pkg.minPassRate !== undefined && (typeof pkg.minPassRate !== 'number' || pkg.minPassRate < 0 || pkg.minPassRate > 1)) {
    issues.push(issue('minPassRate', 'minPassRate must be a number between 0 and 1'));
  }

  const guardrails = Array.isArray(pkg.guardrails) ? pkg.guardrails : [];
  if (!Array.isArray(pkg.guardrails)) {
    issues.push(issue('guardrails', 'guardrails must be an array (may be empty)'));
  }
  guardrails.forEach((rule, i) => validateGuardrail(rule, i, issues));
  validateDuplicateKeys(guardrails, 'guardrails', issues);

  const knowledge = Array.isArray(pkg.knowledge) ? pkg.knowledge : [];
  if (!Array.isArray(pkg.knowledge)) {
    issues.push(issue('knowledge', 'knowledge must be an array (may be empty)'));
  }
  knowledge.forEach((doc, i) => validateKnowledgeDocument(doc, i, issues));
  validateDuplicateKeys(knowledge, 'knowledge', issues);

  const evalCases = Array.isArray(pkg.evalCases) ? pkg.evalCases : [];
  if (!Array.isArray(pkg.evalCases) || evalCases.length === 0) {
    issues.push(issue('evalCases', 'evalCases must be a non-empty array — a package with no eval cases has no deploy gate'));
  }
  evalCases.forEach((c, i) => validateEvalCase(c, i, issues));
  validateDuplicateKeys(evalCases, 'evalCases', issues);

  if (!pkg.agent) {
    issues.push(issue('agent', 'agent is required'));
  } else {
    const knowledgeKeys = new Set(knowledge.map((k) => k?.key).filter(Boolean));
    const guardrailKeys = new Set(guardrails.map((g) => g?.key).filter(Boolean));
    validateAgent(pkg.agent, knowledgeKeys, guardrailKeys, issues);
    // G-P0-03: v2 routing contract is required and must be valid.
    if (pkg.schemaVersion === 'v2') {
      validateRouting((pkg.agent as Partial<PackageAgentDefinitionV2>).routing, issues);
    } else if ((pkg.agent as Partial<PackageAgentDefinitionV2>).routing !== undefined) {
      // v2 field must not be silently injected into a v1 package.
      issues.push(issue('agent.routing', 'routing contract is only permitted on a v2 package'));
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Validate an Employee Package v2 routing contract (remediation R-03 / §5.3).
 * Core stores capability codes verbatim and applies the frozen
 * `priority_then_agent_api_name` conflict policy; it adds no industry
 * heuristic.
 */
function validateRouting(
  routing: unknown,
  issues: PackageValidationIssue[],
): void {
  if (!routing || typeof routing !== 'object') {
    issues.push(issue('agent.routing', 'v2 package requires a routing contract'));
    return;
  }
  const r = routing as Partial<EmployeeRoutingContract>;
  if (r.mode !== 'automatic' && r.mode !== 'manual_only') {
    issues.push(issue('agent.routing.mode', 'routing.mode must be "automatic" or "manual_only"'));
  }
  if (r.conflictPolicy !== 'priority_then_agent_api_name') {
    issues.push(
      issue(
        'agent.routing.conflictPolicy',
        'routing.conflictPolicy must be exactly "priority_then_agent_api_name"',
      ),
    );
  }
  if (!Array.isArray(r.capabilities)) {
    issues.push(issue('agent.routing.capabilities', 'routing.capabilities must be an array'));
    return;
  }
  if (r.mode === 'automatic' && r.capabilities.length === 0) {
    issues.push(
      issue(
        'agent.routing.capabilities',
        'an automatic-mode routing contract must declare at least one capability',
      ),
    );
  }
  const seenCodes = new Set<string>();
  r.capabilities.forEach((cap, i) => {
    if (!cap || typeof cap !== 'object') {
      issues.push(issue(`agent.routing.capabilities[${i}]`, 'capability must be an object'));
      return;
    }
    if (!isNonEmptyString(cap.code) || !ROUTING_CAPABILITY_CODE_PATTERN.test(cap.code)) {
      issues.push(
        issue(
          `agent.routing.capabilities[${i}].code`,
          'capability.code must be a stable lowercase dotted key (e.g. prospect_research.market_scan)',
        ),
      );
    } else if (seenCodes.has(cap.code)) {
      issues.push(
        issue(`agent.routing.capabilities[${i}].code`, `duplicate capability code: ${cap.code}`),
      );
    } else {
      seenCodes.add(cap.code);
    }
    if (!cap.descriptions || typeof cap.descriptions !== 'object' || Object.keys(cap.descriptions).length === 0) {
      issues.push(
        issue(
          `agent.routing.capabilities[${i}].descriptions`,
          'capability.descriptions must be a non-empty locale→text map',
        ),
      );
    }
    if (cap.priority !== undefined && (typeof cap.priority !== 'number' || Number.isNaN(cap.priority))) {
      issues.push(
        issue(`agent.routing.capabilities[${i}].priority`, 'capability.priority must be a number when present'),
      );
    }
  });
}
