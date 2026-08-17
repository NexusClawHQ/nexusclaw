import { AsyncLocalStorage } from 'node:async_hooks';
import {
  GovernorResource,
  GovernorLimitConfig,
  GovernorContextOptions,
  GovernorLimitsUsage,
} from './types/governor-limit.types.js';
import {
  SYNC_GOVERNOR_LIMITS,
  ASYNC_GOVERNOR_LIMITS,
  RESOURCE_TO_LIMIT_KEY,
} from './constants/governor-limit.constants.js';
import {
  GovernorLimitContextMissingException,
  GovernorLimitException,
} from './errors/governor-limit.exception.js';

interface ExecutionContext {
  counters: Map<string, number>;
  limits: GovernorLimitConfig;
  userId?: string;
  workspaceId?: string;
  mode: 'sync' | 'async';
}

/**
 * Framework-neutral governor: in-memory AsyncLocalStorage counters with
 * sync/async limit tables. Extracted from NexusClaw governor-limit
 * (nexusclaw-core @ 9c10c229) with the Nest decorator and logger removed.
 */
export class GovernorLimitService {
  private readonly storage = new AsyncLocalStorage<ExecutionContext>();

  async runInContext<T>(fn: () => Promise<T>, options: GovernorContextOptions): Promise<T> {
    const baseLimits = options.mode === 'async' ? ASYNC_GOVERNOR_LIMITS : SYNC_GOVERNOR_LIMITS;
    const mergedLimits = options.limits ? { ...baseLimits, ...options.limits } : baseLimits;

    const ctx: ExecutionContext = {
      counters: new Map(),
      limits: mergedLimits,
      userId: options.userId,
      workspaceId: options.workspaceId,
      mode: options.mode,
    };

    return this.storage.run(ctx, fn);
  }

  checkAndIncrement(resource: GovernorResource, amount: number = 1): void {
    const ctx = this.storage.getStore();
    if (!ctx) {
      throw new GovernorLimitContextMissingException(resource);
    }

    const current = ctx.counters.get(resource) || 0;
    const limitKey = RESOURCE_TO_LIMIT_KEY[resource];
    const limit = limitKey ? ctx.limits[limitKey] : Infinity;

    if (current + amount > limit) {
      throw new GovernorLimitException(resource, current + amount, limit);
    }

    ctx.counters.set(resource, current + amount);
  }

  getUsage(resource: GovernorResource): number {
    const ctx = this.storage.getStore();
    if (!ctx) {
      throw new GovernorLimitContextMissingException(resource);
    }
    return ctx.counters.get(resource) || 0;
  }

  getLimit(resource: GovernorResource): number {
    const ctx = this.storage.getStore();
    if (!ctx) {
      throw new GovernorLimitContextMissingException(resource);
    }
    const limitKey = RESOURCE_TO_LIMIT_KEY[resource];
    return limitKey ? ctx.limits[limitKey] : 0;
  }

  getLimitsUsage(): GovernorLimitsUsage[] {
    const ctx = this.storage.getStore();
    if (!ctx) {
      throw new GovernorLimitContextMissingException('all');
    }

    return Object.entries(RESOURCE_TO_LIMIT_KEY).map(([resource, limitKey]) => ({
      resource,
      current: ctx.counters.get(resource) || 0,
      limit: ctx.limits[limitKey],
    }));
  }

  hasContext(): boolean {
    return !!this.storage.getStore();
  }
}
