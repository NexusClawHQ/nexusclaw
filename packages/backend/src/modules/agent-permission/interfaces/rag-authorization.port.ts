export const RAG_AUTHORIZATION_PORT = Symbol.for(
  '@nexusclaw/agent-permission/rag-authorization-port',
);

export interface RagAuthorizationInput {
  workspaceId: string;
  principalRoleId: string;
  agentId: string;
  sourceRef: string;
  sourceWorkspaceId: string;
  sourceAccessLevel: string;
  sourceCreatedBy?: string | null;
  sourceOrgNodeId?: string | null;
  principalOrgSubtreeIds: ReadonlyArray<string>;
  readableObjectApiNames: ReadonlyArray<string>;
  objectApiName?: string;
  recordId?: string;
}

export type RagAuthorizationDecision =
  | {
      allowed: true;
      code: 'AUTHORIZED';
      decisionRef: string;
      auditRequired: true;
    }
  | {
      allowed: false;
      code:
        | 'AUTHORIZATION_DENIED'
        | 'AUTHORIZATION_POLICY_MISSING'
        | 'OBJECT_READ_DENIED'
        | 'WORKSPACE_BOUNDARY_DENIED';
      decisionRef?: string;
      auditRequired: true;
    };

export interface RagAuthorizationPort {
  authorize(input: RagAuthorizationInput): Promise<RagAuthorizationDecision>;
}

export function missingRagAuthorizationPolicyDecision(): RagAuthorizationDecision {
  return {
    allowed: false,
    code: 'AUTHORIZATION_POLICY_MISSING',
    auditRequired: true,
  };
}

export function crossWorkspaceRagDecision(input: {
  workspaceId: string;
  sourceWorkspaceId: string;
}): RagAuthorizationDecision | null {
  if (input.workspaceId === input.sourceWorkspaceId) return null;
  return {
    allowed: false,
    code: 'WORKSPACE_BOUNDARY_DENIED',
    auditRequired: true,
  };
}

/**
 * Public-safe conservative policy. SQL isolation remains the first boundary;
 * this independent decision is applied before any retrieved content is returned.
 */
export function evaluateConservativeRagAuthorization(
  input: RagAuthorizationInput,
): RagAuthorizationDecision {
  const crossWorkspace = crossWorkspaceRagDecision(input);
  if (crossWorkspace) return crossWorkspace;
  if (!input.principalRoleId) return missingRagAuthorizationPolicyDecision();
  if (
    input.objectApiName &&
    !input.readableObjectApiNames.includes(input.objectApiName)
  ) {
    return {
      allowed: false,
      code: 'OBJECT_READ_DENIED',
      auditRequired: true,
    };
  }

  const allowedBySharing =
    input.sourceAccessLevel === 'public' ||
    (input.sourceAccessLevel === 'private' &&
      input.sourceCreatedBy === input.agentId) ||
    (input.sourceAccessLevel === 'org_subtree' &&
      Boolean(input.sourceOrgNodeId) &&
      input.principalOrgSubtreeIds.includes(input.sourceOrgNodeId!));
  if (!allowedBySharing) {
    return {
      allowed: false,
      code: 'AUTHORIZATION_DENIED',
      auditRequired: true,
    };
  }

  return {
    allowed: true,
    code: 'AUTHORIZED',
    decisionRef: `rag-auth:${input.sourceRef}`,
    auditRequired: true,
  };
}
