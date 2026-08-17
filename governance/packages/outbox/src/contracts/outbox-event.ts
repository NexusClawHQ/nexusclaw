/**
 * Shared cross-cutting contract — OutboxEvent.
 *
 * Source of truth: `.kiro/specs/foundation-gap-audit/design.md`
 *   - "Components and Interfaces" → Shared Cross-Cutting Contract 3 — Outbox 事件信封
 *   - "Data Models" → Shared Schema 3 — OutboxEvent
 *
 * Scope:
 *   - Pure TypeScript contract + zod runtime schema.
 *   - DOES NOT define a TypeORM entity, migration, or GraphQL type.
 *   - Lives in `common/contracts/` so every consumer sub-spec references one
 *     authoritative shape; sub-specs MUST NOT redefine these fields.
 *
 * Temporary bridge (until Req 2 — `idempotency-and-outbox` lands):
 *   - 本 schema 在 Req 2 sub-spec 落地前先存在；Req 1 等先发布 sub-spec 的
 *     EventEmitter 临时桥 payload MUST 通过本 schema 校验，确保 Req 2 落地后
 *     由统一 OutboxModule 接管时无字段形态分叉。
 *   - Req 2 sub-spec 落地的 `OutboxEvent` entity 字段集 MUST 与本 schema 一致；
 *     落地后由迁移任务删除 EventEmitter 分支，所有发布点改走 Outbox 表。
 *   - 每条 EventEmitter 临时桥使用点 MUST 标 outbox-migration 注释（历史
 *     约定：以 TODO 前缀加 outbox 关键字，详见 Wave 2 sub-spec），便于 Req 2
 *     落地后 CI 一次性清零（参见 design Property 3）。Wave 2 落地后所有此类
 *     注释已清零。
 *
 * Outbox envelope summary (see Cross-Cutting Contract 3 for full text):
 *   - id              UUIDv7（运行时由 `generateId()` 产生）。
 *   - topic           形如 'file_events' / 'license_events' / 'queue_events'。
 *   - aggregateType   形如 'ContentDocument' / 'UserLicense' / 'QueueDefinition'。
 *   - traceContext    必带 traceId + correlationId；流程 / 长任务路径带 executionId。
 *   - publishedAt     null 表示待发布；非 null 表示已成功推到下游通道。
 *   - attemptCount    非负整数；每次投递尝试 +1。
 *
 * Validates: foundation-gap-audit design Property 1 (横切契约一致性).
 */

import { z } from 'zod';

/**
 * Trace context carried inside every Outbox envelope. Mirrors the `traceId /
 * correlationId / executionId` triplet from `RequestTraceContext` (Shared
 * Schema 1) so downstream consumers can stitch business events back onto the
 * originating request without re-deriving the trace family.
 */
export interface OutboxEventTraceContext {
  traceId: string;
  correlationId: string;
  executionId?: string;
}

/**
 * Shared Schema 3 — OutboxEvent.
 *
 * Field semantics:
 *   - id                UUIDv7 主键。
 *   - workspaceId       tenant 隔离主键；与 traceContext 路径上的 workspace 对齐。
 *   - topic             下游订阅通道名，形如 'file_events' / 'license_events'。
 *   - eventType         领域事件名，形如 'file.uploaded' / 'license.seat.assigned'。
 *   - aggregateType     聚合根类型，形如 'ContentDocument' / 'UserLicense'。
 *   - aggregateId       聚合根主键。
 *   - payload           事件业务负载；schema 由各 sub-spec 自行细化。
 *   - traceContext      see {@link OutboxEventTraceContext}。
 *   - idempotencyKey    可选；与 Shared Cross-Cutting Contract 4 的 key 同源。
 *   - createdAt         事件入箱时间。
 *   - publishedAt       null 表示待发布；非 null 表示已成功投递。
 *   - attemptCount      非负整数；每次投递尝试 +1（含成功与失败）。
 *   - lastError         最近一次失败的错误摘要；成功后由消费者清空。
 */
export interface OutboxEvent {
  id: string;
  workspaceId: string;
  topic: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  traceContext: OutboxEventTraceContext;
  idempotencyKey?: string;
  createdAt: Date;
  publishedAt: Date | null;
  attemptCount: number;
  lastError?: string;
}

/**
 * Runtime validator for {@link OutboxEventTraceContext}. Inlined as a const so
 * it can be reused both inside {@link outboxEventSchema} and by sub-specs that
 * need to validate the trace block independently (e.g. EventEmitter bridge
 * points building an Outbox-shaped payload before Req 2 lands).
 */
export const outboxEventTraceContextSchema = z.object({
  traceId: z.string().min(1),
  correlationId: z.string().min(1),
  executionId: z.string().min(1).optional(),
});

/**
 * Runtime validator for {@link OutboxEvent}.
 *
 * Use at every read/write boundary that produces or consumes an Outbox row:
 *   - Req 1 等先发布 sub-spec 的 EventEmitter 临时桥发布点（payload 必须 parse
 *     通过本 schema，确保 Req 2 落地后形态零分叉）。
 *   - Req 2 落地的 OutboxModule 落库前 / 投递前的最终校验。
 *
 * Sub-specs MUST NOT substitute their own zod schema with a divergent shape.
 */
export const outboxEventSchema = z.object({
  id: z.string().min(1).describe('UUIDv7 primary key'),
  workspaceId: z.string().min(1),
  topic: z
    .string()
    .min(1)
    .describe("Downstream channel, e.g. 'file_events' / 'license_events'"),
  eventType: z
    .string()
    .min(1)
    .describe("Domain event name, e.g. 'file.uploaded'"),
  aggregateType: z
    .string()
    .min(1)
    .describe("Aggregate root type, e.g. 'ContentDocument'"),
  aggregateId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  traceContext: outboxEventTraceContextSchema,
  idempotencyKey: z.string().min(1).optional(),
  createdAt: z.date(),
  publishedAt: z.date().nullable(),
  attemptCount: z.number().int().min(0),
  lastError: z.string().min(1).optional(),
});

/**
 * Zod-inferred type. Equivalent to {@link OutboxEvent} at compile time;
 * exported for callers that prefer the inferred form (e.g. parsing untrusted
 * input via `outboxEventSchema.parse(...)`).
 */
export type OutboxEventSchema = z.infer<typeof outboxEventSchema>;
