import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, type FindOptionsWhere } from 'typeorm';
import { GuardrailRule } from '../entities/guardrail-rule.entity';
import { RuleMatcherService } from './rule-matcher.service';
import { RiskAssessorService } from './risk-assessor.service';
import { GuardrailEvaluation, ToolCallOperation, GuardrailActionResult } from '../interfaces';

const RULE_CACHE_TTL = 300; // 5 minutes

/**
 * Guardrail Engine Service
 *
 * Main entry point: evaluate() chains rule loading → matching → risk assessment.
 * Rules are cached in Redis with 5-minute TTL.
 *
 * AELG-1.2 (2026-07-25): evaluate() now accepts an optional `ruleIds` filter so
 * callers can scope evaluation to the rules bound to a specific agent
 * (`agent.guardrailRules.ruleIds`, projected by AgentBuilderService.
 * applyDefinitionToRuntimeFields). When `ruleIds` is omitted the engine falls
 * back to the legacy workspace-wide behavior (all active rules), preserving
 * backward compatibility.
 *
 * NOTE: The engine does NOT resolve `agentId → ruleIds` itself, because
 * GuardrailModule intentionally does not import AgentModule (avoids a circular
 * module dependency). Callers (e.g. the future tool-execution integration)
 * read `agent.guardrailRules.ruleIds` and pass it here. Wiring evaluate() into
 * the executor pipeline is tracked as a separate spec (see AELG design D-1.2).
 */
@Injectable()
export class GuardrailEngineService {
  private readonly logger = new Logger(GuardrailEngineService.name);

  constructor(
    @InjectRepository(GuardrailRule)
    private readonly ruleRepo: Repository<GuardrailRule>,
    @Inject('REDIS_CLIENT') private readonly redis: any,
    private readonly ruleMatcher: RuleMatcherService,
    private readonly riskAssessor: RiskAssessorService,
  ) {}

  /**
   * Evaluate a tool call against guardrail rules.
   *
   * @param workspaceId  Workspace scope (always required).
   * @param toolName     Tool being called.
   * @param toolInput    Tool input payload.
   * @param ruleIds      Optional allowlist of rule IDs bound to the executing
   *                     agent (`agent.guardrailRules.ruleIds`). When provided,
   *                     only those rules are loaded+matched; when omitted,
   *                     all active workspace rules are considered (legacy
   *                     workspace-wide behavior).
   */
  async evaluate(
    workspaceId: string,
    toolName: string,
    toolInput: Record<string, any>,
    ruleIds?: string[],
  ): Promise<GuardrailEvaluation> {
    const rules = await this.loadRules(workspaceId, ruleIds);
    const operation = this.extractOperation(toolName, toolInput);
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
      action: this.mapRiskToAction(topRule),
    };
  }

  /** Extract operation context from tool call */
  extractOperation(toolName: string, input: Record<string, any>): ToolCallOperation {
    return {
      objectApiName: input.objectApiName || input.object,
      operation: input.operation || toolName,
      fieldApiNames: input.fields ? Object.keys(input.fields) : input.fieldApiNames,
      amount: input.amount || input.value,
      batchSize: Array.isArray(input.records) ? input.records.length : input.batchSize,
    };
  }

  /**
   * Load active rules from cache or DB.
   *
   * AELG-1.2: when `ruleIds` is provided (agent-scoped), only those rule IDs
   * are loaded — this is what makes the agent-level binding in
   * `applyDefinitionToRuntimeFields` actually take effect at evaluation time.
   * When `ruleIds` is omitted the legacy workspace-wide load is used.
   *
   * Cache keys are namespaced by scope so agent-scoped and workspace-scoped
   * loads never collide.
   */
  private async loadRules(
    workspaceId: string,
    ruleIds?: string[],
  ): Promise<GuardrailRule[]> {
    const scopeSuffix = Array.isArray(ruleIds) && ruleIds.length > 0
      ? `:agent:${ruleIds.slice().sort().join(',')}`
      : '';
    const cacheKey = `guardrail_rules:${workspaceId}${scopeSuffix}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch { /* fall through */ }

    const where: FindOptionsWhere<GuardrailRule> = { workspaceId, isActive: true };
    if (Array.isArray(ruleIds) && ruleIds.length > 0) {
      where.id = In(ruleIds);
    }

    const rules = await this.ruleRepo.find({
      where,
      order: { priority: 'ASC' },
    });

    try {
      await this.redis.set(cacheKey, JSON.stringify(rules), 'EX', RULE_CACHE_TTL);
    } catch { /* non-critical */ }

    return rules;
  }

  /** Map risk level to action result */
  private mapRiskToAction(rule: GuardrailRule): GuardrailActionResult {
    switch (rule.riskLevel) {
      case 'L0': return { type: 'allow', blocked: false, escalated: false };
      case 'L1': return { type: 'audit', blocked: false, escalated: false };
      case 'L2': return {
        type: 'confirm', blocked: false, escalated: true,
        approverRule: rule.action?.approverRule,
        timeoutMinutes: rule.action?.timeoutMinutes,
      };
      case 'L3': return {
        type: 'approve', blocked: false, escalated: true,
        approverRule: rule.action?.approverRule,
        timeoutMinutes: rule.action?.timeoutMinutes,
      };
      case 'L4': return { type: 'block', blocked: true, escalated: false };
      default: return { type: 'allow', blocked: false, escalated: false };
    }
  }
}
