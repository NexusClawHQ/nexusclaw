import type { GovernorResource } from '../types/governor-limit.types';

export class GovernorLimitException extends Error {
  readonly code = 'GOVERNOR_LIMIT_EXCEEDED';

  constructor(
    public readonly resource: GovernorResource,
    public readonly currentValue: number,
    public readonly limitValue: number,
  ) {
    super(`Governor limit exceeded: ${resource} (${currentValue}/${limitValue})`);
    this.name = 'GovernorLimitException';
  }
}

export class GovernorLimitContextMissingException extends Error {
  readonly code = 'GOVERNOR_LIMIT_CONTEXT_MISSING';

  constructor(public readonly resource: string) {
    super(
      `Governor limit context missing when checking resource: ${resource}. ` +
        'Ensure the code path is wrapped by GovernorLimitInterceptor or runInContext().',
    );
    this.name = 'GovernorLimitContextMissingException';
  }
}
