import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommunityAuthModule } from './auth/community-auth.module';
import { COMMUNITY_ENTITY_MANIFEST } from './community-entity-manifest';
import { COMMUNITY_MIGRATION_MANIFEST } from './community-migration-manifest';
import { CommunityMetadataRuntimeModule } from './metadata-runtime/community-metadata-runtime.module';
import { CommunityAgentRuntimeModule } from './runtime/community-agent-runtime.module';
import { CommunitySourceDisclosureModule } from './source-disclosure/community-source-disclosure.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
    }),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      playground: false,
      introspection: true,
      context: ({ req, res }: { req: unknown; res: unknown }) => ({ req, res }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        host: config.get<string>('DATABASE_HOST', 'postgres'),
        port: config.get<number>('DATABASE_PORT', 5432),
        username: config.get<string>('DATABASE_USER', 'postgres'),
        password: config.get<string>('DATABASE_PASSWORD', 'postgres'),
        database: config.get<string>('DATABASE_NAME', 'nexusclaw_community'),
        entities: [...COMMUNITY_ENTITY_MANIFEST],
        migrations: [...COMMUNITY_MIGRATION_MANIFEST],
        migrationsRun: true,
        synchronize: false,
      }),
    }),
    CommunityAuthModule,
    CommunityMetadataRuntimeModule,
    CommunityAgentRuntimeModule,
    CommunitySourceDisclosureModule,
  ],
})
export class CommunityAppModule {}
