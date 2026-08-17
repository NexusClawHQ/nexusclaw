// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

const TOKEN_KEY = 'nexusclaw.dashboard.token';

const okSession = {
  status: 200,
  json: async () => ({
    data: {
      communityAgents: [{ id: 'a1', name: 'Agent', status: 'active' }],
      communityAgentExecutions: [],
      communityPendingApprovals: [],
    },
  }),
};

const unauthorized = { status: 401, json: async () => ({}) };

const networkFailure = () => Promise.reject(new TypeError('Failed to fetch'));

describe('App shell resilience', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the sign-in view when no session exists', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({} as Response)),
    );
    render(<App />);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('surfaces a feed error with retry when the backend is unreachable', async () => {
    window.sessionStorage.setItem(TOKEN_KEY, 'session-token');
    vi.stubGlobal('fetch', vi.fn(() => networkFailure()));

    render(<App />);
    await waitFor(
      () => expect(screen.getByRole('alert')).toBeTruthy(),
      { timeout: 5000 },
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('clears the feed error once polling succeeds again', async () => {
    window.sessionStorage.setItem(TOKEN_KEY, 'session-token');
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
    fetchMock.mockReturnValueOnce(networkFailure());
    fetchMock.mockImplementation(async () => okSession as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy(), {
      timeout: 5000,
    });
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull(), {
      timeout: 8000,
    });
  });

  it('drops the session back to sign-in when the API answers 401', async () => {
    window.sessionStorage.setItem(TOKEN_KEY, 'expired-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => unauthorized as unknown as Response),
    );

    render(<App />);
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy(),
      { timeout: 5000 },
    );
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
