import { describe, expect, it } from 'vitest';

import { parseCommunityByoLlmConfig } from './community-byo-llm.config';

const FULL = {
  COMMUNITY_LLM_BASE_URL: 'https://api.deepseek.com/v1',
  COMMUNITY_LLM_API_KEY: 'sk-test-key',
  COMMUNITY_LLM_MODEL: 'deepseek-chat',
};

describe('parseCommunityByoLlmConfig', () => {
  it('returns null when nothing is configured (deterministic default)', () => {
    expect(parseCommunityByoLlmConfig({})).toBeNull();
    expect(
      parseCommunityByoLlmConfig({
        COMMUNITY_LLM_BASE_URL: '  ',
        COMMUNITY_LLM_API_KEY: '',
        COMMUNITY_LLM_MODEL: undefined,
      }),
    ).toBeNull();
  });

  it('returns the config when all three are set', () => {
    expect(parseCommunityByoLlmConfig(FULL)).toEqual({
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test-key',
      model: 'deepseek-chat',
      providerKind: 'openai_compatible',
    });
  });

  it('trims a trailing slash from the base URL', () => {
    expect(
      parseCommunityByoLlmConfig({ ...FULL, COMMUNITY_LLM_BASE_URL: 'https://x.example/v1//' })
        ?.baseUrl,
    ).toBe('https://x.example/v1');
  });

  it('fails fast on partial configuration, enumerating the missing keys', () => {
    try {
      parseCommunityByoLlmConfig({
        COMMUNITY_LLM_BASE_URL: 'https://api.deepseek.com/v1',
      });
      throw new Error('should have thrown');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('COMMUNITY_LLM_API_KEY');
      expect(message).toContain('COMMUNITY_LLM_MODEL');
      expect(message).toContain('refuses to silently');
    }
  });

  it('fails fast on an invalid base URL', () => {
    expect(() =>
      parseCommunityByoLlmConfig({ ...FULL, COMMUNITY_LLM_BASE_URL: 'not-a-url' }),
    ).toThrow(/not a valid URL/);
  });

  it('fails fast on a non-http(s) scheme', () => {
    expect(() =>
      parseCommunityByoLlmConfig({ ...FULL, COMMUNITY_LLM_BASE_URL: 'ftp://x.example/v1' }),
    ).toThrow(/http/);
  });

  it('never echoes the API key in error messages', () => {
    try {
      parseCommunityByoLlmConfig({
        COMMUNITY_LLM_API_KEY: 'sk-super-secret',
        COMMUNITY_LLM_MODEL: 'm',
      });
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as Error).message).not.toContain('sk-super-secret');
    }
  });
});
