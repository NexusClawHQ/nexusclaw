/**
 * Canonical list of AI-employee avatar presets. The `key` matches an agent's
 * `avatarPresetKey` column and a `/ai-employee-avatars/<key>.png` static asset
 * shipped by every app that renders agent avatars (frontend, mobile-h5).
 */
export interface AgentAvatarPresetDefinition {
  key: string;
  /** Ant Design icon component name to fall back to when no preset image matches. */
  fallbackIcon: string;
}

export const AGENT_AVATAR_PRESET_DEFINITIONS: AgentAvatarPresetDefinition[] = [
  { key: 'revenue-strategist', fallbackIcon: 'RobotOutlined' },
  { key: 'customer-success', fallbackIcon: 'CustomerServiceOutlined' },
  { key: 'finance-analyst', fallbackIcon: 'FundOutlined' },
  { key: 'operations-planner', fallbackIcon: 'SolutionOutlined' },
  { key: 'compliance-guardian', fallbackIcon: 'AuditOutlined' },
  { key: 'supply-chain-coordinator', fallbackIcon: 'ShoppingOutlined' },
  { key: 'marketing-growth', fallbackIcon: 'ThunderboltOutlined' },
  { key: 'data-scientist', fallbackIcon: 'BarChartOutlined' },
  { key: 'hr-talent-partner', fallbackIcon: 'TeamOutlined' },
  { key: 'field-service-coordinator', fallbackIcon: 'PhoneOutlined' },
  { key: 'product-manager', fallbackIcon: 'ExperimentOutlined' },
  { key: 'project-coordinator', fallbackIcon: 'SolutionOutlined' },
  { key: 'healthcare-account-advisor', fallbackIcon: 'MedicineBoxOutlined' },
  { key: 'manufacturing-quality', fallbackIcon: 'AuditOutlined' },
  { key: 'retail-operations', fallbackIcon: 'ShoppingOutlined' },
  { key: 'partner-channel-manager', fallbackIcon: 'TeamOutlined' },
  { key: 'procurement-negotiator', fallbackIcon: 'FundOutlined' },
  { key: 'legal-contract-reviewer', fallbackIcon: 'AuditOutlined' },
  { key: 'training-coach', fallbackIcon: 'HeartOutlined' },
  { key: 'executive-assistant', fallbackIcon: 'UserOutlined' },
];

const PRESET_BY_KEY: Map<string, AgentAvatarPresetDefinition> = new Map(
  AGENT_AVATAR_PRESET_DEFINITIONS.map((preset) => [preset.key, preset]),
);

export const getAgentAvatarPreset = (
  avatarPresetKey?: string | null,
): AgentAvatarPresetDefinition | undefined =>
  avatarPresetKey ? PRESET_BY_KEY.get(avatarPresetKey) : undefined;

/** Stable default used when a concrete employee has not selected a preset yet. */
export const getDefaultAgentAvatarPreset = (
  identityKey?: string | null,
): AgentAvatarPresetDefinition | undefined => {
  if (!identityKey) return undefined;

  // FNV-1a keeps the mapping deterministic across browsers and Node runtimes.
  let hash = 2166136261;
  for (let index = 0; index < identityKey.length; index += 1) {
    hash ^= identityKey.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return AGENT_AVATAR_PRESET_DEFINITIONS[(hash >>> 0) % AGENT_AVATAR_PRESET_DEFINITIONS.length];
};

export const resolveAgentAvatarPreset = (
  avatarPresetKey?: string | null,
  identityKey?: string | null,
): AgentAvatarPresetDefinition | undefined => {
  // An explicit but unknown key is invalid data and must retain the safe fallback.
  if (avatarPresetKey) return getAgentAvatarPreset(avatarPresetKey);
  return getDefaultAgentAvatarPreset(identityKey);
};

/** Static asset path for an explicit or stable default avatar preset. */
export const getAgentAvatarSrc = (
  avatarPresetKey?: string | null,
  identityKey?: string | null,
): string | undefined => {
  const preset = resolveAgentAvatarPreset(avatarPresetKey, identityKey);
  return preset ? `/ai-employee-avatars/${preset.key}.png` : undefined;
};
