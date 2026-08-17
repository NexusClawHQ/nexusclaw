import type { GuardrailRule } from './entities/guardrail-rule.entity.js';
import type { ToolCallOperation } from './interfaces.js';

/**
 * Rule loading seam for the guardrail engine. The product loads rules from
 * TypeORM with a 5-minute Redis cache; a standalone library keeps the loading
 * strategy pluggable (see TypeOrmRuleProvider / InMemoryRuleProvider).
 */
export interface RuleProvider {
  loadRules(workspaceId: string, ruleIds?: string[]): Promise<GuardrailRule[]>;
}

/** In-memory provider for tests and single-process use. */
export class InMemoryRuleProvider implements RuleProvider {
  constructor(private readonly rules: GuardrailRule[]) {}

  async loadRules(workspaceId: string, ruleIds?: string[]): Promise<GuardrailRule[]> {
    let candidates = this.rules.filter(
      (rule) => rule.workspaceId === workspaceId && rule.isActive === true,
    );
    if (ruleIds && ruleIds.length > 0) {
      const idSet = new Set(ruleIds);
      candidates = candidates.filter((rule) => idSet.has(rule.id));
    }
    return candidates.sort((a, b) => a.priority - b.priority);
  }
}
