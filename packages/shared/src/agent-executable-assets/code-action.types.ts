/**
 * Tool catalog descriptor and resolved-tool contracts (Community subset).
 *
 * Every field here is frozen by executable-asset design §6.2 (catalog/export)
 * and §10.3 (descriptor checksum). Do not rename, retype or add fields without
 * a contract-version change. The backend MUST import these types from
 * `@nexusclaw/shared` and MUST NOT redeclare them.
 *
 * The verified-isolate SDK surface (principal/context facade, records/
 * connectors/AI/logger bindings) is NOT part of the Community edition — see
 * ROADMAP.md.
 */
import type { JsonValue } from './json-value';

// ---- Frozen version literals --------------------------------------------------
// Single source of the schema/provider ids referenced by the contracts below.

export const AGENT_CODE_TOOL_EXPORT_SCHEMA_VERSION = 'agent-code-tool/v1' as const;
export const ACTION_CONTRACT_VERSION = 'nexus-code-action/v1' as const;
export const RUNTIME_API_VERSION_V2 = 'runtime/v2' as const;
export const VERIFIED_ISOLATE_PROVIDER_ID =
  'nexusclaw-verified-isolate-v1' as const;

// ---- Decimal money (design §6.2 / §8.4) -------------------------------------

/**
 * Canonical decimal amount as a string. Regex `0|[1-9][0-9]*(\.[0-9]{1,9})?`
 * — no float money, no leading zeros, no exponent.
 */
export type DecimalMoneyAmount = string;

/** ISO-4217 uppercase currency code. */
export type CurrencyCode = string;

/** Pricing version stamp; required on every AI cost return (design §8.4). */
export type PricingVersion = string;

// ---- Risk & capability enums (design §6.2, R-10) ----------------------------

export type ActionRiskLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
export type SideEffectMode =
  | 'pure'
  | 'read_only'
  | 'idempotent_write'
  | 'side_effecting';

/** Records CRUD operations a capability may declare. */
export type RecordsOperation = 'read' | 'create' | 'update' | 'delete';

// ---- Tool catalog (design §6.2) ---------------------------------------------

/**
 * One Agent/Flow-callable export in a code-extension package. Frozen as
 * `agent-code-tool/v1`. Fields enter the descriptor/source lock checksums.
 */
export interface AgentCodeToolExportV1 {
  readonly contractVersion: typeof AGENT_CODE_TOOL_EXPORT_SCHEMA_VERSION;
  readonly actionContractVersion: typeof ACTION_CONTRACT_VERSION;
  /** Stable export identifier; resolves to `extensionId` in the manifest. */
  readonly exportId: string;
  /** Manifest `executableArtifacts[].extensionId` this export binds to. */
  readonly artifactRef: string;
  /** Granular tool name `custom.<namespace>.<action>`. */
  readonly toolName: `custom.${string}.${string}`;
  readonly description: string;
  /** Package-local input schema ref (Draft 2020-12). */
  readonly inputSchemaRef: string;
  /** Package-local output schema ref (Draft 2020-12). */
  readonly outputSchemaRef: string;
  readonly sideEffectMode: SideEffectMode;
  readonly declaredRiskLevel: ActionRiskLevel;
  readonly capabilities: {
    readonly records: ReadonlyArray<{
      readonly objectApiName: string;
      readonly operations: ReadonlyArray<RecordsOperation>;
      readonly readFields?: ReadonlyArray<string>;
      readonly writeFields?: ReadonlyArray<string>;
    }>;
    readonly connectors: ReadonlyArray<{
      readonly bindingKey: string;
      readonly operations: ReadonlyArray<string>;
    }>;
    readonly ai: ReadonlyArray<{
      readonly policyKey: string;
      readonly outputSchemaRef: string;
    }>;
  };
  readonly limits: {
    readonly timeoutMs: number;
    readonly memoryMb: 128;
    readonly maxQueries: number;
    readonly maxDmlStatements: number;
    readonly maxDmlRows: number;
    readonly maxCallouts: number;
    readonly maxAiCalls: number;
    readonly maxAiInputTokens: number;
    readonly maxAiOutputTokens: number;
    readonly maxAiCost: {
      readonly amount: DecimalMoneyAmount;
      readonly currency: CurrencyCode;
    };
    readonly maxLogEntries: number;
    readonly maxLogBytes: number;
    readonly maxAttempts: 1;
  };
  readonly idempotency?: {
    readonly inputJsonPointer: string;
    readonly windowSeconds: 86400;
  };
  readonly redaction: {
    readonly inputJsonPointers: ReadonlyArray<string>;
    readonly outputJsonPointers: ReadonlyArray<string>;
    readonly logPolicy: 'metadata_only' | 'redacted_payload';
  };
  readonly tests: ReadonlyArray<{
    readonly path: string;
    readonly required: true;
  }>;
}

/**
 * Sidecar catalog referenced by manifest `agentToolCatalogPath`. Frozen as
 * `agent-code-tool-catalog/v1`. Export array order is normalised by exportId
 * before any digest (design §10.3).
 */
export interface AgentCodeToolCatalogV1 {
  readonly schemaVersion: 'agent-code-tool-catalog/v1';
  readonly packageName: string;
  readonly packageVersion: string;
  readonly exports: ReadonlyArray<AgentCodeToolExportV1>;
}

/**
 * Runtime composition of an export with release/revision/provider stamps. Adds
 * NO export fields — it composes {@link AgentCodeToolExportV1} (design §5.6,
 * §6.2). This is the workspace-scoped descriptor resolved by ToolRegistry.
 */
export interface ResolvedAgentExecutableToolV1 {
  readonly sourceWorkspaceId: string;
  readonly executionWorkspaceId: string;
  readonly releaseSetId: string;
  readonly functionRevisionId: string;
  readonly sourceHash: `sha256:${string}`;
  readonly compiledHash: `sha256:${string}`;
  readonly descriptorHash: `sha256:${string}`;
  readonly publishedChecksum: `sha256:${string}`;
  readonly runtimeProviderId: typeof VERIFIED_ISOLATE_PROVIDER_ID;
  readonly exportDescriptor: Readonly<AgentCodeToolExportV1>;
}
