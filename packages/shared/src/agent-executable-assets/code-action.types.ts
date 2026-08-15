/**
 * Action handler ABI, tool catalog descriptor and runtime SDK contracts.
 *
 * Every field here is frozen by executable-asset design §6.2 (catalog/export),
 * §7.1 (ABI), §8.1-8.5 (SDK) and §10.3 (descriptor checksum). Do not rename,
 * retype or add fields without a contract-version change. The backend and CLI
 * MUST import these types from `@nexusclaw/shared` and MUST NOT redeclare them.
 */
import type { JsonValue } from './json-value';
import {
  ACTION_CONTRACT_VERSION,
  AGENT_CODE_TOOL_EXPORT_SCHEMA_VERSION,
  RUNTIME_API_VERSION_V2,
  VERIFIED_ISOLATE_PROVIDER_ID,
} from './contract-versions';

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

// ---- SDK: principal & context (design §8.1) --------------------------------

export interface CodeActionPrincipalV1 {
  readonly workspaceId: string;
  readonly agentId: string;
  readonly agentVersionId: string;
  readonly serviceIdentityId: string;
  readonly roleId: string;
  readonly orgNodeId?: string;
  readonly triggeredByUserId?: string;
  readonly executionKind: 'agent' | 'flow';
  readonly executionId: string;
  readonly releaseSetId: string;
  readonly traceId: string;
  readonly correlationId: string;
}

/**
 * The frozen host-injected facade exposed inside the verified isolate. Legacy
 * runtime/v1 namespaces (`http`/`email`/`events`) NEVER appear on v1 actions
 * (design §1.4, §8). Only records/connectors/ai/clock/limits/logger cross.
 */
export interface CodeActionContextV1 {
  readonly principal: CodeActionPrincipalV1;
  readonly records: CodeRecordsV1;
  readonly connectors: CodeConnectorsV1;
  readonly ai: CodeAiV1;
  readonly clock: { readonly executionStartedAt: string };
  readonly limits: CodeLimitsV1;
  readonly logger: CodeLoggerV1;
}

/** The single v1 handler ABI: default export assignable to this. */
export type CodeAction<TInput extends JsonValue, TOutput extends JsonValue> = (
  ctx: CodeActionContextV1,
  input: TInput,
) => Promise<TOutput>;

// ---- SDK: records (design §8.2) ---------------------------------------------

export type RecordScalar = string | number | boolean | null;

export type RecordFilterV1 =
  | { op: 'and' | 'or'; filters: RecordFilterV1[] }
  | {
      op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
      field: string;
      value: RecordScalar;
    }
  | { op: 'in' | 'not_in'; field: string; values: RecordScalar[] }
  | {
      op: 'contains' | 'starts_with' | 'ends_with';
      field: string;
      value: string;
    }
  | { op: 'is_null' | 'is_not_null'; field: string };

export interface CodeRecordsV1 {
  get(args: {
    objectApiName: string;
    recordId: string;
    select: string[];
  }): Promise<{
    id: string;
    version: number;
    values: Record<string, JsonValue>;
  } | null>;
  query(args: {
    objectApiName: string;
    select: string[];
    where?: RecordFilterV1;
    orderBy?: ReadonlyArray<{
      field: string;
      direction: 'asc' | 'desc';
      nulls: 'first' | 'last';
    }>;
    first: number;
    after?: string;
  }): Promise<{
    nodes: ReadonlyArray<{
      id: string;
      version: number;
      values: Record<string, JsonValue>;
    }>;
    pageInfo: { endCursor?: string; hasNextPage: boolean };
  }>;
  create(args: {
    objectApiName: string;
    values: Record<string, JsonValue>;
  }): Promise<{ id: string; version: number }>;
  update(args: {
    objectApiName: string;
    recordId: string;
    values: Record<string, JsonValue>;
    expectedVersion: number;
  }): Promise<{ id: string; version: number }>;
  delete(args: {
    objectApiName: string;
    recordId: string;
    expectedVersion: number;
  }): Promise<{ id: string; recycled: true }>;
}

// ---- SDK: connectors (design §8.3) ------------------------------------------

export interface CodeConnectorsV1 {
  call<TInput extends JsonValue, TOutput extends JsonValue>(args: {
    bindingKey: string;
    operation: string;
    input: TInput;
  }): Promise<{
    data: TOutput;
    operationId: string;
    status: 'succeeded';
  }>;
}

// ---- SDK: AI (design §8.4) --------------------------------------------------

export interface CodeAiGenerateUsageV1 {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cost: {
    readonly amount: DecimalMoneyAmount;
    readonly currency: CurrencyCode;
    readonly pricingVersion: PricingVersion;
  };
}

export interface CodeAiGenerateResultV1<T extends JsonValue> {
  readonly data: T;
  readonly modelAlias: string;
  readonly usage: CodeAiGenerateUsageV1;
  readonly invocationId: string;
  readonly providerStamp: {
    readonly providerClass: string;
    readonly routePolicyRevisionId: string;
    readonly fallbackIndex: number;
  };
}

export interface CodeAiV1 {
  generate<T extends JsonValue>(args: {
    policyKey: string;
    input: JsonValue;
    outputSchemaRef: string;
    maxOutputTokens?: number;
  }): Promise<CodeAiGenerateResultV1<T>>;
}

// ---- SDK: logger & limits (design §8.5) -------------------------------------

export interface CodeLoggerV1 {
  debug(event: string, fields?: Record<string, JsonValue>): void;
  info(event: string, fields?: Record<string, JsonValue>): void;
  warn(event: string, fields?: Record<string, JsonValue>): void;
  error(event: string, fields?: Record<string, JsonValue>): void;
}

export interface CodeLimitsV1 {
  getUsage(): Readonly<Record<string, number>>;
  getLimit(): Readonly<Record<string, number>>;
}

// ---- Re-exported version literals for convenience ---------------------------

export {
  ACTION_CONTRACT_VERSION,
  RUNTIME_API_VERSION_V2,
  VERIFIED_ISOLATE_PROVIDER_ID,
};
