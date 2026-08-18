/**
 * BYO real-LLM adapter for the Community demo runtime.
 *
 * Implements the same ExecutorModelPort as the deterministic smoke provider
 * (community-runtime-adapters.ts). Governance is model-orthogonal: the
 * executor's permission / guardrail / approval / audit pipeline is untouched —
 * this adapter only replaces WHERE the {thought, action} JSON comes from.
 *
 * Failure discipline (fail-closed): any transport or content failure throws;
 * the executor marks the execution failed. Nothing here may bypass or relax a
 * governance check. Error messages are sanitized — they carry an HTTP status
 * and the endpoint host only, never the API key, response bodies, or the
 * full URL.
 */
import type { CommunityByoLlmConfig } from './community-byo-llm.config';
import type {
  ChatRequest,
  ChatResponse,
  ModelConfig,
} from '../../modules/agent-runtime/interfaces';
import type { ExecutorModelPort } from '../../modules/agent-runtime/contracts/runtime-boundary-ports';

/** Fixed message type for every sanitized BYO failure. */
export class CommunityByoLlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommunityByoLlmError';
  }
}

const DEFAULT_TIMEOUT_MS = 60_000;

/** Minimal fetch shape the BYO adapter depends on (native fetch in runtime,
 * a stub in tests). Keeps the adapter testable without network or DI. */
export interface FetchLike {
  (input: string, init?: RequestInit): Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
  }>;
}

export const nativeFetchLike: FetchLike = (input, init) =>
  fetch(input, init);

function hostOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return 'invalid-host';
  }
}

/**
 * Normalize a model completion into executor-grade content:
 * strip markdown code fences, then verify the remainder parses as JSON.
 * Fail-closed — an unparseable completion throws rather than being guessed at.
 */
export function stripFencesAndValidate(content: string): string {
  let text = content.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) text = fence[1].trim();
  try {
    JSON.parse(text);
  } catch {
    throw new CommunityByoLlmError(
      'BYO model completion is not valid JSON for the {thought, action} ' +
        'contract (fail-closed).',
    );
  }
  return text;
}

/** Strip anything that might carry the credential from an error message. */
export function sanitizeByoError(error: unknown, config: CommunityByoLlmConfig): CommunityByoLlmError {
  if (error instanceof CommunityByoLlmError) {
    return error;
  }
  const host = hostOf(config.baseUrl);
  const status =
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : null;
  const raw =
    error instanceof Error ? error.message : 'BYO model endpoint call failed';
  const scrubbed = raw.split(config.apiKey).join('***');
  const message = status !== null
    ? 'BYO model endpoint responded with HTTP ' + status + ' (' + host + ').'
    : 'BYO model endpoint unreachable (' + host + '): ' + scrubbed;
  return new CommunityByoLlmError(message);
}

function messageText(
  message: ChatRequest['messages'][number],
): string {
  if ('parts' in message && Array.isArray(message.parts)) {
    return message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('');
  }
  return String((message as { content: unknown }).content ?? '');
}

export class CommunityByoLlmModelProviderAdapter implements ExecutorModelPort {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly model: ModelConfig = {
    tier: 1,
    modelId: 'community-byo-env',
    provider: 'community-byo',
    inputCostPer1k: 0,
    outputCostPer1k: 0,
    maxTokens: 4_096,
    supportsStreaming: false,
  };

  constructor(
    private readonly config: CommunityByoLlmConfig,
    fetchImpl: FetchLike,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async chat(
    request: ChatRequest,
    _tier?: number,
    _context?: Record<string, unknown>,
  ): Promise<ChatResponse> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: request.messages.map((message) => ({
        role: message.role,
        content: messageText(message),
      })),
    };
    if (typeof request.temperature === 'number') {
      body.temperature = request.temperature;
    }
    if (typeof request.maxTokens === 'number' && request.maxTokens > 0) {
      body.max_tokens = request.maxTokens;
    }
    if (request.responseFormat === 'json') {
      // Optional for endpoints without json_object support; fence stripping
      // plus validation above is the real contract enforcement.
      body.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(
        this.config.baseUrl + '/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + this.config.apiKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        // Plain error carrying the status — sanitizeByoError turns it into
        // the stable "HTTP <status> (<host>)" message.
        throw sanitizeByoError(
          Object.assign(new Error('upstream-status'), {
            status: response.status,
          }),
          this.config,
        );
      }
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: unknown }; finish_reason?: unknown }>;
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
      };
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new CommunityByoLlmError(
          'BYO model returned an empty completion (' +
            hostOf(this.config.baseUrl) +
            ').',
        );
      }
      const usage = payload.usage ?? {};
      const inputTokens =
        typeof usage.prompt_tokens === 'number' && usage.prompt_tokens >= 0
          ? usage.prompt_tokens
          : Math.max(
              1,
              Math.ceil(
                request.messages.reduce(
                  (sum, message) => sum + messageText(message).length,
                  0,
                ) / 4,
              ),
            );
      const outputTokens =
        typeof usage.completion_tokens === 'number' &&
        usage.completion_tokens >= 0
          ? usage.completion_tokens
          : Math.max(1, Math.ceil(content.length / 4));

      return {
        content: stripFencesAndValidate(content),
        model: this.config.model,
        inputTokens,
        outputTokens,
        finishReason:
          typeof payload.choices?.[0]?.finish_reason === 'string'
            ? payload.choices[0].finish_reason
            : 'stop',
        aiProviderStamp: {
          providerFamily: 'ai' as const,
          providerKind: this.config.providerKind,
          modelId: this.config.model,
          modelTier: 1,
          resolutionSource: 'community_byo_env',
        },
      };
    } catch (error) {
      throw sanitizeByoError(error, this.config);
    } finally {
      clearTimeout(timer);
    }
  }

  selectModel(): ModelConfig {
    return { ...this.model, modelId: this.config.model };
  }

  resolveCostModel(): ModelConfig {
    return this.selectModel();
  }

  estimateCost(): number {
    return 0;
  }
}
