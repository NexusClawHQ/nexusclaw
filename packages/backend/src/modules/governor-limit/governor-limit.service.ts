import { Injectable, Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import {
  GovernorResource,
  GovernorLimitConfig,
  GovernorContextOptions,
  GovernorLimitsUsage,
} from './types/governor-limit.types';
import {
  SYNC_GOVERNOR_LIMITS,
  ASYNC_GOVERNOR_LIMITS,
  RESOURCE_TO_LIMIT_KEY,
} from './constants/governor-limit.constants';
import {
  GovernorLimitContextMissingException,
  GovernorLimitException,
} from './errors/governor-limit.exception';

interface ExecutionContext {
  counters: Map<string, number>;
  limits: GovernorLimitConfig;
  userId?: string;
  workspaceId?: string;
  mode: 'sync' | 'async';
}

@Injectable()
export class GovernorLimitService {
  private readonly logger = new Logger(GovernorLimitService.name);
  private readonly storage = new AsyncLocalStorage<ExecutionContext>();

  /**
   * Run a function within a Governor Limits execution context.
   * Context is automatically cleaned up when the function completes.
   */
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

  /**
   * Check if current usage + amount exceeds the limit for the resource.
   * If exceeded, throws GovernorLimitException.
   */
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

  /**
   * Get current usage for a resource.
   */
  getUsage(resource: GovernorResource): number {
    const ctx = this.storage.getStore();
    if (!ctx) {
      throw new GovernorLimitContextMissingException(resource);
    }
    return ctx.counters.get(resource) || 0;
  }

  /**
   * Get the limit value for a resource.
   */
  getLimit(resource: GovernorResource): number {
    const ctx = this.storage.getStore();
    if (!ctx) {
      throw new GovernorLimitContextMissingException(resource);
    }
    const limitKey = RESOURCE_TO_LIMIT_KEY[resource];
    return limitKey ? ctx.limits[limitKey] : 0;
  }

  /**
   * Get usage summary for all tracked resources.
   */
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

  /**
   * Check if currently running within a Governor Limits context.
   */
  hasContext(): boolean {
    return !!this.storage.getStore();
  }
}
