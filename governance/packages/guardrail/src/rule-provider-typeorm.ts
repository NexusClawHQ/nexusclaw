import { In, type FindOptionsWhere, type Repository } from 'typeorm';
import type { GuardrailRule } from './entities/guardrail-rule.entity.js';
import type { RuleProvider } from './rule-provider.js';

/**
 * TypeORM-backed rule provider (the product's default). Rule loading is
 * cached in Redis with a 5-minute TTL when a cache client is provided;
 * without one the provider simply loads from the repository.
 */
export class TypeOrmRuleProvider implements RuleProvider {
  constructor(
    private readonly ruleRepo: Repository<GuardrailRule>,
    private readonly redis?: {
      get(key: string): Promise<string | null>;
      set(key: string, value: string, mode: 'EX', ttl: number): Promise<unknown>;
    },
    private readonly ruleCacheTtl = 300,
  ) {}

  async loadRules(workspaceId: string, ruleIds?: string[]): Promise<GuardrailRule[]> {
    const scopeSuffix =
      ruleIds && ruleIds.length > 0 ? `:agent:${[...ruleIds].sort().join(',')}` : '';
    const cacheKey = `guardrail_rules:${workspaceId}${scopeSuffix}`;
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as GuardrailRule[];
      } catch {
        // cache miss / failure — fall through to the repository
      }
    }

    const where: FindOptionsWhere<GuardrailRule> = { workspaceId, isActive: true };
    if (ruleIds && ruleIds.length > 0) {
      where.id = In(ruleIds);
    }
    const rules = await this.ruleRepo.find({ where, order: { priority: 'ASC' } });

    if (this.redis) {
      try {
        await this.redis.set(cacheKey, JSON.stringify(rules), 'EX', this.ruleCacheTtl);
      } catch {
        // non-critical
      }
    }
    return rules;
  }
}
