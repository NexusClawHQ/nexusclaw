export const COMMUNITY_CAPABILITY_CODES = {
  CAPABILITY_UNAVAILABLE_IN_COMMUNITY:
    'CAPABILITY_UNAVAILABLE_IN_COMMUNITY',
  AUTHORIZATION_POLICY_MISSING: 'AUTHORIZATION_POLICY_MISSING',
  AUTHORIZATION_DENIED: 'AUTHORIZATION_DENIED',
  AGENT_IDENTITY_INVARIANT_VIOLATION:
    'AGENT_IDENTITY_INVARIANT_VIOLATION',
  AUDIT_TRACE_INCOMPLETE: 'AUDIT_TRACE_INCOMPLETE',
} as const;

export const COMMUNITY_CAPABILITIES = {
  governedAgentExecution: 'available',
  behaviorLearningPublication: 'unavailable',
  knowledgeDistillation: 'unavailable',
  commercialBilling: 'unavailable',
  commercialLicenseEnforcement: 'unavailable',
  enterpriseSso: 'unavailable',
  communityCli: 'unavailable',
  cliGenerate: 'unavailable',
  packageRegistryDeployment: 'unavailable',
  packageExplorer: 'unavailable',
  workspaceTemplateGeneration: 'unavailable',
} as const satisfies Record<string, 'available' | 'unavailable'>;

export type CommunityCapabilityName = keyof typeof COMMUNITY_CAPABILITIES;

export interface CommunityCapabilityUnavailable {
  available: false;
  code: typeof COMMUNITY_CAPABILITY_CODES.CAPABILITY_UNAVAILABLE_IN_COMMUNITY;
  capability: CommunityCapabilityName;
}

export function unavailableCommunityCapability(
  capability: CommunityCapabilityName,
): CommunityCapabilityUnavailable {
  return {
    available: false,
    code: COMMUNITY_CAPABILITY_CODES.CAPABILITY_UNAVAILABLE_IN_COMMUNITY,
    capability,
  };
}
