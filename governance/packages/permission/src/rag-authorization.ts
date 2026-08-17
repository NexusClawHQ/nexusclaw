import {
  crossWorkspaceRagDecision,
  evaluateConservativeRagAuthorization,
  missingRagAuthorizationPolicyDecision,
  type RagAuthorizationDecision,
  type RagAuthorizationInput,
  type RagAuthorizationPort,
} from './rag-authorization.port.js';

/**
 * Fail-closed default implementation of RagAuthorizationPort (plain class —
 * the product wraps it as a Nest provider). Conservative: SQL isolation is
 * the first boundary; this independent decision is applied before any
 * retrieved content is returned.
 */
export class ConservativeRagAuthorization
  implements RagAuthorizationPort
{
  async authorize(
    input: RagAuthorizationInput,
  ): Promise<RagAuthorizationDecision> {
    return evaluateConservativeRagAuthorization(input);
  }
}

export {
  evaluateConservativeRagAuthorization,
  crossWorkspaceRagDecision,
  missingRagAuthorizationPolicyDecision,
};
