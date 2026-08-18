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
  return { communityAgentExecutions: [], communityPendingApprovals: [] };
}

function stubGraphql() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
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
      'Digital employees',
      'Run',
      'Approvals',
      'Audit chain',
      'Training & growth',
      'Governance policy',
      'Full product',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('routes #/growth to the training & growth view and renders the timeline', async () => {
    window.location.hash = '#/growth';
    stubGraphql();
    render(<App />);
    await waitFor(() =>
      expect(screen.getAllByText(/Coaching/).length).toBeGreaterThan(0),
    );
    expect(screen.getByText('L3 escalation')).toBeTruthy();
    expect(screen.getByText('Tone too pushy.')).toBeTruthy();
  });

  it('routes #/employees/<id> to the profile view with guardrail rules', async () => {
    window.location.hash = '#/employees/a1';
    stubGraphql();
    render(<App />);
    await waitFor(() => expect(screen.getByText('governed prompt')).toBeTruthy());
    expect(screen.getAllByText('demo.customer_lookup').length).toBeGreaterThan(0);
    expect(screen.getByText('Capabilities · tools')).toBeTruthy();
    expect(screen.getByText('Autonomy · risk levels')).toBeTruthy();
  });

  it('shows the product console with commercial modules opening a dialog on click', async () => {
    window.location.hash = '#/product';
    stubGraphql();
    render(<App />);
    await waitFor(() => expect(screen.getAllByText('Commercial').length).toBe(8));
    await waitFor(() => expect(screen.getAllByText('In this repo').length).toBe(6));
    // Clicking a commercial module opens the commercial-edition dialog.
    screen.getAllByText('Visual builder')[0].click();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(screen.getAllByText(/design employees and flows without code/i).length).toBe(2);
    expect(screen.getByRole('dialog').textContent).toContain('Commercial-edition capability');
  });
});

describe('i18n parity (AC-9.5)', () => {
  it('zh and en dictionaries carry identical key sets', () => {
    expect(Object.keys(testingDictionaries.en).sort()).toEqual(
      Object.keys(testingDictionaries.zh).sort(),
    );
  });
});
