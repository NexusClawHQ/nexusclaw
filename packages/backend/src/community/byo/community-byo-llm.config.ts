/**
 * Environment-variable contract for the Community BYO (bring-your-own) real
 * LLM demo path.
 *
 * All three variables must be set together, or none. Unset entirely → the
 * deterministic smoke provider runs unchanged (zero network, zero
 * credentials). Partially set → startup FAILS FAST with the missing keys
 * enumerated: a governance runtime must never silently downgrade a
 * misconfigured real-model path back to a pretend one.
 *
 * The parsed config never leaves the backend process; the API key is not
 * logged, returned or stamped (see community-byo-llm.adapter.ts).
 */
export interface CommunityByoLlmConfig {
  /** OpenAI-compatible chat-completions root, e.g. https://api.deepseek.com/v1 */
  baseUrl: string;
  apiKey: string;
  model: string;
  providerKind: 'openai_compatible';
}

export type ByoEnvSource = Record<string, string | undefined>;

const BYO_KEYS = [
  'COMMUNITY_LLM_BASE_URL',
  'COMMUNITY_LLM_API_KEY',
  'COMMUNITY_LLM_MODEL',
] as const;

export function parseCommunityByoLlmConfig(
  env: ByoEnvSource,
): CommunityByoLlmConfig | null {
  const values = BYO_KEYS.map((key) => (env[key] ?? '').trim());
  const missing = BYO_KEYS.filter((_key, index) => !values[index]);

  if (missing.length === BYO_KEYS.length) return null;

  if (missing.length > 0) {
    const set = BYO_KEYS.filter((key) => !missing.includes(key));
    throw new Error(
      'Community BYO LLM configuration is partial: missing ' +
        missing.join(', ') +
        ' (set: ' +
        set.join(', ') +
        '). Set all three or none — the runtime refuses to silently ' +
        'fall back from a real-model path to the deterministic scenario.',
    );
  }

  const [baseUrl, apiKey, model] = values;
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(
      'COMMUNITY_LLM_BASE_URL is not a valid URL (scheme + host required).',
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      'COMMUNITY_LLM_BASE_URL must use http(s) (got protocol ' +
        parsed.protocol +
        ').',
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    model,
    providerKind: 'openai_compatible',
  };
}
