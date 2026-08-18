/**
 * Pure derivation rules for the digital-employee growth timeline and stats
 * (spec product-showcase-dashboard design §4).
 *
 * Toolchain-independent (no entity imports): the insights service maps
 * repository rows onto these plain inputs, so the derivation itself stays
 * unit-testable without TypeORM decorator metadata.
 */

export interface GrowthExecutionInput {
  id: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
}

export interface GrowthApprovalHistoryEntryInput {
  action: string;
  actorName?: string | null;
  comments?: string | null;
  timestamp: string;
}

export interface GrowthApprovalInput {
  recordId: string;
  status: string;
  submittedAt: Date;
  history?: readonly GrowthApprovalHistoryEntryInput[] | null;
  /** Raw paused-tool snapshot parsed from the SUBMITTED comment marker. */
  pausedToolName?: string | null;
  pausedRiskLevel?: string | null;
}

export interface GrowthEntry {
  /** Stable kind code: coaching | escalation | milestone. */
  kind: 'coaching' | 'escalation' | 'milestone';
  decision?: 'APPROVED' | 'REJECTED' | null;
  comment?: string | null;
  toolName?: string | null;
  riskLevel?: string | null;
  executionId: string;
  at: Date;
  actorName?: string | null;
  status?: string | null;
}

export interface AgentStatsView {
  totalExecutions: number;
  successRate: number | null;
  approvalRate: number | null;
  l3EscalationCount: number;
  avgDurationMs: number | null;
}

/** Milestones + escalations + coaching notes, newest first. */
export function deriveGrowthTimeline(
  executions: readonly GrowthExecutionInput[],
  approvals: readonly GrowthApprovalInput[],
): GrowthEntry[] {
  const entries: GrowthEntry[] = [];

  for (const execution of executions) {
    entries.push({
      kind: 'milestone',
      executionId: execution.id,
      at: execution.completedAt ?? execution.createdAt,
      status: execution.status,
    });
  }

  for (const approval of approvals) {
    entries.push({
      kind: 'escalation',
      executionId: approval.recordId,
      toolName: approval.pausedToolName ?? null,
      riskLevel: approval.pausedRiskLevel ?? null,
      at: approval.submittedAt,
    });
    for (const entry of approval.history ?? []) {
      if (entry.action !== 'APPROVED' && entry.action !== 'REJECTED') continue;
      entries.push({
        kind: 'coaching',
        decision: entry.action,
        comment: entry.comments ? entry.comments.trim() || null : null,
        toolName: approval.pausedToolName ?? null,
        riskLevel: approval.pausedRiskLevel ?? null,
        executionId: approval.recordId,
        at: new Date(entry.timestamp),
        actorName: entry.actorName ?? null,
      });
    }
  }

  return entries.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** Audit-derived stats. Rates are null without samples — never 0. */
export function deriveAgentStats(
  executions: readonly GrowthExecutionInput[],
  approvals: readonly GrowthApprovalInput[],
): AgentStatsView {
  const total = executions.length;
  const done = executions.filter((row) => row.status === 'done').length;
  const durations = executions
    .map((row) => row.durationMs)
    .filter((value): value is number => typeof value === 'number');
  const decided = approvals.filter(
    (row) => row.status === 'APPROVED' || row.status === 'REJECTED',
  );
  const approved = decided.filter((row) => row.status === 'APPROVED').length;
  return {
    totalExecutions: total,
    successRate: total > 0 ? done / total : null,
    approvalRate: decided.length > 0 ? approved / decided.length : null,
    l3EscalationCount: approvals.length,
    avgDurationMs:
      durations.length > 0
        ? durations.reduce((sum, value) => sum + value, 0) / durations.length
        : null,
  };
}

/** Extract the paused-tool snapshot from an approval's raw history comments. */
export function parsePausedToolSnapshot(
  history: readonly {
    action?: string;
    comments?: string | null;
  }[] | null | undefined,
  marker: string,
): { toolName: string | null; riskLevel: string | null } {
  for (const entry of history ?? []) {
    const comments = entry.comments ?? '';
    const at = comments.indexOf(marker);
    if (at < 0) continue;
    try {
      const parsed = JSON.parse(comments.slice(at + marker.length)) as {
        toolName?: unknown;
        riskLevel?: unknown;
      };
      if (parsed && typeof parsed === 'object') {
        return {
          toolName: typeof parsed.toolName === 'string' ? parsed.toolName : null,
          riskLevel: typeof parsed.riskLevel === 'string' ? parsed.riskLevel : null,
        };
      }
    } catch {
      // malformed marker rows are skipped, never trusted
    }
  }
  return { toolName: null, riskLevel: null };
}
