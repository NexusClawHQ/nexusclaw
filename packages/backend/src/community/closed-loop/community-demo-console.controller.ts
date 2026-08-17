import { Controller, Get, Header } from '@nestjs/common';

import { COMMUNITY_DEMO_CONSOLE_HTML } from './community-demo-console.page';

/**
 * Serves the static Community demo console at GET /console.
 *
 * The page is an in-code constant (not a host filesystem read — the
 * Community filesystem allowlist stays empty). All data access goes through
 * the guarded GraphQL API with a signed-in demo principal.
 */
@Controller('console')
export class CommunityDemoConsoleController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  serve(): string {
    return COMMUNITY_DEMO_CONSOLE_HTML;
  }
}
