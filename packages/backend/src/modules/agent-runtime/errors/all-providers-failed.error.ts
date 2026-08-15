/**
 * Thrown when all LLM providers in the fallback chain have been exhausted.
 */
export class AllProvidersFailedError extends Error {
  public readonly tier: number;
  public readonly providerErrors: Array<{ provider: string; error: string }>;

  constructor(tier: number, providerErrors: Array<{ provider: string; error: string }> = []) {
    super(`All LLM providers failed for tier ${tier}`);
    this.name = 'AllProvidersFailedError';
    this.tier = tier;
    this.providerErrors = providerErrors;
  }
}
