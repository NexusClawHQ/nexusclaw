import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

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
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');
  new Logger('CommunityBootstrap').log(`Community backend listening on port ${port}`);
}

if (require.main === module) {
  void bootstrapCommunity();
}
