import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../modules/user/entities/user.entity';
import { WorkspaceMember } from '../../modules/workspace/entities/workspace-member.entity';
import { CommunityAuthResolver } from './community-auth.resolver';
import { CommunityAuthService } from './community-auth.service';
import { CommunityGqlAuthGuard } from './community-gql-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, WorkspaceMember]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < 32) {
          throw new Error('COMMUNITY_JWT_SECRET_REQUIRED_MIN_32');
        }
        return {
          secret,
          signOptions: { algorithm: 'HS256' as const },
          verifyOptions: { algorithms: ['HS256' as const] },
        };
      },
    }),
  ],
  providers: [CommunityAuthService, CommunityGqlAuthGuard, CommunityAuthResolver],
  exports: [CommunityAuthService, CommunityGqlAuthGuard],
})
export class CommunityAuthModule {}
