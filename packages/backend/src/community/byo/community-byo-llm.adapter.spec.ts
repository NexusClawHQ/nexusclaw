import { describe, expect, it, vi } from 'vitest';

import type { ChatRequest } from '../../modules/agent-runtime/interfaces';
import {
  CommunityByoLlmError,
  CommunityByoLlmModelProviderAdapter,
  nativeFetchLike,
  sanitizeByoError,
  stripFencesAndValidate,
  type FetchLike,
} from './community-byo-llm.adapter';
import type { CommunityByoLlmConfig } from './community-byo-llm.config';

const CONFIG: CommunityByoLlmConfig = {
  baseUrl: 'https://llm.internal.example/v1',
  apiKey: 'sk-top-secret',
  model: 'test-model',
  providerKind: 'openai_compatible',
};

function okResponse(payload: unknown): Parameters<FetchLike>[1] extends never ? never : {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
} {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(payload),
  };
}

const JSON_ACTION = JSON.stringify({
  thought: { reasoning: 'r', plan: 'p', confidence: 1 },
  action: { type: 'tool_call', toolName: 'demo.customer_lookup', toolInput: {} },
});

function completion(content: string, usage?: Record<string, number>) {
  return {
    choices: [{ message: { content }, finish_reason: 'stop' }],
    usage,
  };
}

function request(): ChatRequest {
  return {
    messages: [{ role: 'user', content: 'look up customer C-1001' }],
    responseFormat: 'json',
  };
}

describe('stripFencesAndValidate', () => {
  it('accepts plain JSON', () => {
    expect(stripFencesAndValidate(JSON_ACTION)).toBe(JSON_ACTION);
  });

  it('strips ```json fences', () => {
    expect(stripFencesAndValidate('```json\n' + JSON_ACTION + '\n```')).toBe(JSON_ACTION);
  });

  it('strips bare ``` fences', () => {
    expect(stripFencesAndValidate('```\n' + JSON_ACTION + '\n```')).toBe(JSON_ACTION);
  });

  it('throws fail-closed on unparseable content without echoing it', () => {
    try {
      stripFencesAndValidate('I will help you with that!');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(CommunityByoLlmError);
      expect((error as Error).message).not.toContain('help you');
    }
  });
});

describe('sanitizeByoError', () => {
  it('keeps HTTP status and host, drops everything else', () => {
    const error = Object.assign(
      new Error('Unauthorized: invalid api_key sk-top-secret'),
      { status: 401 },
    );
    const sanitized = sanitizeByoError(error, CONFIG);
    expect(sanitized.message).toContain('HTTP 401');
    expect(sanitized.message).toContain('llm.internal.example');
    expect(sanitized.message).not.toContain('sk-top-secret');
    expect(sanitized.message).not.toContain('Unauthorized');
  });

  it('scrubs the API key out of network-failure messages', () => {
    const sanitized = sanitizeByoError(
      new Error('fetch failed for sk-top-secret reasons'),
      CONFIG,
    );
    expect(sanitized.message).toContain('unreachable');
    expect(sanitized.message).not.toContain('sk-top-secret');
  });

  it('passes through already-sanitized errors', () => {
    const original = new CommunityByoLlmError('stable message');
    expect(sanitizeByoError(original, CONFIG)).toBe(original);
  });
});

describe('CommunityByoLlmModelProviderAdapter', () => {
  it('sends an OpenAI-compatible chat.completions request with bearer auth', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(completion(JSON_ACTION, { prompt_tokens: 10, completion_tokens: 5 })));
    const adapter = new CommunityByoLlmModelProviderAdapter(CONFIG, fetchImpl as unknown as FetchLike);

    const response = await adapter.chat(request(), 1);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://llm.internal.example/v1/chat/completions');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer sk-top-secret',
      'Content-Type': 'application/json',
    });
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe('test-model');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0]).toEqual({ role: 'user', content: 'look up customer C-1001' });

    expect(response.model).toBe('test-model');
    expect(response.inputTokens).toBe(10);
    expect(response.outputTokens).toBe(5);
    expect(response.content).toBe(JSON_ACTION);
    expect(response.aiProviderStamp?.resolutionSource).toBe('community_byo_env');
  });

  it('falls back to length/4 token estimation when usage is missing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(completion(JSON_ACTION)));
    const adapter = new CommunityByoLlmModelProviderAdapter(CONFIG, fetchImpl as unknown as FetchLike);
    const response = await adapter.chat(request(), 1);
    expect(response.inputTokens).toBeGreaterThan(0);
    expect(response.outputTokens).toBeGreaterThan(0);
  });

  it('strips fenced JSON from the completion before returning', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(completion('```json\n' + JSON_ACTION + '\n```')));
    const adapter = new CommunityByoLlmModelProviderAdapter(CONFIG, fetchImpl as unknown as FetchLike);
    const response = await adapter.chat(request(), 1);
    expect(response.content).toBe(JSON_ACTION);
  });

  it('flattens RuntimeMessage parts into text content', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(completion(JSON_ACTION)));
    const adapter = new CommunityByoLlmModelProviderAdapter(CONFIG, fetchImpl as unknown as FetchLike);
    await adapter.chat(
      {
        messages: [
          {
            role: 'system',
            parts: [
              { type: 'text', text: 'governed ' },
              { type: 'text', text: 'prompt' },
            ],
          },
        ],
        responseFormat: 'json',
      },
      1,
    );
    const body = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(body.messages[0]).toEqual({ role: 'system', content: 'governed prompt' });
  });

  it('fails closed with a sanitized error on a non-2xx endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'boom sk-top-secret' }),
    });
    const adapter = new CommunityByoLlmModelProviderAdapter(CONFIG, fetchImpl as unknown as FetchLike);
    await expect(adapter.chat(request(), 1)).rejects.toThrow(/HTTP 500/);
    await expect(adapter.chat(request(), 1)).rejects.toThrow(
      expect.not.stringContaining('sk-top-secret') as never,
    );
  });

  it('fails closed on an empty completion', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(completion('   ')));
    const adapter = new CommunityByoLlmModelProviderAdapter(CONFIG, fetchImpl as unknown as FetchLike);
    await expect(adapter.chat(request(), 1)).rejects.toThrow(/empty completion/);
  });

  it('fails closed on unparseable completions', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(completion('free text')));
    const adapter = new CommunityByoLlmModelProviderAdapter(CONFIG, fetchImpl as unknown as FetchLike);
    await expect(adapter.chat(request(), 1)).rejects.toThrow(/not valid JSON/);
  });

  it('aborts and fails closed when the endpoint exceeds the timeout', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }));
          });
        }),
    ) as unknown as FetchLike;
    const adapter = new CommunityByoLlmModelProviderAdapter(CONFIG, fetchImpl, 5);
    await expect(adapter.chat(request(), 1)).rejects.toThrow(/unreachable|aborted/);
  });

  it('exposes the BYO model id through selectModel with zero cost', () => {
    const adapter = new CommunityByoLlmModelProviderAdapter(CONFIG, nativeFetchLike);
    expect(adapter.selectModel().modelId).toBe('test-model');
    expect(adapter.resolveCostModel().modelId).toBe('test-model');
    expect(adapter.estimateCost(1000, 1000, adapter.selectModel())).toBe(0);
  });
});
