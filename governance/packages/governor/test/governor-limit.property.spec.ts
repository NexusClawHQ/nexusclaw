import { describe, it, expect, beforeEach } from 'vitest';
/**
 * Governor Limits Property-Based Tests
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
import * as fc from 'fast-check';
import { GovernorLimitService } from '../src/governor-limit.service';
import {
  GovernorLimitContextMissingException,
  GovernorLimitException,
} from '../src/errors/governor-limit.exception';
import {
  SYNC_GOVERNOR_LIMITS,
  RESOURCE_TO_LIMIT_KEY,
} from '../src/constants/governor-limit.constants';
import { GovernorResource } from '../src/types/governor-limit.types';

const ALL_RESOURCES: GovernorResource[] = Object.keys(
  RESOURCE_TO_LIMIT_KEY,
) as GovernorResource[];

/** Arbitrary that picks a random GovernorResource */
const resourceArb = fc.constantFrom(...ALL_RESOURCES);

describe('GovernorLimitService Property Tests', () => {
  let service: GovernorLimitService;

  beforeEach(() => {
    service = new GovernorLimitService();
  });

  /**
   * Property 1: Exceeding limit MUST throw GovernorLimitException
   * Validates: Requirements 3.1
   *
   * For any resource, if current + amount > limit, checkAndIncrement MUST throw.
   */
  it('should throw GovernorLimitException when current + amount > limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        resourceArb,
        fc.integer({ min: 1, max: 500 }),  // limit
        fc.integer({ min: 1, max: 500 }),  // extra beyond limit
        async (resource, limit, extra) => {
          const limitKey = RESOURCE_TO_LIMIT_KEY[resource];
          const customLimits = { ...SYNC_GOVERNOR_LIMITS, [limitKey]: limit };

          await service.runInContext(
            async () => {
              // Pre-fill counter to exactly the limit
              service.checkAndIncrement(resource, limit);
              // Now adding extra should exceed limit and throw
              expect(() => service.checkAndIncrement(resource, extra)).toThrow(
                GovernorLimitException,
              );
            },
            { mode: 'sync', limits: customLimits },
          );
        },
      ),
    );
  });

  /**
   * Property 2: Exactly at limit MUST NOT throw
   * Validates: Requirements 3.2
   *
   * For any resource, when current + amount == limit, checkAndIncrement succeeds.
   */
  it('should NOT throw when current + amount == limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        resourceArb,
        fc.integer({ min: 1, max: 1000 }), // limit
        async (resource, limit) => {
          const limitKey = RESOURCE_TO_LIMIT_KEY[resource];
          const customLimits = { ...SYNC_GOVERNOR_LIMITS, [limitKey]: limit };

          await service.runInContext(
            async () => {
              // Single call with amount == limit should succeed
              expect(() => service.checkAndIncrement(resource, limit)).not.toThrow();
            },
            { mode: 'sync', limits: customLimits },
          );
        },
      ),
    );
  });

  /**
   * Property 3: Exceeding limit by exactly 1 MUST throw
   * Validates: Requirements 3.3
   *
   * For any resource, when current + amount == limit + 1, checkAndIncrement throws.
   */
  it('should throw GovernorLimitException when current + amount == limit + 1', async () => {
    await fc.assert(
      fc.asyncProperty(
        resourceArb,
        fc.integer({ min: 1, max: 1000 }), // limit
        async (resource, limit) => {
          const limitKey = RESOURCE_TO_LIMIT_KEY[resource];
          const customLimits = { ...SYNC_GOVERNOR_LIMITS, [limitKey]: limit };

          await service.runInContext(
            async () => {
              // amount = limit + 1 should exceed and throw
              expect(() =>
                service.checkAndIncrement(resource, limit + 1),
              ).toThrow(GovernorLimitException);
            },
            { mode: 'sync', limits: customLimits },
          );
        },
      ),
    );
  });

  /**
   * Property 4: No context MUST throw GovernorLimitContextMissingException
   * Validates: Requirements 3.4
   *
   * When called outside runInContext, checkAndIncrement throws context missing.
   */
  it('should throw GovernorLimitContextMissingException when no context', () => {
    fc.assert(
      fc.property(resourceArb, fc.integer({ min: 1, max: 100 }), (resource, amount) => {
        expect(() => service.checkAndIncrement(resource, amount)).toThrow(
          GovernorLimitContextMissingException,
        );
      }),
    );
  });

  /**
   * Property 5: Idempotency — consecutive calls counter equals sum(amounts)
   * Validates: Requirements 3.5
   *
   * For a sequence of amounts in the same context, the counter equals their sum.
   */
  it('should have counter equal to sum of all amounts after consecutive calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        resourceArb,
        fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 1, maxLength: 20 }),
        async (resource, amounts) => {
          const total = amounts.reduce((a, b) => a + b, 0);
          // Set limit high enough to accommodate all amounts
          const limitKey = RESOURCE_TO_LIMIT_KEY[resource];
          const customLimits = {
            ...SYNC_GOVERNOR_LIMITS,
            [limitKey]: total + 1000,
          };

          await service.runInContext(
            async () => {
              for (const amount of amounts) {
                service.checkAndIncrement(resource, amount);
              }
              expect(service.getUsage(resource)).toBe(total);
            },
            { mode: 'sync', limits: customLimits },
          );
        },
      ),
    );
  });

  /**
   * Property 6: Context isolation — concurrent runInContext calls have independent counters
   * Validates: Requirements 3.6
   *
   * Two concurrent contexts with the same resource do not interfere with each other.
   */
  it('should isolate counters between concurrent runInContext calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        resourceArb,
        fc.integer({ min: 1, max: 100 }), // amountA
        fc.integer({ min: 1, max: 100 }), // amountB
        async (resource, amountA, amountB) => {
          const limitKey = RESOURCE_TO_LIMIT_KEY[resource];
          const highLimit = { ...SYNC_GOVERNOR_LIMITS, [limitKey]: 10000 };

          let usageA = -1;
          let usageB = -1;

          // Run two contexts concurrently
          await Promise.all([
            service.runInContext(
              async () => {
                service.checkAndIncrement(resource, amountA);
                // Yield to allow interleaving
                await new Promise((r) => setImmediate(r));
                usageA = service.getUsage(resource);
              },
              { mode: 'sync', limits: highLimit },
            ),
            service.runInContext(
              async () => {
                service.checkAndIncrement(resource, amountB);
                // Yield to allow interleaving
                await new Promise((r) => setImmediate(r));
                usageB = service.getUsage(resource);
              },
              { mode: 'sync', limits: highLimit },
            ),
          ]);

          // Each context should only see its own counter
          expect(usageA).toBe(amountA);
          expect(usageB).toBe(amountB);
        },
      ),
    );
  });
});
