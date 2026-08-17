/**
 * Core interfaces for Agent Permission (RAG-Sec) module
 */

// Agent security context assembled from Role + AgentPermissionExtension
export interface AgentSecurityContext {
  agentId: string;
  workspaceId: string;
  roleId: string;
  dataScopeType: 'all' | 'org_subtree' | 'own' | 'custom';
  dataScopeOrgNodeId?: string;
  dataScopeCustomFilter?: string;
  orgSubtreeIds?: string[];
  maxQueriesPerMinute: number;
  maxWritesPerMinute: number;
  maxBatchSize: number;
  allowedTools: string[];
  blockedTools: string[];
  activeTimezone?: string;
  activeWindows?: TimeWindow[];
  objectPermissions: Record<string, ObjectPermission>;
  fieldPermissions: Record<string, Record<string, FieldPermission>>;
  fieldMaskRules: IFieldMaskRule[];
}

export interface ObjectPermission {
  objectApiName: string;
  canRead: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface FieldPermission {
  fieldApiName: string;
  canRead: boolean;
  canEdit: boolean;
}

export interface IFieldMaskRule {
  objectApiName: string;
  fieldApiName: string;
  maskType: 'hide' | 'partial' | 'hash' | 'range';
  maskConfig: MaskConfig;
}

export type MaskConfig = PartialMaskConfig | HashMaskConfig | RangeMaskConfig | Record<string, never>;

export interface PartialMaskConfig {
  prefixLength: number;
  suffixLength: number;
  maskChar?: string;
}

export interface HashMaskConfig {
  algorithm: 'sha256' | 'md5';
  truncateLength?: number;
}

export interface RangeMaskConfig {
  bucketSize: number;
  unit?: string;
}

export interface TimeWindow {
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  retryAfterSeconds?: number;
}

export interface DataScopeWhereClause {
  sql: string;
  params: any[];
}

export interface KnowledgeSearchOptions {
  query: string;
  workspaceId: string;
  agentSecurityContext: AgentSecurityContext;
  limit?: number;
  minSimilarity?: number;
  sourceObjectFilter?: string;
  /**
   * Narrow by `source_type` IN SQL (before the
   * similarity-ranked LIMIT) instead of post-query. RAG-Sec previously applied
   * its sourceTypeFilter in memory AFTER the top-K vector search, so a
   * workspace's higher-similarity public chunks filled the entire LIMIT and
   * the requested source type (e.g. the single curated exemplar) was evicted
   * before the filter ever ran.
   */
  sourceTypeFilter?: string;
  /** Server-authoritative knowledge binding. Applied in SQL with RAG-Sec filters. */
  chunkIds?: string[];
  /** Propagate owner failures when an aggregator must report partial results. */
  throwOnError?: boolean;
}

export interface KnowledgeSearchResult {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  contentType: string;
  /**
   * Cosine similarity in [0,1]. Always a finite number (0 when pgvector `<=>`
   * yields NULL, e.g. on a zero-norm embedding) so the whole result stays
   * JSON-safe — the executor rejects NaN in tool output.
   */
  similarity: number;
  sourceType?: string;
  sourceObject?: string;
  /** Owning record id (e.g. SOP id) when the chunk carries one. Always JSON-safe (null when absent). */
  sourceRecordId?: string | null;
  accessLevel: string;
  orgNodeId?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, any>;
}
