/** Plain-Error permission exceptions (product wraps these as HttpException). */

export class AgentNotConfiguredException extends Error {
  constructor(agentId: string) {
    super(`Agent permission extension not configured for agent: ${agentId}`);
    this.name = 'AgentNotConfiguredException';
  }
}

export class RateLimitExceededException extends Error {
  constructor(agentId: string, limitType: 'query' | 'write', currentCount: number, limit: number) {
    super(`Agent ${agentId} exceeded ${limitType} rate limit: ${currentCount}/${limit} per minute`);
    this.name = 'RateLimitExceededException';
  }
}

export class OutsideActiveHoursException extends Error {
  constructor(agentId: string, timezone: string) {
    super(`Agent ${agentId} is outside active hours (timezone: ${timezone})`);
    this.name = 'OutsideActiveHoursException';
  }
}

export class ToolAccessDeniedException extends Error {
  constructor(agentId: string, toolName: string) {
    super(`Agent ${agentId} is not allowed to use tool: ${toolName}`);
    this.name = 'ToolAccessDeniedException';
  }
}

export class InvalidCustomFilterException extends Error {
  constructor(message: string) {
    super(`Invalid custom filter expression: ${message}`);
    this.name = 'InvalidCustomFilterException';
  }
}
