import type { GuardrailRule } from './entities/guardrail-rule.entity.js';
import type {
  GuardrailActionResult,
  GuardrailEvaluation,
  ToolCallOperation,
} from './interfaces.js';
import { RuleMatcherService } from './rule-matcher.js';
import { RiskAssessorService } from './risk-assessor.js';
import type { RuleProvider } from './rule-provider.js';

/**
 * Guardrail engine: evaluate() chains rule loading → matching → risk
 * assessment. Framework-neutral (the product wires TypeORM/Redis/Nest).
 *
 * AELG-1.2 semantics preserved: an optional `ruleIds` filter scopes
 * evaluation to the rules bound to a specific agent; when omitted the
 * workspace-wide active rules are considered.
 */
export class GuardrailEngineService {
  constructor(
    private readonly ruleProvider: RuleProvider,
    private readonly ruleMatcher = new RuleMatcherService(),
    private readonly riskAssessor = new RiskAssessorService(),
  ) {}

  async evaluate(
    workspaceId: string,
    toolName: string,
    toolInput: Record<string, unknown>,
    ruleIds?: string[],
  ): Promise<GuardrailEvaluation> {
    const rules = await this.ruleProvider.loadRules(workspaceId, ruleIds);
    const operation = extractOperation(toolName, toolInput);
    const matched = this.ruleMatcher.matchRules(operation, rules);
    const topRule = this.riskAssessor.assessRisk(matched);

    if (!topRule) {
      return {
        matched: false,
        riskLevel: 'L0',
        action: { type: 'allow', blocked: false, escalated: false },
      };
    }

    return {
      matched: true,
      ruleId: topRule.id,
      ruleName: topRule.name,
      riskLevel: topRule.riskLevel,
      action: mapRiskToAction(topRule),
    };
  }
}

/** Extract operation context from a tool call (pure). */
export function extractOperation(
  toolName: string,
  input: Record<string, unknown>,
): ToolCallOperation {
  return {
    objectApiName: (input.objectApiName as string) || (input.object as string),
    operation: (input.operation as string) || toolName,
    fieldApiNames: input.fields
      ? Object.keys(input.fields as Record<string, unknown>)
      : (input.fieldApiNames as string[] | undefined),
    amount: (input.amount as number) || (input.value as number),
    batchSize: Array.isArray(input.records)
      ? (input.records as unknown[]).length
      : (input.batchSize as number | undefined),
  };
}

/** Map a risk level to the action result (pure). */
export function mapRiskToAction(rule: GuardrailRule): GuardrailActionResult {
  switch (rule.riskLevel) {
    case 'L0':
      return { type: 'allow', blocked: false, escalated: false };
    case 'L1':
      return { type: 'audit', blocked: false, escalated: false };
    case 'L2':
      return {
        type: 'confirm',
        blocked: false,
        escalated: true,
        approverRule: rule.action?.approverRule,
        timeoutMinutes: rule.action?.timeoutMinutes,
      };
    case 'L3':
      return {
        type: 'approve',
        blocked: false,
        escalated: true,
        approverRule: rule.action?.approverRule,
        timeoutMinutes: rule.action?.timeoutMinutes,
      };
    case 'L4':
      return { type: 'block', blocked: true, escalated: false };
    default:
      return { type: 'allow', blocked: false, escalated: false };
  }
}
