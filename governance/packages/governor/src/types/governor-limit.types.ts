export interface GovernorLimitConfig {
  maxSoqlQueries: number;
  maxQueryRows: number;
  maxDmlStatements: number;
  maxDmlRows: number;
  maxCpuTime: number;
  maxHeapSize: number;
  maxCallStackDepth: number;
  maxFutureCalls: number;
  maxCallouts: number;
  maxCalloutTime: number;
}

export interface GovernorCounterSnapshot {
  soqlQueries: number;
  queryRows: number;
  dmlStatements: number;
  dmlRows: number;
  cpuTime: number;
  heapSize: number;
  futureCalls: number;
  callouts: number;
  calloutTime: number;
}

export type GovernorResource =
  | 'soqlQueries'
  | 'queryRows'
  | 'dmlStatements'
  | 'dmlRows'
  | 'cpuTime'
  | 'heapSize'
  | 'callStackDepth'
  | 'futureCalls'
  | 'callouts'
  | 'calloutTime';

export const DEFAULT_GOVERNOR_LIMITS: GovernorLimitConfig = {
  maxSoqlQueries: 100,
  maxQueryRows: 50_000,
  maxDmlStatements: 150,
  maxDmlRows: 10_000,
  maxCpuTime: 10_000,
  maxHeapSize: 6_291_456,
  maxCallStackDepth: 16,
  maxFutureCalls: 50,
  maxCallouts: 100,
  maxCalloutTime: 120_000,
};

export interface GovernorContextOptions {
  mode: 'sync' | 'async';
  limits?: Partial<GovernorLimitConfig>;
  userId?: string;
  workspaceId?: string;
}

export interface GovernorLimitsUsage {
  resource: string;
  current: number;
  limit: number;
}
