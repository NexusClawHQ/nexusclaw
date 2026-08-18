/**
 * Playground session reaper (spec hosted-playground design §5).
 *
 * setInterval-based (zero new dependencies — @nestjs/schedule is not in the
 * tree). Every 5 minutes: recycle idle-expired sessions; on boot: sweep all
 * leftover playground workspaces (sessions never survive restarts).
 */
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';

import { PlaygroundSessionService } from './community-playground-session.service';
import { PlaygroundSessionRegistry } from './community-playground.registry';

const SWEEP_INTERVAL_MS = 5 * 60_000;

@Injectable()
export class PlaygroundSessionReaper implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PlaygroundSessionReaper.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly registry: PlaygroundSessionRegistry,
    private readonly sessions: PlaygroundSessionService,
  ) {}

  onApplicationBootstrap(): void {
    void this.sessions
      .sweepOrphans()
      .then((swept) => {
        if (swept > 0) {
          this.logger.log(`Startup sweep recycled ${swept} orphan playground session(s)`);
        }
      })
      .catch((error: unknown) => {
        this.logger.error(`Playground startup sweep failed: ${(error as Error)?.message}`);
      });
    this.timer = setInterval(() => void this.tick(), SWEEP_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    const expired = this.registry.expiredWorkspaceIds();
    for (const workspaceId of expired) {
      try {
        await this.sessions.recycleWorkspace(workspaceId);
      } catch (error) {
        this.logger.warn(
          `Failed to recycle playground session ${workspaceId}: ${(error as Error)?.message}`,
        );
      }
    }
  }
}
