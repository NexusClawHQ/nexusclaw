/**
 * Opt-in planning phase (spec ⑤). A pure builder for the planning prompt, kept
 * separate so it is unit-testable without the executor's full DI graph. The
 * planning call only asks the model to decompose the task into steps — it calls
 * no tools, so it adds no guardrail/approval surface. The resulting plan text is
 * prepended to the agent prompt before the unchanged, fully-guarded ReAct loop.
 */
export interface PlanMessage {
  role: string;
  content: string;
}

export function buildPlanMessages(rawInput: string, agentPrompt?: string): PlanMessage[] {
  const persona = agentPrompt ? `${agentPrompt}\n\n` : '';
  return [
    {
      role: 'system',
      content:
        `${persona}你现在处于"规划阶段"。把用户请求拆解成一个简洁的执行计划：` +
        '3-6 个步骤，每步一行、以"步骤N."开头。' +
        '只输出计划本身，不要执行任何操作、不要调用工具、不要给出最终答案。',
    },
    { role: 'user', content: rawInput ?? '' },
  ];
}
