import { describe, expect, it } from 'vitest';

import {
  PLAYGROUND_LIMITS,
  PlaygroundSessionRegistry,
} from './community-playground.registry';

function session(overrides: Partial<{ workspaceId: string; ip: string }> = {}) {
  return {
    workspaceId: 'ws-1',
    userId: 'u-1',
    roleId: 'r-1',
    ip: '1.1.1.1',
    lastActiveAt: new Date(),
    executions: 0,
    decisions: 0,
    ...overrides,
  };
}

describe('PlaygroundSessionRegistry (AC-2.3)', () => {
  it('limits session creation per IP per rolling hour', () => {
    const registry = new PlaygroundSessionRegistry();
    for (let i = 0; i < PLAYGROUND_LIMITS.sessionsPerIpPerHour; i++) {
      expect(() => registry.assertSessionAllowed('1.1.1.1')).not.toThrow();
      registry.register(session({ workspaceId: `ws-${i}` }));
    }
    expect(() => registry.assertSessionAllowed('1.1.1.1')).toThrowError(
      /PLAYGROUND_SESSION_RATE_LIMIT/,
    );
    // A different IP is unaffected.
    expect(() => registry.assertSessionAllowed('2.2.2.2')).not.toThrow();
  });

  it('caps concurrent sessions on the instance', () => {
    const registry = new PlaygroundSessionRegistry();
    for (let i = 0; i < PLAYGROUND_LIMITS.maxConcurrentSessions; i++) {
      registry.register(session({ workspaceId: `ws-${i}`, ip: `ip-${i}` }));
    }
    expect(() => registry.assertSessionAllowed('fresh-ip')).toThrowError(
      /PLAYGROUND_CAPACITY/,
    );
  });

  it('enforces per-session and per-IP execution limits, no-op for regular workspaces', () => {
    const registry = new PlaygroundSessionRegistry();
    // Regular principals are never throttled.
    expect(() => registry.assertExecutionAllowed('normal-ws')).not.toThrow();

    registry.register(session());
    for (let i = 0; i < PLAYGROUND_LIMITS.executionsPerSession; i++) {
      expect(() => registry.assertExecutionAllowed('ws-1')).not.toThrow();
      registry.countExecution('ws-1');
    }
    expect(() => registry.assertExecutionAllowed('ws-1')).toThrowError(
      /PLAYGROUND_SESSION_EXECUTION_LIMIT/,
    );
  });

  it('reports idle-expired sessions for the reaper and forgets recycled ones', () => {
    const registry = new PlaygroundSessionRegistry();
    registry.register(session());
    const stale = new Date(Date.now() - (PLAYGROUND_LIMITS.ttlMinutes + 1) * 60_000);
    registry.touch('ws-1');
    // simulate aging by registering an already-old session
    registry.register({ ...session({ workspaceId: 'ws-old' }), lastActiveAt: stale });
    expect(registry.expiredWorkspaceIds()).toEqual(['ws-old']);
    registry.forget('ws-old');
    expect(registry.expiredWorkspaceIds()).toEqual([]);
    expect(registry.size).toBe(1);
  });

  it('identifies playground workspaces', () => {
    const registry = new PlaygroundSessionRegistry();
    expect(registry.isPlayground('ws-x')).toBe(false);
    registry.register(session({ workspaceId: 'ws-x' }));
    expect(registry.isPlayground('ws-x')).toBe(true);
  });
});
