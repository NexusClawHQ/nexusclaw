import type { ResolvedAgentExecutableToolV1 } from '@nexusclaw/shared/agent-executable-assets';

import type {
  GovernedToolExecutionContextV1,
  ToolCallResult,
} from '../interfaces';

/**
 * Frozen release-aware ToolRegistry extension point (design §14.1).
 *
 * Resolution is describe-only. Execution is an independent optional internal
 * port so the public provider contract remains exactly the two frozen reads.
 */
export interface ContextualAgentToolProvider {
  readonly providerKey: 'serverless-action';
  readonly declaredToolNames?: readonly string[];
  resolveTool(
    toolName: string,
    context: GovernedToolExecutionContextV1,
  ): Promise<ResolvedAgentExecutableToolV1 | null>;
  resolveAvailableTools(
    context: GovernedToolExecutionContextV1,
  ): Promise<ResolvedAgentExecutableToolV1[]>;
}

export interface ContextualAgentToolExecutionProvider {
  executeResolvedTool(
    tool: ResolvedAgentExecutableToolV1,
    input: unknown,
    context: GovernedToolExecutionContextV1,
    invocation: Readonly<{
      toolCallId: string;
      attempt: 0;
    }>,
  ): Promise<ToolCallResult & {
    /**
     * Internal durable-completion proof. When true, the provider's registered
     * completion coordinator has already finalized FunctionExecution and this
     * ToolCall through one DataSource transaction.
     */
    readonly completionCoordinated?: true;
  }>;
}

export function supportsContextualExecution(
  provider: ContextualAgentToolProvider,
): provider is ContextualAgentToolProvider &
  ContextualAgentToolExecutionProvider {
  return (
    'executeResolvedTool' in provider &&
    typeof (provider as ContextualAgentToolExecutionProvider)
      .executeResolvedTool === 'function'
  );
}
