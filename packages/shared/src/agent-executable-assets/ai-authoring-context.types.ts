/**
 * AI authoring context pack contracts.
 *
 * Frozen by executable-asset design §17.1. The context pack is the
 * machine-readable authoring surface Claude/Codex/GLM consume to discover,
 * write, validate and test Code + Flow without chat-only instructions (R-15 /
 * R-18). core/shared/runtime is the contract truth; industry overlay may only
 * append examples/labels, never override ABI/schema/commands/permissions.
 */
import {
  AI_AUTHORING_CONTEXT_SCHEMA_VERSION,
  AI_AUTHORING_CONTEXT_LOCK_SCHEMA_VERSION,
  AI_CONTEXT_SIGNATURE_ALG_ED25519,
  AI_CONTEXT_SIGNATURE_ALG_NONE,
  AI_CONTEXT_SIGNATURE_TYP,
  AI_CONTEXT_SIGNING_KEY_SET_SCHEMA_VERSION,
  AGENT_CODE_TOOL_CATALOG_SCHEMA_VERSION,
  AI_POLICY_AUTHORING_CATALOG_SCHEMA_VERSION,
  APPROVAL_POLICY_AUTHORING_CATALOG_SCHEMA_VERSION,
  BUNDLE_LOCK_SCHEMA_VERSION,
  BUNDLE_SCHEMA_VERSION,
  CLI_COMMAND_REGISTRY_SCHEMA_VERSION,
  CODE_ACTION_CASES_SCHEMA_VERSION,
  CODE_EXTENSION_GOVERNANCE_V2,
  COMMAND_ORDER_SCHEMA_VERSION,
  CONNECTOR_AUTHORING_CATALOG_SCHEMA_VERSION,
  EMPLOYEE_PACKAGE_V2_SCHEMA_VERSION,
  FLOW_NODE_CATALOG_SCHEMA_VERSION,
  FLOW_PACKAGE_SCHEMA_VERSION,
  FLOWS_PAYLOAD_V2,
  INVOKABLE_AUTHORING_CATALOG_SCHEMA_VERSION,
  OBJECT_AUTHORING_CATALOG_SCHEMA_VERSION,
  RUNTIME_API_VERSION_V2,
  RUNTIME_BINDINGS_SCHEMA_VERSION,
  WORKFORCE_RELEASE_EVIDENCE_SCHEMA_VERSION,
  WORKSPACE_AUTHORING_CONTRACT_SCHEMA_VERSION,
} from './contract-versions';

/** Exact online selector triad; config surface uses caller_preview. */
export type AiContextPrincipalKind = 'caller_preview' | 'agent';

/** Selectors — online code|flow|employee|all must provide exactly one of: */
export type AiContextOnlineSelector =
  | { readonly kind: 'caller_preview' }
  | { readonly kind: 'active_agent'; readonly agentApiName: string }
  | {
      readonly kind: 'candidate';
      readonly candidateReleaseSetId: string;
    };

export type AiContextSurface = 'config' | 'code' | 'flow' | 'employee' | 'all';

/** SHA-256 digest, lowercase `sha256:<64 hex>`. */
export type AiContextSha256 = `sha256:${string}`;

/**
 * Typed public request used by the GraphQL describe query. The resolver maps
 * its closed input DTO to this shape; unknown properties never cross the
 * GraphQL boundary.
 */
export interface DescribeAiAuthoringContextRequestV2 {
  readonly schemaVersion: typeof AI_AUTHORING_CONTEXT_SCHEMA_VERSION;
  readonly surface: AiContextSurface;
  readonly targetWorkspaceId: string;
  readonly selector: AiContextOnlineSelector;
  readonly knownContractDigest?: AiContextSha256;
  readonly knownWorkspaceContractHash?: AiContextSha256;
}

/** Exact candidate stamp recomputed from persisted release truth. */
export interface AiAuthoringCandidateReleaseStampV1 {
  readonly candidateReleaseSetId: string;
  readonly agentApiName: string;
  readonly eligibilityStatus: 'staged' | 'eligible' | 'rejected';
  readonly sourceLockDigest: AiContextSha256;
  readonly releaseItemSetDigest: AiContextSha256;
  readonly materializedItemRefsDigest: AiContextSha256;
  readonly releaseEnvelopeDigest: AiContextSha256 | null;
  readonly previousReleaseSetId: string | null;
  readonly headAtStage: {
    readonly activeReleaseSetId: string | null;
    readonly generation: number;
  };
}

/**
 * A catalog document is returned as canonical UTF-8 JSON in a typed envelope.
 * This keeps the GraphQL surface free of GraphQLJSON while the JSON document
 * itself remains governed by its versioned, additionalProperties:false
 * schema included in the exported pack.
 */
export interface AiAuthoringCatalogDocumentV1 {
  readonly schemaVersion: string;
  readonly digest: AiContextSha256;
  readonly canonicalJson: string;
}

export interface AiAuthoringContextHashesV1 {
  readonly contractDigest: AiContextSha256;
  readonly workspaceContractHash: AiContextSha256;
  readonly principalScopeDigest: AiContextSha256;
}

export interface AiAuthoringContextSnapshotV2
  extends AiAuthoringContextHashesV1 {
  readonly schemaVersion: typeof AI_AUTHORING_CONTEXT_SCHEMA_VERSION;
  readonly coreVersion: string;
  readonly coreCommitSha: string;
  readonly cliVersion: string;
  readonly runtimeApiVersion: typeof RUNTIME_API_VERSION_V2;
  readonly surface: AiContextSurface;
  readonly targetWorkspaceId: string;
  readonly principalKind: AiContextPrincipalKind;
  readonly principalId: string;
  readonly agentApiName: string | null;
  readonly releaseSetId: string | null;
  readonly releaseStamp: AiAuthoringCandidateReleaseStampV1 | null;
  readonly generatedAt: string;
  readonly expiresAt: string;
  readonly objectCatalog: AiAuthoringCatalogDocumentV1;
  readonly invokableCatalog: AiAuthoringCatalogDocumentV1;
  readonly connectorCatalog: AiAuthoringCatalogDocumentV1;
  readonly aiPolicyCatalog: AiAuthoringCatalogDocumentV1;
  readonly approvalPolicyCatalog: AiAuthoringCatalogDocumentV1;
}

export interface VerifyAiAuthoringContextFreshnessRequestV2
  extends DescribeAiAuthoringContextRequestV2,
    AiAuthoringContextHashesV1 {
  readonly generatedAt: string;
  readonly expiresAt: string;
  readonly contentDigest: AiContextSha256;
  readonly manifestContentDigest: AiContextSha256;
  readonly manifestEnvelopeDigest: AiContextSha256;
  readonly lockDigest: AiContextSha256;
}

/**
 * Additive signing request. Describe/verify remain stable; an online client
 * may request a signature only after it has computed the complete pack
 * digests and explicitly supplied the authenticated org-alias claim.
 */
export interface SignAiAuthoringContextLockRequestV2
  extends VerifyAiAuthoringContextFreshnessRequestV2 {
  readonly orgAliasClaim: string;
}

export interface AiAuthoringContextVerificationV1 {
  readonly valid: boolean;
  readonly stale: boolean;
  readonly reasons: readonly string[];
  readonly currentHashes: AiAuthoringContextHashesV1;
}

/**
 * Context manifest. `nexusclaw.ai-authoring-context/v2`. Online packs expire
 * after 24 hours or when core/runtime/workspace contract hash changes.
 */
export interface AiAuthoringContextManifestV2 {
  readonly schemaVersion: typeof AI_AUTHORING_CONTEXT_SCHEMA_VERSION;
  readonly coreVersion: string;
  readonly coreCommitSha: string;
  readonly cliVersion: string;
  readonly runtimeApiVersion: typeof RUNTIME_API_VERSION_V2;
  readonly contractDigest: string;
  readonly workspaceContractHash: string;
  readonly surfaces: ReadonlyArray<Exclude<AiContextSurface, 'all'>>;
  readonly mode: 'online' | 'offline';
  readonly target?: {
    readonly orgAlias: string;
    readonly workspaceId: string;
    readonly principalKind: AiContextPrincipalKind;
    readonly principalId: string;
    readonly agentApiName?: string;
    readonly releaseSetId?: string;
  };
  readonly generatedAt: string;
  readonly expiresAt?: string;
  readonly files: ReadonlyArray<{
    readonly path: string;
    readonly digest: AiContextSha256;
    readonly mediaType: string;
  }>;
}

/**
 * Context lock. `nexusclaw.ai-authoring-context-lock/v2`. Holds the four
 * non-recursive digests plus the detached signature. Online signature is an
 * Ed25519 detached JWS; offline uses `signatureAlgorithm:'none'` and is
 * explicitly non-authoritative.
 *
 * Digest formulas (design §17.1, owned by `canonical-hash.ts`):
 *   contentDigest          = SHA256(sorted <path> NUL <rawFileDigest> LF)
 *   manifestContentDigest  = SHA256(RFC8785(manifest excluding generatedAt/expiresAt))
 *   manifestEnvelopeDigest = SHA256(RFC8785({manifestContentDigest,generatedAt,expiresAt,target}))
 *   lockDigest             = SHA256(RFC8785({contentDigest,manifestContentDigest,manifestEnvelopeDigest}))
 */
export interface AiAuthoringContextLockV2 {
  readonly schemaVersion: typeof AI_AUTHORING_CONTEXT_LOCK_SCHEMA_VERSION;
  readonly contentDigest: AiContextSha256;
  readonly manifestContentDigest: AiContextSha256;
  readonly manifestEnvelopeDigest: AiContextSha256;
  readonly lockDigest: AiContextSha256;
  readonly signatureAlgorithm:
    | typeof AI_CONTEXT_SIGNATURE_ALG_ED25519
    | typeof AI_CONTEXT_SIGNATURE_ALG_NONE;
  readonly keyId?: string;
  readonly signature: string;
}

export interface AiAuthoringContextDigestSetV1 {
  readonly contentDigest: AiContextSha256;
  readonly manifestContentDigest: AiContextSha256;
  readonly manifestEnvelopeDigest: AiContextSha256;
  readonly lockDigest: AiContextSha256;
}

/**
 * Online signature JWS payload (Ed25519 detached). Typ/alg frozen.
 */
export interface AiContextSignatureHeaderV1 {
  readonly alg: typeof AI_CONTEXT_SIGNATURE_ALG_ED25519;
  readonly typ: typeof AI_CONTEXT_SIGNATURE_TYP;
  readonly kid: string;
}

export interface AiContextSignaturePayloadV1 {
  readonly lockDigest: AiContextSha256;
  readonly workspaceId: string;
  readonly principalScopeDigest: AiContextSha256;
  readonly orgAliasClaim: string;
  readonly generatedAt: string;
  readonly expiresAt: string;
}

export interface AiContextSigningPublicJwkV1 {
  readonly kty: 'OKP';
  readonly crv: 'Ed25519';
  readonly x: string;
}

export interface AiContextSigningKeySetV1 {
  readonly schemaVersion: typeof AI_CONTEXT_SIGNING_KEY_SET_SCHEMA_VERSION;
  readonly issuer: string;
  readonly generatedAt: string;
  readonly cacheUntil: string;
  readonly keys: ReadonlyArray<{
    readonly keyId: string;
    readonly alg: typeof AI_CONTEXT_SIGNATURE_ALG_ED25519;
    readonly publicKeyJwk: AiContextSigningPublicJwkV1;
    readonly notBefore: string;
    readonly notAfter: string;
    readonly status: 'active' | 'retiring';
  }>;
}

/** Common pack files — exact path/mediaType matrix lives in design §17.1. */
export interface AiContextCommonFileEntry {
  readonly path: string;
  readonly mediaType: string;
  readonly schemaVersion?: string;
}

/**
 * Exact set of common files every pack must contain (R-15). Surface-specific
 * additions are the closed matrix in design §17.1; `all` is the union, each
 * path once, byte-identical when shared.
 */
export const AI_CONTEXT_COMMON_FILES: ReadonlyArray<AiContextCommonFileEntry> = [
  {
    path: 'context-manifest.json',
    mediaType: 'application/json',
    schemaVersion: AI_AUTHORING_CONTEXT_SCHEMA_VERSION,
  },
  {
    path: 'context-lock.json',
    mediaType: 'application/json',
    schemaVersion: AI_AUTHORING_CONTEXT_LOCK_SCHEMA_VERSION,
  },
  {
    path: 'cli-contract.json',
    mediaType: 'application/json',
    schemaVersion: CLI_COMMAND_REGISTRY_SCHEMA_VERSION,
  },
  {
    path: 'workspace-contract.json',
    mediaType: 'application/json',
    schemaVersion: WORKSPACE_AUTHORING_CONTRACT_SCHEMA_VERSION,
  },
  {
    path: 'authoring/command-order.json',
    mediaType: 'application/json',
    schemaVersion: COMMAND_ORDER_SCHEMA_VERSION,
  },
  { path: 'agent-instructions/codex.md', mediaType: 'text/markdown; charset=utf-8' },
  { path: 'agent-instructions/claude.md', mediaType: 'text/markdown; charset=utf-8' },
  { path: 'agent-instructions/glm-5.2.md', mediaType: 'text/markdown; charset=utf-8' },
  { path: 'agent-instructions/generic.md', mediaType: 'text/markdown; charset=utf-8' },
];

const JSON_SCHEMA_MEDIA_TYPE = 'application/schema+json';
const JSON_MEDIA_TYPE = 'application/json';
const TYPESCRIPT_MEDIA_TYPE = 'text/typescript; charset=utf-8';

/**
 * Closed surface additions from design §17.1. No caller may append a path to
 * this matrix; verified industry overlays are handled by the separate exact
 * installed-digest overlay gate.
 */
export const AI_CONTEXT_SURFACE_FILES: Readonly<
  Record<Exclude<AiContextSurface, 'all'>, ReadonlyArray<AiContextCommonFileEntry>>
> = Object.freeze({
  config: Object.freeze([
    entry('schemas/workspace-authoring-contract-v1.schema.json', JSON_SCHEMA_MEDIA_TYPE, WORKSPACE_AUTHORING_CONTRACT_SCHEMA_VERSION),
    entry('schemas/object-authoring-catalog-v1.schema.json', JSON_SCHEMA_MEDIA_TYPE, OBJECT_AUTHORING_CATALOG_SCHEMA_VERSION),
    entry('catalogs/objects.json', JSON_MEDIA_TYPE, OBJECT_AUTHORING_CATALOG_SCHEMA_VERSION),
  ]),
  code: Object.freeze([
    entry('schemas/code-extension-governance-v2.schema.json', JSON_SCHEMA_MEDIA_TYPE, CODE_EXTENSION_GOVERNANCE_V2),
    entry('schemas/agent-code-tool-catalog-v1.schema.json', JSON_SCHEMA_MEDIA_TYPE, AGENT_CODE_TOOL_CATALOG_SCHEMA_VERSION),
    entry('schemas/code-action-cases-v1.schema.json', JSON_SCHEMA_MEDIA_TYPE, CODE_ACTION_CASES_SCHEMA_VERSION),
    entry('schemas/workforce-runtime-bindings-v1.schema.json', JSON_SCHEMA_MEDIA_TYPE, RUNTIME_BINDINGS_SCHEMA_VERSION),
    entry('schemas/approval-policy-authoring-catalog-v1.schema.json', JSON_SCHEMA_MEDIA_TYPE, APPROVAL_POLICY_AUTHORING_CATALOG_SCHEMA_VERSION),
    entry('authoring/code-sdk.d.ts', TYPESCRIPT_MEDIA_TYPE, RUNTIME_API_VERSION_V2),
    entry('catalogs/objects.json', JSON_MEDIA_TYPE, OBJECT_AUTHORING_CATALOG_SCHEMA_VERSION),
    entry('catalogs/connectors.json', JSON_MEDIA_TYPE, CONNECTOR_AUTHORING_CATALOG_SCHEMA_VERSION),
    entry('catalogs/ai-policies.json', JSON_MEDIA_TYPE, AI_POLICY_AUTHORING_CATALOG_SCHEMA_VERSION),
    entry('catalogs/approval-policies.json', JSON_MEDIA_TYPE, APPROVAL_POLICY_AUTHORING_CATALOG_SCHEMA_VERSION),
    entry('catalogs/invokable-units.json', JSON_MEDIA_TYPE, INVOKABLE_AUTHORING_CATALOG_SCHEMA_VERSION),
    entry('examples/code/minimal-action.ts', TYPESCRIPT_MEDIA_TYPE),
    entry('examples/code/minimal-action.input.schema.json', JSON_SCHEMA_MEDIA_TYPE),
    entry('examples/code/minimal-action.output.schema.json', JSON_SCHEMA_MEDIA_TYPE),
    entry('examples/code/minimal-action.cases.json', JSON_MEDIA_TYPE, CODE_ACTION_CASES_SCHEMA_VERSION),
  ]),
  flow: Object.freeze([
    entry('schemas/flows-payload-v2.schema.json', JSON_SCHEMA_MEDIA_TYPE, FLOWS_PAYLOAD_V2),
    entry('schemas/flow-package-v1.schema.json', JSON_SCHEMA_MEDIA_TYPE, FLOW_PACKAGE_SCHEMA_VERSION),
    entry('schemas/approval-policy-authoring-catalog-v1.schema.json', JSON_SCHEMA_MEDIA_TYPE, APPROVAL_POLICY_AUTHORING_CATALOG_SCHEMA_VERSION),
    entry('authoring/flow-node-catalog.json', JSON_MEDIA_TYPE, FLOW_NODE_CATALOG_SCHEMA_VERSION),
    entry('catalogs/objects.json', JSON_MEDIA_TYPE, OBJECT_AUTHORING_CATALOG_SCHEMA_VERSION),
    entry('catalogs/approval-policies.json', JSON_MEDIA_TYPE, APPROVAL_POLICY_AUTHORING_CATALOG_SCHEMA_VERSION),
    entry('catalogs/invokable-units.json', JSON_MEDIA_TYPE, INVOKABLE_AUTHORING_CATALOG_SCHEMA_VERSION),
    entry('examples/flow/minimal-manual-flow.json', JSON_MEDIA_TYPE, FLOWS_PAYLOAD_V2),
  ]),
  employee: Object.freeze([
    entry('schemas/employee-package-v2.schema.json', JSON_SCHEMA_MEDIA_TYPE, EMPLOYEE_PACKAGE_V2_SCHEMA_VERSION),
    entry('schemas/ai-workforce-executable-bundle-v1.schema.json', JSON_SCHEMA_MEDIA_TYPE, BUNDLE_SCHEMA_VERSION),
    entry('schemas/workforce-runtime-bindings-v1.schema.json', JSON_SCHEMA_MEDIA_TYPE, RUNTIME_BINDINGS_SCHEMA_VERSION),
    entry('schemas/workforce-bundle-lock-v1.schema.json', JSON_SCHEMA_MEDIA_TYPE, BUNDLE_LOCK_SCHEMA_VERSION),
    entry('schemas/workforce-release-evidence-v1.schema.json', JSON_SCHEMA_MEDIA_TYPE, WORKFORCE_RELEASE_EVIDENCE_SCHEMA_VERSION),
    entry('schemas/approval-policy-authoring-catalog-v1.schema.json', JSON_SCHEMA_MEDIA_TYPE, APPROVAL_POLICY_AUTHORING_CATALOG_SCHEMA_VERSION),
    entry('catalogs/objects.json', JSON_MEDIA_TYPE, OBJECT_AUTHORING_CATALOG_SCHEMA_VERSION),
    entry('catalogs/connectors.json', JSON_MEDIA_TYPE, CONNECTOR_AUTHORING_CATALOG_SCHEMA_VERSION),
    entry('catalogs/ai-policies.json', JSON_MEDIA_TYPE, AI_POLICY_AUTHORING_CATALOG_SCHEMA_VERSION),
    entry('catalogs/approval-policies.json', JSON_MEDIA_TYPE, APPROVAL_POLICY_AUTHORING_CATALOG_SCHEMA_VERSION),
    entry('catalogs/invokable-units.json', JSON_MEDIA_TYPE, INVOKABLE_AUTHORING_CATALOG_SCHEMA_VERSION),
  ]),
});

/** Resolve common + selected additions, de-duplicated and lexical by path. */
export function resolveAiContextFileMatrix(
  surface: AiContextSurface,
): ReadonlyArray<AiContextCommonFileEntry> {
  const selected =
    surface === 'all'
      ? (['config', 'code', 'flow', 'employee'] as const)
      : [surface];
  const byPath = new Map<string, AiContextCommonFileEntry>();
  for (const candidate of [
    ...AI_CONTEXT_COMMON_FILES,
    ...selected.flatMap((key) => AI_CONTEXT_SURFACE_FILES[key]),
  ]) {
    const existing = byPath.get(candidate.path);
    if (
      existing &&
      (existing.mediaType !== candidate.mediaType ||
        existing.schemaVersion !== candidate.schemaVersion)
    ) {
      throw new Error(`AI_CONTEXT_FILE_MATRIX_COLLISION:${candidate.path}`);
    }
    byPath.set(candidate.path, Object.freeze({ ...candidate }));
  }
  return Object.freeze(
    [...byPath.values()].sort((left, right) =>
      left.path.localeCompare(right.path),
    ),
  );
}

/** Manifest file rows exclude the two self-referential envelope documents. */
export function resolveAiContextManifestFileMatrix(
  surface: AiContextSurface,
): ReadonlyArray<AiContextCommonFileEntry> {
  return Object.freeze(
    resolveAiContextFileMatrix(surface).filter(
      ({ path }) =>
        path !== 'context-manifest.json' &&
        path !== 'context-lock.json',
    ),
  );
}

/**
 * Enforce the closed core matrix. Industry overlay paths are intentionally
 * rejected here and enter only through the installed-digest overlay gate.
 */
export function assertAiContextDeclaredPaths(
  surface: AiContextSurface,
  paths: readonly string[],
): void {
  const expected = resolveAiContextFileMatrix(surface).map(({ path }) => path);
  const actual = [...paths].sort();
  const duplicates = actual.filter(
    (path, index) => index > 0 && path === actual[index - 1],
  );
  if (
    duplicates.length > 0 ||
    actual.length !== expected.length ||
    actual.some((path, index) => path !== expected[index])
  ) {
    const unexpected = actual.filter((path) => !expected.includes(path));
    const missing = expected.filter((path) => !actual.includes(path));
    throw new Error(
      `AI_CONTEXT_FILE_MATRIX_INVALID:${JSON.stringify({
        duplicates: [...new Set(duplicates)],
        missing,
        unexpected,
      })}`,
    );
  }
}

function entry(
  path: string,
  mediaType: string,
  schemaVersion?: string,
): AiContextCommonFileEntry {
  return Object.freeze({
    path,
    mediaType,
    ...(schemaVersion ? { schemaVersion } : {}),
  });
}
