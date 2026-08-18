/**
 * Playground HTTP surface (spec hosted-playground design §6–§7).
 *
 * GET  /playground         — the zero-dependency landing page (PLAYGROUND_PROFILE only)
 * POST /playground/session — create an ephemeral governed session
 *
 * The controller is always registered; both routes 404 unless
 * PLAYGROUND_PROFILE=true, so one image carries both personalities.
 * The client IP drives the per-IP rate limits (registry §5) — behind a proxy
 * the deployer is responsible for trusted X-Forwarded-For handling.
 */
import { Body, Controller, Get, HttpCode, Ip, NotFoundException, Post } from '@nestjs/common';

import { PlaygroundSessionService } from './community-playground-session.service';
import { PLAYGROUND_PAGE_HTML } from '../closed-loop/community-playground.page';

@Controller('playground')
export class PlaygroundController {
  constructor(private readonly sessions: PlaygroundSessionService) {}

  private enabled(): boolean {
    return (process.env.PLAYGROUND_PROFILE ?? '').toLowerCase() === 'true';
  }

  @Get()
  page(): string {
    this.sessions.assertEnabled(this.enabled());
    return PLAYGROUND_PAGE_HTML;
  }

  @Post('session')
  @HttpCode(201)
  create(@Body() _body: unknown, @Ip() ip: string): Promise<{
    token: string;
    expiresAt: Date;
    agentId: string;
    workspaceId: string;
  }> {
    this.sessions.assertEnabled(this.enabled());
    return this.sessions.createSession(ip || 'unknown');
  }
}
