import type { GuardrailRule } from './entities/guardrail-rule.entity.js';

const RISK_ORDER: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };

/**
 * Risk Assessor Service
 *
 * Selects the highest risk level from matched rules.
 * Same level: pick the one with lowest priority number.
 */
export class RiskAssessorService {
  assessRisk(matchedRules: GuardrailRule[]): GuardrailRule | null {
    if (matchedRules.length === 0) return null;

    return matchedRules.reduce((highest, current) => {
      const hLevel = RISK_ORDER[highest.riskLevel] ?? 0;
      const cLevel = RISK_ORDER[current.riskLevel] ?? 0;
      if (cLevel > hLevel) return current;
      if (cLevel === hLevel && current.priority < highest.priority) return current;
      return highest;
    });
  }
}
