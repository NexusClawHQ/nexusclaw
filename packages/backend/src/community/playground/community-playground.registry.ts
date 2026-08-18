/**
 * In-memory playground session registry + rate limiter (spec hosted-playground
 * design §5). Zero dependencies by design; single-instance semantics are
 * documented in the README — multi-instance hosting needs external state and
 * is deliberately out of scope.
 *
 * The registry is the single source of truth for "which workspace is a live
 * playground session": resolvers consult it to narrow rate limits to
 * anonymous sessions only (regular principals are never limited here).
 */
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

export interface PlaygroundSessionInfo {
  workspaceId: string;
  userId: string;
  roleId: string;
  ip: string;
  lastActiveAt: Date;
  executions: number;
  decisions: number;
}

interface IpWindow {
  windowStart: number;
  sessions: number;
  executions: number;
}

export const PLAYGROUND_LIMITS = {
  /** Sessions per IP per rolling hour. */
  sessionsPerIpPerHour: 3,
  /** Executions per IP per rolling hour (across that IP's sessions). */
  executionsPerIpPerHour: 20,
  /** Executions per single session (approvals included as decisions). */
  executionsPerSession: 10,
  /** Max concurrently-live sessions on this instance. */
  maxConcurrentSessions: 200,
  /** Idle TTL in minutes before the reaper recycles a session. */
  ttlMinutes: 30,
} as const;

const HOUR_MS = 3_600_000;

@Injectable()
export class PlaygroundSessionRegistry {
  private readonly sessions = new Map<string, PlaygroundSessionInfo>();
  private readonly ipWindows = new Map<string, IpWindow>();

  get size(): number {
    return this.sessions.size;
  }

  isPlayground(workspaceId: string): boolean {
    return this.sessions.has(workspaceId);
  }

  touch(workspaceId: string): void {
    const session = this.sessions.get(workspaceId);
    if (session) session.lastActiveAt = new Date();
  }

  /** Hourly rolling window for an IP (lazily reset). */
  private windowFor(ip: string): IpWindow {
    const now = Date.now();
    const existing = this.ipWindows.get(ip);
    if (!existing || now - existing.windowStart >= HOUR_MS) {
      const fresh: IpWindow = { windowStart: now, sessions: 0, executions: 0 };
      this.ipWindows.set(ip, fresh);
      return fresh;
    }
    return existing;
  }

  /** AC-2.3: session creation limit per IP + instance concurrency cap. */
  assertSessionAllowed(ip: string): void {
    const window = this.windowFor(ip);
    if (window.sessions >= PLAYGROUND_LIMITS.sessionsPerIpPerHour) {
      throw new HttpException(
        'PLAYGROUND_SESSION_RATE_LIMIT',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (this.sessions.size >= PLAYGROUND_LIMITS.maxConcurrentSessions) {
      throw new HttpException(
        'PLAYGROUND_CAPACITY',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  register(info: PlaygroundSessionInfo): void {
    this.windowFor(info.ip).sessions += 1;
    this.sessions.set(info.workspaceId, info);
  }

  /** AC-2.3: execution limits — per-session and per-IP hourly. No-op for
   *  non-playground workspaces (regular principals are never throttled). */
  assertExecutionAllowed(workspaceId: string): void {
    const session = this.sessions.get(workspaceId);
    if (!session) return;
    if (session.executions >= PLAYGROUND_LIMITS.executionsPerSession) {
      throw new HttpException(
        'PLAYGROUND_SESSION_EXECUTION_LIMIT',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const window = this.windowFor(session.ip);
    if (window.executions >= PLAYGROUND_LIMITS.executionsPerIpPerHour) {
      throw new HttpException(
        'PLAYGROUND_EXECUTION_RATE_LIMIT',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  countExecution(workspaceId: string): void {
    const session = this.sessions.get(workspaceId);
    if (!session) return;
    session.executions += 1;
    session.lastActiveAt = new Date();
    this.windowFor(session.ip).executions += 1;
  }

  countDecision(workspaceId: string): void {
    const session = this.sessions.get(workspaceId);
    if (session) session.lastActiveAt = new Date();
  }

  /** Idle-expired sessions (workspace ids) for the reaper. */
  expiredWorkspaceIds(now = Date.now()): string[] {
    const ttlMs = PLAYGROUND_LIMITS.ttlMinutes * 60_000;
    const expired: string[] = [];
    for (const session of this.sessions.values()) {
      if (now - session.lastActiveAt.getTime() >= ttlMs) {
        expired.push(session.workspaceId);
      }
    }
    return expired;
  }

  forget(workspaceId: string): void {
    this.sessions.delete(workspaceId);
  }

  clear(): void {
    this.sessions.clear();
    this.ipWindows.clear();
  }
}
