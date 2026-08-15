import { createHash } from 'node:crypto';

import type { AIProviderConfig } from './entities/ai-provider-config.entity';

/**
 * Executable AI capability registry.
 *
 * This is the single runtime truth consumed by control-plane validation,
 * GraphQL, the Platform Admin UI, and ModelRouter. A model/provider claiming a
 * capability in metadata does not make that capability executable.
 */
export const AI_RUNTIME_CAPABILITIES = [
  'chat',
  'embedding',
  'vision',
  'json',
  'tool_calling',
  'streaming',
  'reasoning',
] as const;

export type AIRuntimeCapability = (typeof AI_RUNTIME_CAPABILITIES)[number];
export type AIRuntimeCapabilityWiringStatus = 'WIRED' | 'NOT_WIRED';

export interface AIRuntimeCapabilityDescriptor {
  wiringStatus: AIRuntimeCapabilityWiringStatus;
  /** Stable evidence label; never a user-facing success claim by itself. */
  runtimeConsumer: string | null;
}

/**
 * Frozen allowlist of legal `runtimeConsumer` labels (ARCW-107). A capability
 * may only be `WIRED` with a consumer string present in this set, AND every
 * entry must back at least one WIRED capability. This is the bidirectional
 * enforcement of invariant I1 (no metadata-only flips, no dead labels):
 *
 * Phase 9 must, in the SAME change, (a) add the new consumer label here AND
 * (b) flip the registry entry to WIRED with that label — otherwise one of the
 * two guard tests fails (used-not-allowlisted, or allowlisted-but-unused).
 *
 * These labels name the real adapter + governed-path consumer that proves the
 * capability is executable — never a UI string or a vendor name.
 */
export const WIRED_CONSUMER_ALLOWLIST = [
  'ModelRouterService.chat',
  'KnowledgeSearchService.generateEmbedding',
] as const;

const NOT_WIRED: AIRuntimeCapabilityDescriptor = {
  wiringStatus: 'NOT_WIRED',
  runtimeConsumer: null,
};

export const AI_RUNTIME_CAPABILITY_REGISTRY: Readonly<
  Record<AIRuntimeCapability, AIRuntimeCapabilityDescriptor>
> = {
  // Runtime consumers below resolve persisted platform policy and never infer
  // executability from provider metadata alone.
  chat: {
    wiringStatus: 'WIRED',
    runtimeConsumer: 'ModelRouterService.chat',
  },
  embedding: {
    wiringStatus: 'WIRED',
    runtimeConsumer: 'KnowledgeSearchService.generateEmbedding',
  },
  vision: NOT_WIRED,
  json: NOT_WIRED,
  tool_calling: NOT_WIRED,
  streaming: NOT_WIRED,
  reasoning: NOT_WIRED,
};

export function isAIRuntimeCapability(
  value: unknown,
): value is AIRuntimeCapability {
  return (
    typeof value === 'string' &&
    (AI_RUNTIME_CAPABILITIES as readonly string[]).includes(value)
  );
}

export function getAIRuntimeCapabilityDescriptor(
  capability: AIRuntimeCapability,
): AIRuntimeCapabilityDescriptor {
  return AI_RUNTIME_CAPABILITY_REGISTRY[capability];
}

export function isAIRuntimeCapabilityWired(
  capability: AIRuntimeCapability,
): boolean {
  return getAIRuntimeCapabilityDescriptor(capability).wiringStatus === 'WIRED';
}

/** Secret-free projection exposed to Platform Admin. */
export function listAIRuntimeCapabilityCatalog(): Array<{
  capability: AIRuntimeCapability;
  wiringStatus: AIRuntimeCapabilityWiringStatus;
  runtimeConsumer: string | null;
}> {
  return AI_RUNTIME_CAPABILITIES.map((capability) => ({
    capability,
    ...AI_RUNTIME_CAPABILITY_REGISTRY[capability],
  }));
}

export function getAIProviderRuntimeWiring(
  enabledCapabilities: readonly string[] = [],
): {
  status: AIRuntimeCapabilityWiringStatus;
  wiredCapabilities: AIRuntimeCapability[];
  notWiredCapabilities: string[];
} {
  const wiredCapabilities = enabledCapabilities.filter(
    (capability): capability is AIRuntimeCapability =>
      isAIRuntimeCapability(capability) &&
      isAIRuntimeCapabilityWired(capability),
  );
  const notWiredCapabilities = enabledCapabilities.filter(
    (capability) =>
      !isAIRuntimeCapability(capability) ||
      !isAIRuntimeCapabilityWired(capability),
  );
  return {
    status:
      enabledCapabilities.length > 0 && notWiredCapabilities.length === 0
        ? 'WIRED'
        : 'NOT_WIRED',
    wiredCapabilities,
    notWiredCapabilities,
  };
}

/**
 * Opaque revision of exactly the fields that determine platform-policy model
 * execution. It prevents an invocation started with stale config from marking
 * a newly edited provider healthy. The secret reference is hashed and the
 * revision is never exposed through GraphQL or audit.
 */
export function computeAIProviderRuntimeRevision(
  config: Pick<
    AIProviderConfig,
    | 'providerKind'
    | 'status'
    | 'baseUrl'
    | 'internalEndpoint'
    | 'modelList'
    | 'defaultModel'
    | 'enabledCapabilities'
    | 'secretRef'
  >,
): string {
  const runtimeShape = {
    providerKind: config.providerKind,
    status: config.status,
    baseUrl: config.baseUrl ?? null,
    internalEndpoint: Boolean(config.internalEndpoint),
    defaultModel: config.defaultModel,
    enabledCapabilities: [...(config.enabledCapabilities ?? [])],
    secretRef: config.secretRef,
    modelList: (config.modelList ?? []).map((model) => ({
      modelId: model.modelId,
      capabilities: [...(model.capabilities ?? [])],
      status: model.status,
    })),
  };
  return createHash('sha256')
    .update(JSON.stringify(runtimeShape))
    .digest('hex');
}
