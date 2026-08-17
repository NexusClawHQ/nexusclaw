/**
 * Frozen ToolCall status enum (design §11.4 line 1539). Sole writer is the
 * tool-call lifecycle service; every terminal/escalation state is CAS-updated
 * on the same row.
 */
export enum ToolCallStatus {
  STARTED = 'STARTED',
  DENIED = 'DENIED',
  BLOCKED = 'BLOCKED',
  REQUIRES_APPROVAL = 'REQUIRES_APPROVAL',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  COMPLETION_UNKNOWN = 'COMPLETION_UNKNOWN',
}
