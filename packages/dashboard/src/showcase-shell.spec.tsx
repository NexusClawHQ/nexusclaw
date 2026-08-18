// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { testingDictionaries } from './i18n';

const TOKEN_KEY = 'nexusclaw.dashboard.token';

const stats = {
  totalExecutions: 2,
  successRate: 0.5,
  approvalRate: 1,
  l3EscalationCount: 2,
  avgDurationMs: 4_000,
};

function graphqlBody(query: string): unknown {
  if (query.includes('communityModelSource')) {
    return { communityModelSource: { kind: 'deterministic_smoke', modelId: 'community-deterministic-smoke-v1', providerKind: 'community-local' } };
  }
  if (query.includes('communityAgents')) {
    return {
      communityAgents: [
        { id: 'a1', name: 'Follow-up Assistant', status: 'active', description: 'demo', stats },
      ],
    };
  }
  if (query.includes('communityAgentDetail')) {
    return {
      communityAgentDetail: {
        id: 'a1',
        name: 'Follow-up Assistant',
        status: 'active',
        apiName: 'demo_followup_assistant',
        agentType: 'custom',
        version: 1,
        updatedAt: '2026-08-16T10:00:00Z',
        description: 'demo employee',
        prompt: 'governed prompt',
        guardrailRules: {
          allowedTools: ['demo.customer_lookup', 'demo.send_followup_email'],
          execution: { maxReActIterations: 4, timeoutMs: 60000 },
          sensitiveOps: [
            { toolPattern: 'demo.customer_lookup', operation: 'customer_lookup', riskLevel: 'L1', action: 'audit', description: 'lookup' },
            { toolPattern: 'demo.send_followup_email', operation: 'send_followup_email', riskLevel: 'L3', action: 'approve', description: 'send' },
          ],
        },
        recentExecutions: [],
        growthTimeline: [],
        stats,
      },
    };
  }
  if (query.includes('communityAgentGrowthTimeline')) {
    return {
      communityAgentGrowthTimeline: [
        { kind: 'coaching', decision: 'REJECTED', comment: 'Tone too pushy.', executionId: 'e1', at: '2026-08-17T10:00:00Z', actorName: 'R' },
        { kind: 'escalation', executionId: 'e1', at: '2026-08-17T09:59:00Z' },
        { kind: 'milestone', executionId: 'e1', at: '2026-08-17T10:01:00Z', status: 'cancelled' },
      ],
    };
  }
  if (query.includes('communityApprovalHistory')) {
    return {
      communityApprovalHistory: [
        { id: 'ap1', executionId: 'e1', decision: 'APPROVED', toolName: 'demo.send_followup_email', riskLevel: 'L3', comment: 'Send it.', actorName: 'R', decidedAt: '2026-08-17T10:05:00Z', submittedAt: '2026-08-17T10:00:00Z' },
        { id: 'ap2', executionId: 'e2', decision: 'REJECTED', toolName: 'demo.send_followup_email', riskLevel: 'L3', comment: 'Tone too pushy.', actorName: 'R', decidedAt: '2026-08-17T10:06:00Z', submittedAt: '2026-08-17T10:01:00Z' },
      ],
    };
  }
  if (query.includes('communityRecentEvents')) {
    return {
      communityRecentEvents: [
        { id: 'ev1', topic: 'agent.events', eventType: 'agent.execution.completed', payload: { executionId: 'e1' }, createdAt: '2026-08-17T10:07:00Z' },
        { id: 'ev2', topic: 'agent.events', eventType: 'agent.execution.paused', payload: { executionId: 'e1', riskLevel: 'L3' }, createdAt: '2026-08-17T10:01:00Z' },
      ],
    };
  }
  return {
    communityAgentExecutions: [
      { id: 'e1', agentId: 'a1', status: 'done', rawInput: 'follow up with C-1001', outputSummary: null, createdAt: '2026-08-17T10:07:00Z', completedAt: '2026-08-17T10:07:30Z', durationMs: 30000, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0 },
      { id: 'e2', agentId: 'a1', status: 'guardrail_pending', rawInput: 'send quarterly check-in', outputSummary: null, createdAt: '2026-08-17T10:01:00Z', completedAt: null, durationMs: null, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0 },
    ],
    communityPendingApprovals: [],
  };
}

function stubGraphql() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/source')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            license: 'Apache-2.0',
            licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
            correspondingSourceUrl: 'https://github.com/NexusClawHQ/nexusclaw-agent-governance',
          }),
        } as Response;
      }
      const body = JSON.parse(String(init?.body ?? '{}')) as { query: string };
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: graphqlBody(body.query) }),
      } as Response;
    }),
  );
}

describe('showcase shell (spec product-showcase-dashboard)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.location.hash = '';
    window.sessionStorage.setItem(TOKEN_KEY, 'session-token');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders every showcase section in the side navigation', async () => {
    stubGraphql();
    render(<App />);
    await waitFor(() => expect(screen.getAllByText('Overview').length).toBeGreaterThan(0));
    for (const label of [
      'Governance insights',
      'Digital employees',
      'Run',
      'Approvals',
      'Audit chain',
      'Training & growth',
      'Approval history',
      'Event stream',
      'Governance policy',
      'Source & compliance',
      'Developers',
      'Visual builder',
      'Deep growth loop',
      'Model routing',
      'Customer 360',
      'Sales processes',
      'Analytics',
      'Integrations',
      'Enterprise modules',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('routes #/growth to the employee list, then opens a training timeline', async () => {
    window.location.hash = '#/growth';
    stubGraphql();
    render(<App />);
    // Step 1 — the employee list, not a timeline yet.
    await waitFor(() =>
      expect(screen.getAllByText('Follow-up Assistant').length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(/Coaching/)).toBeNull();
    // Step 2 — open the employee's training timeline.
    screen.getAllByText('Follow-up Assistant')[0].click();
    await waitFor(() =>
      expect(screen.getAllByText(/Coaching/).length).toBeGreaterThan(0),
    );
    expect(screen.getByText('L3 escalation')).toBeTruthy();
    expect(screen.getByText('Tone too pushy.')).toBeTruthy();
  });

  it('routes #/employees/<id> to the profile view with editable config', async () => {
    window.location.hash = '#/employees/a1';
    stubGraphql();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByDisplayValue('governed prompt')).toBeTruthy(),
    );
    expect(screen.getAllByText('demo.customer_lookup').length).toBeGreaterThan(0);
    expect(screen.getByText('Tool allow-list')).toBeTruthy();
    expect(screen.getByText('Sensitive-op rules')).toBeTruthy();
    expect(screen.getByText('Autonomy · risk levels')).toBeTruthy();
    expect(screen.getByText('Save configuration')).toBeTruthy();
  });

  it('routes #/employees/new to the new-employee form', async () => {
    window.location.hash = '#/employees/new';
    stubGraphql();
    render(<App />);
    await waitFor(() => expect(screen.getByText('New digital employee')).toBeTruthy());
    expect(screen.getByText('Create employee')).toBeTruthy();
    expect(screen.getByPlaceholderText('unique id, e.g. support_assistant')).toBeTruthy();
  });

  it('routes #/insights to the governance insights view with trend charts', async () => {
    window.location.hash = '#/insights';
    stubGraphql();
    render(<App />);
    await waitFor(() => expect(screen.getByText('Executions, last 7 days')).toBeTruthy());
    expect(screen.getByText('Execution status distribution')).toBeTruthy();
    expect(screen.getByText('Follow-up Assistant')).toBeTruthy();
  });

  it('routes #/history to the approval history view with decisions', async () => {
    window.location.hash = '#/history';
    stubGraphql();
    render(<App />);
    await waitFor(() => expect(screen.getByText('Approved')).toBeTruthy());
    expect(screen.getByText((content) => content.includes('Tone too pushy.'))).toBeTruthy();
  });

  it('routes #/events to the cross-execution event stream', async () => {
    window.location.hash = '#/events';
    stubGraphql();
    render(<App />);
    await waitFor(() =>
      expect(screen.getAllByText('agent.execution.completed').length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText('agent.execution.paused').length).toBeGreaterThan(0);
  });

  it('routes #/source to the source-transparency view', async () => {
    window.location.hash = '#/source';
    stubGraphql();
    render(<App />);
    await waitFor(() =>
      expect(
        screen.getAllByText((content) => content.includes('Apache-2.0')).length,
      ).toBeGreaterThan(0),
    );
    expect(
      screen.getByText('https://github.com/NexusClawHQ/nexusclaw-agent-governance'),
    ).toBeTruthy();
  });

  it('routes #/product/<module> to the commercial placeholder, restrained', async () => {
    window.location.hash = '#/product/modelRouting';
    stubGraphql();
    render(<App />);
    await waitFor(() =>
      expect(
        screen.getAllByText((content) => content.includes('Part of the commercial edition'))
          .length,
      ).toBeGreaterThan(0),
    );
  });
});

describe('i18n parity (AC-9.5)', () => {
  it('zh and en dictionaries carry identical key sets', () => {
    expect(Object.keys(testingDictionaries.en).sort()).toEqual(
      Object.keys(testingDictionaries.zh).sort(),
    );
  });
});
