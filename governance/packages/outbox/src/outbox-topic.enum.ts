/**
 * OutboxTopic — canonical topic names for the platform Transactional Outbox.
 *
 * Spec: `.kiro/specs/idempotency-and-outbox/design.md`
 *   - Architecture / System Context: each topic maps to a per-domain handler
 *     registered via OutboxHandlerRegistry.
 *   - Frozen Decision 5 (DLQ): a per-topic dead-letter channel uses the same
 *     `outbox_events` table with the `::dlq` suffix appended to the topic
 *     name (e.g. `file_events::dlq`).
 *   - Frozen Decision 7 (headless-gateway DLQ): the headless-gateway
 *     persistent dead-letter channel uses topic `gateway_dlq` (NOT
 *     `<original>::dlq`) because it has no producing topic — failed
 *     gateway deliveries are persisted directly into this dedicated
 *     stream.
 *
 * Runtime constants only — NOT registered with GraphQL. The Outbox table
 * is internal infrastructure; topics are only consumed by:
 *   - producer side: business code calling `OutboxService.runInTransaction`
 *   - consumer side: domain modules registering handlers via
 *     `OutboxHandlerRegistry.register(topic, handler)`
 *
 * Adding a new topic MUST be done by appending an entry here AND adding
 * the consumer-side handler in the corresponding domain module's tasks
 * (see foundation-gap-audit/design.md "Cross-Spec Module Map").
 */
export const OutboxTopic = {
  /** File-storage lifecycle events (Wave 1 sub-spec). */
  FILE_EVENTS: 'file_events',
  /** Outbound webhook delivery events. */
  WEBHOOK_EVENTS: 'webhook_events',
  /** Change-data-capture stream events. */
  CDC_EVENTS: 'cdc_events',
  /** agent-runtime execution + outcome events. */
  AGENT_EVENTS: 'agent_events',
  /** Immutable executable-v2 approval subject terminal decisions. */
  APPROVAL_EVENTS: 'approval_events',
  /** Workforce Flow active-binding projection transitions. */
  WORKFORCE_FLOW_EVENTS: 'workforce_flow_events',
  /** Workforce release head/revocation cache invalidation events. */
  WORKFORCE_RELEASE_EVENTS: 'workforce_release_events',
  /** billing / metering / outcome-billing / attribution events. */
  BILLING_EVENTS: 'billing_events',
  /** setup-audit writes routed through Outbox. */
  AUDIT_EVENTS: 'audit_events',
  /** headless-gateway dead-letter channel (replaces in-memory DLQ). */
  GATEWAY_DLQ: 'gateway_dlq',
  /** User license + permission-set-license lifecycle events (Wave 3 sub-spec). */
  LICENSE_EVENTS: 'license_events',
  /** PermissionSet permission / assignment lifecycle events consumed by PermissionModule cache invalidation. */
  PERMISSION_SET_EVENTS: 'permission_set_events',
  /** MFA factor + step-up lifecycle events (Wave 4 sub-spec). */
  MFA_EVENTS: 'mfa_events',
  /** Session lifecycle events (e.g. session.invalidate.user) consumed by SessionModule OutboxHandler (registered in Phase 4). */
  SESSION_EVENTS: 'session_events',
  /** User-facing transactional delivery intents such as account activation. */
  USER_NOTIFICATION_EVENTS: 'user_notification_events',
  /** RecycleBin lifecycle events (Wave 6 sub-spec). */
  RECYCLEBIN_EVENTS: 'recyclebin_events',
  /** DSAR access / erasure / field-retention lifecycle events (Wave 7 sub-spec). */
  DSAR_EVENTS: 'dsar_events',
  /** Queue (as owner) lifecycle + assignment events (Wave 5 sub-spec). */
  QUEUE_EVENTS: 'queue_events',
  /** Service case lifecycle events consumed by AI/service automation. */
  CASE_EVENTS: 'case_events',
  /** Inbound email/form lifecycle events (Wave 8 sub-spec). */
  INBOUND_EVENTS: 'inbound_events',
  /** Activity / timeline lifecycle events (Wave 9 sub-spec). */
  ACTIVITY_EVENTS: 'activity_events',
  /** Chatter feed automation events. */
  CHATTER_EVENTS: 'chatter_events',
  /** Execution log real-time stream events. */
  EXECUTION_LOG_EVENTS: 'execution_log_events',
  /** SSE fan-out events delivered by SseModule. */
  SSE_EVENTS: 'sse_events',
  /** Experience site publication + cache lifecycle events. */
  EXPERIENCE_SITE_EVENTS: 'experience_site_events',
  /** Site SEO lifecycle events such as sitemap regeneration. */
  SITE_SEO_EVENTS: 'site_seo_events',
  /** Record lifecycle events that still fan out through EventBus compatibility handlers. */
  RECORD_EVENTS: 'record_events',
  /** Metadata lifecycle events that still fan out through EventBus compatibility handlers. */
  METADATA_EVENTS: 'metadata_events',
  /** Data sharing lifecycle events that still fan out through EventBus compatibility handlers. */
  DATA_SHARING_EVENTS: 'data_sharing_events',
  /** Deployment progress/completion/component events that still fan out to legacy listeners. */
  DEPLOYMENT_EVENTS: 'deployment_events',
  /** Data import progress/completion/failure events that still fan out to legacy SSE listeners. */
  IMPORT_EVENTS: 'import_events',
  /** External_Profile lifecycle events that still fan out to legacy cache listeners. */
  EXTERNAL_PROFILE_EVENTS: 'external_profile_events',
  /** Workflow-step platform events that still fan out to in-process workflow listeners. */
  WORKFLOW_PLATFORM_EVENTS: 'workflow_platform_events',
  /** Site community post lifecycle events that still fan out to reputation/notification listeners. */
  SITE_COMMUNITY_EVENTS: 'site_community_events',
  /** Sandbox lifecycle/deployment/promotion events that still fan out to legacy listeners. */
  SANDBOX_EVENTS: 'sandbox_events',
  /** Metadata-driven global search config + reindex events (Wave 10 sub-spec). */
  SEARCH_EVENTS: 'search_events',
  /** Schedulable job config + run lifecycle events (Wave 10 sub-spec). */
  SCHEDULED_JOB_EVENTS: 'scheduled_job_events',
} as const;

export type OutboxTopic = typeof OutboxTopic[keyof typeof OutboxTopic];

/**
 * Suffix appended to a primary topic name to mark its dead-letter
 * channel. E.g. `file_events` → `file_events::dlq` once
 * `OutboxEvent.attemptCount` reaches the threshold defined in
 * `design.md` Frozen Decision 6 (5 attempts).
 *
 * NOTE: `gateway_dlq` does NOT use this suffix because it is a
 * primary topic (see Frozen Decision 7).
 */
export const OUTBOX_DLQ_SUFFIX = '::dlq' as const;

/**
 * Derive the dead-letter topic name for a given primary topic.
 *
 * @example
 *   toDlqTopic(OutboxTopic.FILE_EVENTS) // → 'file_events::dlq'
 */
export function toDlqTopic(topic: string): string {
  return `${topic}${OUTBOX_DLQ_SUFFIX}`;
}

/**
 * Detect whether a topic name is already a dead-letter channel.
 *
 * @example
 *   isDlqTopic('file_events::dlq') // → true
 *   isDlqTopic('gateway_dlq')      // → false (primary topic; see Frozen Decision 7)
 */
export function isDlqTopic(topic: string): boolean {
  return topic.endsWith(OUTBOX_DLQ_SUFFIX);
}
