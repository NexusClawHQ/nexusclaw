import { describe, expect, it } from 'vitest';

import { assertPlaygroundProfile } from './community-playground.profile';

const BYO = {
  COMMUNITY_LLM_BASE_URL: 'https://api.deepseek.com/v1',
  COMMUNITY_LLM_API_KEY: 'sk-x',
  COMMUNITY_LLM_MODEL: 'deepseek-chat',
};

describe('assertPlaygroundProfile (AC-2.4)', () => {
  it('passes when the playground profile is off, regardless of BYO', () => {
    expect(() => assertPlaygroundProfile({})).not.toThrow();
    expect(() => assertPlaygroundProfile({ ...BYO })).not.toThrow();
  });

  it('passes when the playground profile is on and BYO is unset', () => {
    expect(() =>
      assertPlaygroundProfile({ PLAYGROUND_PROFILE: 'true' }),
    ).not.toThrow();
  });

  it('refuses to boot when the playground profile meets BYO credentials', () => {
    expect(() =>
      assertPlaygroundProfile({ PLAYGROUND_PROFILE: 'true', ...BYO }),
    ).toThrowError(/PLAYGROUND_FORBIDS_BYO/);
  });
});
