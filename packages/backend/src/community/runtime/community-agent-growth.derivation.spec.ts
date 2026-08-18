import { describe, expect, it } from 'vitest';

import {
  deriveAgentStats,
  deriveGrowthTimeline,
  parsePausedToolSnapshot,
  type GrowthApprovalInput,
  type GrowthExecutionInput,
} from './community-agent-growth.derivation';

const MARKER = '__pausedToolCall__:';

function execution(
  overrides: Partial<GrowthExecutionInput>,
): GrowthExecutionInput {
  return {
    id: 'exec-1',
    status: 'done',
    createdAt: new Date('2026-08-10T10:00:00Z'),
    completedAt: new Date('2026-08-10T10:00:05Z'),
    durationMs: 5_000,
    ...overrides,
  };
}

function approval(
  overrides: Partial<GrowthApprovalInput> & {
    history?: GrowthApprovalInput['history'];
  },
): GrowthApprovalInput {
  return {
    recordId: 'exec-1',
    status: 'REJECTED',
    submittedAt: new Date('2026-08-10T10:00:03Z'),
    pausedToolName: 'demo.send_followup_email',
    pausedRiskLevel: 'L3',
    history: [
      {
        action: 'SUBMITTED',
        actorName: 'executor',
        comments:
          MARKER +
          JSON.stringify({
            toolName: 'demo.send_followup_email',
            riskLevel: 'L3',
          }),
        timestamp: '2026-08-10T10:00:03.000Z',
      },
      {
        action: 'REJECTED',
        actorName: 'Reviewer One',
        comments: 'Tone was too pushy — ask before offering a discount.',
        timestamp: '2026-08-10T10:01:00.000Z',
      },
    ],
    ...overrides,
  };
}

describe('deriveGrowthTimeline (AC-6.1 / AC-6.2)', () => {
  it('derives milestone + escalation + coaching entries, newest first', () => {
    const entries = deriveGrowthTimeline([execution({})], [approval({})]);

    expect(entries.map((entry) => entry.kind).sort()).toEqual([
      'coaching',
      'escalation',
      'milestone',
    ]);
    // Newest first: coaching decision (10:01) → milestone (10:00:05) →
    // escalation (10:00:03).
    expect(entries[0].kind).toBe('coaching');
    expect(entries[0].decision).toBe('REJECTED');
    expect(entries[0].comment).toBe(
      'Tone was too pushy — ask before offering a discount.',
    );
    expect(entries[0].actorName).toBe('Reviewer One');
    expect(entries[0].toolName).toBe('demo.send_followup_email');
    expect(entries[0].riskLevel).toBe('L3');
    expect(entries[1].kind).toBe('milestone');
    expect(entries[2].kind).toBe('escalation');
    // Every entry links back to the execution it was derived from.
    for (const entry of entries) expect(entry.executionId).toBe('exec-1');
  });

  it('returns an empty array for an agent without executions', () => {
    expect(deriveGrowthTimeline([], [])).toEqual([]);
  });

  it('keys approval-derived entries to their own execution record', () => {
    const entries = deriveGrowthTimeline(
      [execution({ id: 'exec-1' })],
      [approval({ recordId: 'other-exec' })],
    );
    // The service layer scopes approvals to the agent's executions; the
    // derivation only guarantees the linkage is preserved.
    const approvalEntries = entries.filter((entry) => entry.executionId === 'other-exec');
    expect(approvalEntries.every((entry) => entry.kind !== 'milestone')).toBe(true);
  });

  it('whitespace-only coaching comments become null, not fake notes', () => {
    const entries = deriveGrowthTimeline(
      [execution({})],
      [
        approval({
          history: [
            {
              action: 'APPROVED',
              actorName: 'R',
              comments: '   ',
              timestamp: '2026-08-10T10:01:00.000Z',
            },
          ],
        }),
      ],
    );
    const coaching = entries.find((entry) => entry.kind === 'coaching');
    expect(coaching?.comment).toBeNull();
  });
});

describe('deriveAgentStats (AC-6.4)', () => {
  it('reports null rates without samples — never fabricated zeros', () => {
    const stats = deriveAgentStats([], []);
    expect(stats.totalExecutions).toBe(0);
    expect(stats.successRate).toBeNull();
    expect(stats.approvalRate).toBeNull();
    expect(stats.avgDurationMs).toBeNull();
  });

  it('computes success / approval rates and average duration from real rows', () => {
    const stats = deriveAgentStats(
      [
        execution({ id: 'e1', status: 'done', durationMs: 4_000 }),
        execution({ id: 'e2', status: 'failed', durationMs: 2_000 }),
        execution({ id: 'e3', status: 'cancelled', durationMs: null }),
      ],
      [
        approval({ recordId: 'e1', status: 'APPROVED' }),
        approval({ recordId: 'e2', status: 'REJECTED' }),
      ],
    );
    expect(stats.totalExecutions).toBe(3);
    expect(stats.successRate).toBeCloseTo(1 / 3);
    expect(stats.approvalRate).toBeCloseTo(0.5);
    expect(stats.l3EscalationCount).toBe(2);
    expect(stats.avgDurationMs).toBe(3_000);
  });
});

describe('parsePausedToolSnapshot', () => {
  it('extracts tool name and risk level from the SUBMITTED marker', () => {
    const parsed = parsePausedToolSnapshot(
      approval({}).history as { action?: string; comments?: string | null }[],
      MARKER,
    );
    expect(parsed).toEqual({
      toolName: 'demo.send_followup_email',
      riskLevel: 'L3',
    });
  });

  it('returns nulls on malformed markers instead of throwing', () => {
    expect(
      parsePausedToolSnapshot([{ comments: MARKER + '{not-json' }], MARKER),
    ).toEqual({ toolName: null, riskLevel: null });
  });
});
