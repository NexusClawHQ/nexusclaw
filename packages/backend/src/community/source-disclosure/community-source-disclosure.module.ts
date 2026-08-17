import {
  Controller,
  Get,
  Header,
  Injectable,
  MiddlewareConsumer,
  Module,
  NestMiddleware,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const COMMUNITY_SOURCE_URL_REQUIRED =
  'COMMUNITY_SOURCE_URL_REQUIRED' as const;
export const COMMUNITY_SOURCE_URL_INVALID =
  'COMMUNITY_SOURCE_URL_INVALID' as const;

export function assertCommunitySourceUrl(
  value: string | undefined,
  nodeEnv = 'production',
): string {
  if (!value || value.includes('replace-with-')) {
    throw new Error(COMMUNITY_SOURCE_URL_REQUIRED);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(COMMUNITY_SOURCE_URL_INVALID);
  }
  const localDevelopment =
    nodeEnv !== 'production' &&
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !localDevelopment) ||
      url.username || url.password || url.hash) {
    throw new Error(COMMUNITY_SOURCE_URL_INVALID);
  }
  return url.toString();
}

@Injectable()
export class CommunitySourceDisclosureMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(
    _request: unknown,
    response: { setHeader(name: string, value: string): void },
    next: () => void,
  ): void {
    const sourceUrl = assertCommunitySourceUrl(
      this.config.get<string>('COMMUNITY_SOURCE_URL'),
      this.config.get<string>('NODE_ENV', 'production'),
    );
    response.setHeader(
      'Link',
      `<${sourceUrl}>; rel="alternate"; title="Corresponding Source"`,
    );
    response.setHeader('X-NexusClaw-Corresponding-Source', sourceUrl);
    next();
  }
}

@Controller('source')
export class CommunitySourceDisclosureController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=300')
  getSourceDisclosure(): {
    license: 'Apache-2.0';
    licenseUrl: string;
    correspondingSourceUrl: string;
  } {
    return {
      license: 'Apache-2.0',
      licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
      correspondingSourceUrl: assertCommunitySourceUrl(
        this.config.get<string>('COMMUNITY_SOURCE_URL'),
        this.config.get<string>('NODE_ENV', 'production'),
      ),
    };
  }
}

@Module({
  controllers: [CommunitySourceDisclosureController],
  providers: [CommunitySourceDisclosureMiddleware],
})
export class CommunitySourceDisclosureModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CommunitySourceDisclosureMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
