import type { ResolvedAgentExecutableToolV1 } from '@nexusclaw/shared/agent-executable-assets';

export const CODE_ACTION_MAX_EXECUTION_MS = 60_000;
export const VERIFIED_ISOLATE_STARTUP_GRACE_MS = 60_000;
export const CODE_ACTION_COMPLETION_SETTLEMENT_GRACE_MS = 30_000;

export function deriveCodeActionExecutionBudgetMs(
  tool: ResolvedAgentExecutableToolV1,
  requestedTimeoutMs: number,
): number {
  return Math.max(
    1,
    Math.min(
      requestedTimeoutMs,
      tool.exportDescriptor.limits.timeoutMs,
      CODE_ACTION_MAX_EXECUTION_MS,
    ),
  );
}

export function deriveCodeActionLifecycleLeaseMs(
  tool: ResolvedAgentExecutableToolV1,
  requestedTimeoutMs: number,
): number {
  return (
    VERIFIED_ISOLATE_STARTUP_GRACE_MS
    + deriveCodeActionExecutionBudgetMs(tool, requestedTimeoutMs)
    + CODE_ACTION_COMPLETION_SETTLEMENT_GRACE_MS
  );
}
