import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

const hasUserIdentifier = (value: unknown): boolean =>
  !!value &&
  typeof value === 'object' &&
  (typeof (value as { id?: unknown }).id === 'string' ||
    typeof (value as { sub?: unknown }).sub === 'string');

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    try {
      const gqlContext = GqlExecutionContext.create(context).getContext();
      if (hasUserIdentifier(gqlContext?.currentUser)) {
        return gqlContext.currentUser;
      }
      const gqlRequest = gqlContext?.req;
      if (hasUserIdentifier(gqlRequest?.user)) {
        return gqlRequest.user;
      }
    } catch {
      // Fall back to the HTTP execution context below.
    }

    const httpUser = context.switchToHttp().getRequest()?.user;
    return hasUserIdentifier(httpUser) ? httpUser : undefined;
  },
);
