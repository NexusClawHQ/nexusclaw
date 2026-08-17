import { GovernorLimitConfig } from '../types/governor-limit.types.js';

export const SYNC_GOVERNOR_LIMITS: GovernorLimitConfig = {
  maxSoqlQueries: 100,
  maxQueryRows: 50000,
  maxDmlStatements: 150,
  maxDmlRows: 10000,
  maxCpuTime: 10000,
  maxHeapSize: 6291456,
  maxCallStackDepth: 16,
  maxFutureCalls: 50,
  maxCallouts: 100,
  maxCalloutTime: 120000,
};

export const ASYNC_GOVERNOR_LIMITS: GovernorLimitConfig = {
  maxSoqlQueries: 200,
  maxQueryRows: 50000,
  maxDmlStatements: 150,
  maxDmlRows: 10000,
  maxCpuTime: 60000,
  maxHeapSize: 12582912, // 12MB
  maxCallStackDepth: 16,
  maxFutureCalls: 50,
  maxCallouts: 100,
  maxCalloutTime: 120000,
};

/**
 * Map GovernorResource name to GovernorLimitConfig key.
 */
export const RESOURCE_TO_LIMIT_KEY: Record<string, keyof GovernorLimitConfig> = {
  soqlQueries: 'maxSoqlQueries',
  queryRows: 'maxQueryRows',
  dmlStatements: 'maxDmlStatements',
  dmlRows: 'maxDmlRows',
  cpuTime: 'maxCpuTime',
  heapSize: 'maxHeapSize',
  callStackDepth: 'maxCallStackDepth',
  futureCalls: 'maxFutureCalls',
  callouts: 'maxCallouts',
  calloutTime: 'maxCalloutTime',
};
