import { Injectable } from '@nestjs/common';
import { GuardrailRule } from '../entities/guardrail-rule.entity';
import { ToolCallOperation } from '../interfaces';

/**
 * Rule Matcher Service
 *
 * Matches tool call operations against guardrail rule conditions.
 * All specified conditions use AND logic; unspecified conditions are wildcards.
 */
@Injectable()
export class RuleMatcherService {
  matchRules(operation: ToolCallOperation, rules: GuardrailRule[]): GuardrailRule[] {
    return rules.filter(rule => this.matchRule(operation, rule));
  }

  private matchRule(op: ToolCallOperation, rule: GuardrailRule): boolean {
    const cond = rule.conditions;
    if (!cond || typeof cond !== 'object') return false;
    if (Object.keys(cond).length === 0) return true;

    const hasExecutableCondition =
      typeof cond.objectApiName === 'string' ||
      typeof cond.operation === 'string' ||
      (Array.isArray(cond.fieldApiNames) && cond.fieldApiNames.length > 0) ||
      cond.amountThreshold != null ||
      cond.batchSize != null;
    if (!hasExecutableCondition) return false;

    if (
      cond.objectApiName &&
      (!op.objectApiName || cond.objectApiName !== op.objectApiName)
    ) return false;
    if (
      cond.operation &&
      (!op.operation || cond.operation !== op.operation)
    ) return false;

    if (cond.fieldApiNames && cond.fieldApiNames.length > 0) {
      if (!op.fieldApiNames || op.fieldApiNames.length === 0) return false;
      const intersection = cond.fieldApiNames.filter(f => op.fieldApiNames!.includes(f));
      if (intersection.length === 0) return false;
    }

    if (cond.amountThreshold != null) {
      if (op.amount == null) return false;
      if (op.amount < cond.amountThreshold) return false;
    }

    if (cond.batchSize != null) {
      if (op.batchSize == null) return false;
      if (op.batchSize < cond.batchSize) return false;
    }

    return true;
  }
}
