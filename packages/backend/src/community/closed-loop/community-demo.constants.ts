/**
 * Deterministic identities for the Community demo closed loop.
 *
 * Fixed UUIDs keep the runtime seed idempotent across restarts and
 * deterministic across exports; nothing here is generated at runtime.
 */
export const COMMUNITY_DEMO_SEED_ENV = 'COMMUNITY_DEMO_SEED';

export const COMMUNITY_DEMO_WORKSPACE_ID =
  '9e100000-0000-4000-8000-000000000001';
export const COMMUNITY_DEMO_ROLE_ID =
  '9e100000-0000-4000-8000-000000000002';
export const COMMUNITY_DEMO_USER_ID =
  '9e100000-0000-4000-8000-000000000003';
export const COMMUNITY_DEMO_MEMBER_ID =
  '9e100000-0000-4000-8000-000000000004';
export const COMMUNITY_DEMO_OBJECT_METADATA_ID =
  '9e100000-0000-4000-8000-000000000005';
export const COMMUNITY_DEMO_OBJECT_PERMISSION_ID =
  '9e100000-0000-4000-8000-000000000006';
export const COMMUNITY_DEMO_AGENT_ID =
  '9e100000-0000-4000-8000-000000000007';

/** Seeded demo principal for the browser closed loop. */
export const COMMUNITY_DEMO_USERNAME = 'demo';
export const COMMUNITY_DEMO_PASSWORD = 'nexusclaw-demo';

/** Demo tool names — also the stable keys the deterministic scenario
 *  provider detects its phase from. */
export const COMMUNITY_DEMO_TOOL_LOOKUP = 'demo.customer_lookup';
export const COMMUNITY_DEMO_TOOL_SEND_EMAIL = 'demo.send_followup_email';

/** Demo Contact used by the deterministic scenario. */
export const COMMUNITY_DEMO_CUSTOMER_ID = 'C-1001';

/**
 * Result markers inside the demo tools' outputs. The deterministic scenario
 * provider derives its phase from these markers (NOT from tool names — the
 * executor enumerates every allowed tool name in the system prompt on every
 * call, so tool names cannot distinguish phases).
 */
export const COMMUNITY_DEMO_LOOKUP_RESULT_MARKER = 'demo lookup result';
export const COMMUNITY_DEMO_SEND_RESULT_MARKER = 'demo-dry-run';
