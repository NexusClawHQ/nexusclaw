import { Args, Field, Mutation, ObjectType, Resolver } from '@nestjs/graphql';

import { CommunityAuthService } from './community-auth.service';

@ObjectType('CommunityAuthSession')
export class CommunityAuthSession {
  @Field() token: string;
  @Field() userId: string;
  @Field() workspaceId: string;
  @Field() expiresAt: Date;
}

@Resolver()
export class CommunityAuthResolver {
  constructor(private readonly auth: CommunityAuthService) {}

  @Mutation(() => CommunityAuthSession, { name: 'communitySignIn' })
  signIn(
    @Args('username') username: string,
    @Args('password') password: string,
  ): Promise<CommunityAuthSession> {
    return this.auth.signIn(username, password);
  }
}
