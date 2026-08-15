import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { CommunityAuthService } from './community-auth.service';

@Injectable()
export class CommunityGqlAuthGuard implements CanActivate {
  constructor(private readonly auth: CommunityAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gql = GqlExecutionContext.create(context).getContext();
    const request = gql?.req;
    const authorization = request?.headers?.authorization;
    const match = typeof authorization === 'string'
      ? authorization.match(/^Bearer\s+(.+)$/i)
      : null;
    if (!match) throw new UnauthorizedException('Bearer token is required');
    const principal = await this.auth.authenticate(match[1]);
    request.user = principal;
    request.workspace = principal.defaultWorkspaceId;
    gql.currentUser = principal;
    return true;
  }
}
