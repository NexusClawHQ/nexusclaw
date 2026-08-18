/**
 * AC-2.4: the hosted playground surface must never carry credentials.
 * Enabling PLAYGROUND_PROFILE together with any COMMUNITY_LLM_* value is a
 * configuration error — refuse to boot rather than silently downgrading.
 */
import { parseCommunityByoLlmConfig } from '../byo/community-byo-llm.config';

export function assertPlaygroundProfile(env: NodeJS.ProcessEnv): void {
  if ((env.PLAYGROUND_PROFILE ?? '').toLowerCase() !== 'true') return;
  const byo = parseCommunityByoLlmConfig(env);
  if (byo) {
    throw new Error(
      'PLAYGROUND_FORBIDS_BYO: the playground profile must not run with ' +
        'COMMUNITY_LLM_* credentials — hosted anonymous surfaces stay ' +
        'credential-free by design. Unset the BYO variables or disable ' +
        'PLAYGROUND_PROFILE.',
    );
  }
}
