import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  decideApproval,
  fetchExecutions,
  GraphQLError,
  signIn,
  UnauthorizedError,
} from './api';

const fetchMock = vi.fn();
const EMPTY_RESPONSE = 'empty graphql response';

const jsonResponse = (body: unknown, status = 200) => ({
  status,
  json: async () => body,
});

const callInit = (): RequestInit =>
  (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];

describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('sends GraphQL POSTs without auth when no token is given', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: { communitySignIn: { token: 't', expiresAt: 'soon' } },
      }),
    );
    await signIn('demo', 'nexusclaw-demo');
    const init = callInit();
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
  });

  it('attaches the Bearer token for authenticated calls', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { communityAgentExecutions: [] } }),
    );
    await fetchExecutions('token-1');
    expect(callInit().headers).toMatchObject({
      authorization: 'Bearer token-1',
    });
  });

  it('maps HTTP 401 to UnauthorizedError so the app can drop the session', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 401));
    await expect(fetchExecutions('expired')).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('surfaces the first GraphQL error message', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        errors: [{ message: 'first' }, { message: 'second' }],
      }),
    );
    await expect(
      decideApproval('t', 'i', 'APPROVED', null),
    ).rejects.toThrow(GraphQLError);
    await expect(decideApproval('t', 'i', 'APPROVED', null)).rejects.toThrow(
      'first',
    );
  });

  it('rejects responses that carry neither data nor errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await expect(fetchExecutions('t')).rejects.toThrow(EMPTY_RESPONSE);
  });
});
