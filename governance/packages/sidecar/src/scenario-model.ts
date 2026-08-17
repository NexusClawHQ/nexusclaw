import type { ChatRequest, ExecutorModelPort, ModelConfig } from '@agent-governance/contracts';

export const LOOKUP_MARKER = 'demo lookup result';
export const SEND_MARKER = 'demo-dry-run';
export const TOOL_LOOKUP = 'demo.customer_lookup';
export const TOOL_SEND = 'demo.send_followup_email';

/**
 * Deterministic demo scenario model: no external LLM needed. The phase is
 * derived from result markers in the transcript (tool names are enumerated in
 * prompts, so names cannot distinguish phases):
 *   phase 1: call the L1 lookup tool (audited, proceeds)
 *   phase 2: call the L3 send tool (executor pauses for human approval)
 *   phase 3: finish with a summary (after the approved resume)
 */
export class ScenarioModel implements ExecutorModelPort {
  private readonly model: ModelConfig = {
    tier: 1,
    modelId: 'sidecar-scenario-v1',
    provider: 'sidecar-local',
    inputCostPer1k: 0,
    outputCostPer1k: 0,
    maxTokens: 4096,
    supportsStreaming: false,
  };

  async chat(request: ChatRequest) {
    const transcript = JSON.stringify(request.messages);
    const seenLookup = transcript.includes(LOOKUP_MARKER);
    const seenSend = transcript.includes(SEND_MARKER);
    const lastContent = [...request.messages]
      .reverse()
      .map((message) => ('content' in message ? message.content : ''))
      .find((content) => typeof content === 'string' && content.trim()) ?? '';
    const task = lastContent.slice(0, 160);

    const action = !seenLookup
      ? { type: 'tool_call', toolName: TOOL_LOOKUP, toolInput: { customerId: 'C-1001', objectApiName: 'Contact' } }
      : !seenSend
        ? { type: 'tool_call', toolName: TOOL_SEND, toolInput: { customerId: 'C-1001', objectApiName: 'Contact', subject: `Follow-up: ${task}` } }
        : { type: 'finish', generatePrompt: `Governed demo run complete. Task: ${task}` };

    return {
      content: JSON.stringify({
        thought: { reasoning: 'deterministic scenario', plan: 'governed phases', confidence: 1 },
        action,
      }),
      model: this.model.modelId,
      inputTokens: 1,
      outputTokens: 1,
      finishReason: 'stop',
      aiProviderStamp: {
        providerFamily: 'ai' as const,
        providerKind: this.model.provider,
        modelId: this.model.modelId,
        modelTier: 1,
        resolutionSource: 'sidecar_deterministic_scenario',
      },
    };
  }
  selectModel(): ModelConfig { return this.model; }
  resolveCostModel(): ModelConfig { return this.model; }
  estimateCost(): number { return 0; }
}
