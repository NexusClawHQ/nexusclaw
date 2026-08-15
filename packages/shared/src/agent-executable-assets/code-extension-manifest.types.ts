/**
 * Code-extension manifest v2 governance + ACTION artifact entry contracts
 * (executable-asset design §6.1, task 3.1).
 *
 * The v1/v2 discriminant is the enclosing `codeExtensionGovernance.contractVersion`:
 *  - `code-extension-governance/v1`: legacy behavior unchanged (optional id,
 *    trigger kind allowed, no Agent binding).
 *  - `code-extension-governance/v2`: required `extensionId`, ACTION-only,
 *    `entrypoint: 'default'`, `actionContractVersion`, `runtimeApiVersion`, and
 *    `agentToolCatalogPath`; legacy `worker-thread-hardened-isolate` never
 *    matches (the manifest value must be exactly `nexusclaw-verified-isolate-v1`).
 */
import {
  CODE_EXTENSION_GOVERNANCE_V1,
  CODE_EXTENSION_GOVERNANCE_V2,
  ACTION_CONTRACT_VERSION,
  RUNTIME_API_VERSION_V2,
  VERIFIED_ISOLATE_PROVIDER_ID,
} from './contract-versions';

/** Legacy v1 governance contract (kept compatible; no Agent binding). */
export interface CodeExtensionGovernanceV1 {
  readonly contractVersion: typeof CODE_EXTENSION_GOVERNANCE_V1;
}

/**
 * v2 governance contract. `runtimeApiVersion` selects runtime/v2 (the
 * verified-isolate provider surface). Permits `agentToolCatalogPath`.
 */
export interface CodeExtensionGovernanceV2 {
  readonly contractVersion: typeof CODE_EXTENSION_GOVERNANCE_V2;
  readonly runtimeApiVersion: typeof RUNTIME_API_VERSION_V2;
}

export type CodeExtensionGovernance = CodeExtensionGovernanceV1 | CodeExtensionGovernanceV2;

/**
 * Legacy v1 code-executable artifact entry. Optional id; trigger kind allowed;
 * `dependsOn` may describe a runtime graph.
 */
export interface LegacyCodeExecutableArtifactManifestEntryV1 {
  readonly extensionId?: string;
  readonly apiName?: string;
  readonly kind: 'function' | 'trigger';
  readonly functionType?: string;
  readonly sourcePath: string;
  readonly entrypoint?: string;
  readonly dependsOn?: ReadonlyArray<string>;
}

/**
 * v2 ACTION artifact entry (design §6.1, verbatim). Required `extensionId`,
 * ACTION-only, default entrypoint, frozen contract + runtime versions.
 */
export interface CodeExecutableActionArtifactManifestEntryV2 {
  /** Required stable artifactRef target (catalog `artifactRef` must equal this). */
  readonly extensionId: string;
  readonly apiName: string;
  readonly kind: 'function';
  readonly functionType: 'ACTION';
  readonly sourcePath: string;
  readonly entrypoint: 'default';
  readonly actionContractVersion: typeof ACTION_CONTRACT_VERSION;
  readonly runtimeApiVersion: typeof RUNTIME_API_VERSION_V2;
  /** Single-file v1 has no runtime graph. */
  readonly dependsOn?: never;
}

export type CodeExecutableArtifactManifestEntry =
  | LegacyCodeExecutableArtifactManifestEntryV1
  | CodeExecutableActionArtifactManifestEntryV2;

/**
 * Type guard: is the artifact entry a v2 ACTION entry?
 */
export function isV2ActionEntry(
  entry: CodeExecutableArtifactManifestEntry,
): entry is CodeExecutableActionArtifactManifestEntryV2 {
  return (
    entry.kind === 'function' &&
    (entry as { functionType?: string }).functionType === 'ACTION' &&
    entry.entrypoint === 'default' &&
    typeof entry.extensionId === 'string' &&
    entry.extensionId.length > 0
  );
}

/** The runtime provider requirement a v2 manifest must declare. */
export const V2_RUNTIME_PROVIDER_REQUIREMENT = VERIFIED_ISOLATE_PROVIDER_ID;

/** Re-exported version literals for convenience. */
export {
  CODE_EXTENSION_GOVERNANCE_V1,
  CODE_EXTENSION_GOVERNANCE_V2,
  ACTION_CONTRACT_VERSION,
  RUNTIME_API_VERSION_V2,
  VERIFIED_ISOLATE_PROVIDER_ID,
};
