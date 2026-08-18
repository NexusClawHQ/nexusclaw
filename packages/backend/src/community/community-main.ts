import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { Logger, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import express from 'express';

import { createRequestContextMiddleware } from '../common/request-context/request-context';
import { CommunityAppModule } from './community-app.module';
import { assertCommunityCompositionReady } from './community-composition-readiness';
import { assertCommunitySourceUrl } from './source-disclosure/community-source-disclosure.module';

export async function bootstrapCommunity(): Promise<void> {
  assertCommunityCompositionReady();
  assertCommunitySourceUrl(process.env.COMMUNITY_SOURCE_URL, process.env.NODE_ENV);
  const app = await NestFactory.create(CommunityAppModule);
  // Public mutations reach OutboxService.enqueue, which requires a bound
  // RequestTraceContext; mirror the middleware the private main.ts mounts.
  app.use(createRequestContextMiddleware());
  mountShowcaseDashboard(app);
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');
  new Logger('CommunityBootstrap').log(`Community backend listening on port ${port}`);
}

/**
 * Serve the built product-showcase dashboard at /app (spec
 * product-showcase-dashboard AC-8.1). Zero new dependencies: express.static
 * over the dashboard build output. The dist path is overridable for compose
 * images (COMMUNITY_DASHBOARD_DIST); when no build exists (backend-only dev
 * runs) the mount is skipped with a log — /console stays authoritative.
 */
function mountShowcaseDashboard(app: INestApplication): void {
  // dist/community/community-main.js → packages/<dashboard>/dist
  const defaultDist = join(__dirname, '../../../dashboard/dist');
  const dist = process.env.COMMUNITY_DASHBOARD_DIST ?? defaultDist;
  if (!existsSync(join(dist, 'index.html'))) {
    new Logger('CommunityBootstrap').log(
      'Showcase dashboard build not found — /app disabled (run npm run build -w @nexusclaw/dashboard or set COMMUNITY_DASHBOARD_DIST)',
    );
    return;
  }
  const instance = app.getHttpAdapter().getInstance();
  if (typeof instance?.use !== 'function') {
    new Logger('CommunityBootstrap').warn('HTTP adapter does not support static mounts — /app disabled');
    return;
  }
  instance.use('/app', express.static(dist));
  new Logger('CommunityBootstrap').log(`Showcase dashboard served at /app (${dist})`);
}

if (require.main === module) {
  void bootstrapCommunity();
}
