import type { AgentTool, ToolCallResult } from '@agent-governance/contracts';

/**
 * Tool registry: the deny-by-default execution gate. A tool runs only when
 * it is registered AND the execution context grants it (the executor checks
 * the allow-list before calling here).
 */
export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>();

  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  registerAll(tools: AgentTool[]): void {
    for (const tool of tools) this.register(tool);
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  list(): AgentTool[] {
    return [...this.tools.values()];
  }

  /** Execute with schema-validated input. Unknown tools fail closed. */
  async execute(
    name: string,
    input: unknown,
    context: { constraints: { allowedTools: string[] } },
  ): Promise<ToolCallResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        output: null,
        error: `Tool not found: ${name}`,
        permissionCheck: 'denied',
        guardrailCheck: 'blocked',
        duration: 0,
      };
    }
    if (!context.constraints.allowedTools.includes(name)) {
      return {
        success: false,
        output: null,
        error: `TOOL_NOT_ALLOWED:${name}`,
        permissionCheck: 'denied',
        guardrailCheck: 'blocked',
        duration: 0,
      };
    }
    const startedAt = Date.now();
    try {
      const result = await tool.execute(input, context as never);
      return { ...result, duration: result.duration ?? Date.now() - startedAt };
    } catch (error) {
      return {
        success: false,
        output: null,
        error: (error as Error)?.message ?? String(error),
        permissionCheck: 'passed',
        guardrailCheck: 'passed',
        duration: Date.now() - startedAt,
      };
    }
  }
}
