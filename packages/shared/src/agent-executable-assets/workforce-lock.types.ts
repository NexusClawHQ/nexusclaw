/**
 * Server-generated workforce bundle lock. `workforce-bundle.lock/v1`.
 *
 * Frozen verbatim from executable-asset design §5.3. The lock is NEVER
 * hand-written or edited by a model. It locks employee + code packages + Flow
 * semantic revision key + prompt/policy + tool descriptor + runtime provider /
 * policy + content-addressed release item set + rollback target, all in one
 * content-addressed document. Test/approval evidence does NOT write back to the
 * source lock; it forms a separate immutable evidence aggregate and release
 * envelope.
 *
 * `sourceLockDigest` covers every field below EXCEPT itself; array sort keys
 * are fixed as package name/version, exportId, flowApiName, bindingKey,
 * policyKey, and (purpose, policyApiName). See design §5.3 / §10.3 for the
 * exact digest formulas, owned by `canonical-hash.ts`.
 */
import { BUNDLE_LOCK_SCHEMA_VERSION } from './contract-versions';
import type { ActionRiskLevel } from './code-action.types';

/** SHA-256 digest, lowercase `sha256:<64 hex>`. */
export type Sha256Digest = `sha256:${string}`;

/**
 * Generated source lock. `previousReleaseSetId` is optional (absent on first
 * release). All hashes are content-addressed and derivable before any database
 * row exists, so dry-run and stage produce identical digests (R-01.9).
 */
export interface WorkforceBundleSourceLockV1 {
  readonly schemaVersion: typeof BUNDLE_LOCK_SCHEMA_VERSION;
  readonly bundleName: string;
  readonly bundleVersion: string;
  readonly portableBundleDigest: Sha256Digest;
  readonly releaseItemSetDigest: Sha256Digest;
  readonly target: {
    readonly orgAlias: string;
    readonly workspaceId: string;
    readonly workspaceContractHash: Sha256Digest;
  };
  readonly employee: {
    readonly employeePackageName: string;
    readonly agentApiName: string;
    readonly digest: Sha256Digest;
  };
  readonly codePackages: ReadonlyArray<{
    readonly packageName: string;
    readonly packageVersion: string;
    readonly packageDigest: Sha256Digest;
    readonly exports: ReadonlyArray<{
      readonly exportId: string;
      readonly toolName: string;
      readonly sourceHash: Sha256Digest;
      readonly compiledHash: Sha256Digest;
      readonly inputSchemaHash: Sha256Digest;
      readonly outputSchemaHash: Sha256Digest;
      readonly descriptorHash: Sha256Digest;
      readonly publishedChecksum: Sha256Digest;
      readonly runtimeApiVersion: 'runtime/v2';
      readonly runtimeProviderId: 'nexusclaw-verified-isolate-v1';
      readonly compilerVersion: string;
      readonly compilerOptionsHash: Sha256Digest;
      readonly sdkDeclarationHash: Sha256Digest;
      readonly actionContractVersion: 'nexus-code-action/v1';
    }>;
  }>;
  readonly flows: ReadonlyArray<{
    readonly flowApiName: string;
    readonly flowRevisionKey: Sha256Digest;
    readonly definitionHash: Sha256Digest;
  }>;
  readonly runtimeBindings: ReadonlyArray<{
    readonly bindingKey: string;
    readonly kind: 'connector';
    readonly connectorInstanceId: string;
    readonly connectorApiName: string;
    readonly connectorType: string;
    readonly connectorConfigHash: Sha256Digest;
    readonly namedCredentialId: string;
    readonly namedCredentialApiName: string;
    readonly credentialType: 'OAUTH2' | 'API_KEY' | 'BASIC_AUTH';
    readonly bindingRevisionKey: Sha256Digest;
  }>;
  readonly aiPolicies: ReadonlyArray<{
    readonly policyKey: string;
    readonly policyRevisionKey: Sha256Digest;
    readonly promptTemplateVersion: string;
    readonly policyHash: Sha256Digest;
  }>;
  readonly approvalPolicies: ReadonlyArray<{
    readonly policyApiName: string;
    readonly purpose: 'tool_call' | 'workforce_release';
    readonly revisionKey: Sha256Digest;
    readonly checksum: Sha256Digest;
  }>;
  readonly previousReleaseSetId?: string;
  readonly sourceLockDigest: Sha256Digest;
}

/** Lifted from bundle; v1 forbids L4 on Flow invocation. */
export type FlowBindingRiskLevel = Exclude<ActionRiskLevel, 'L4'>;
