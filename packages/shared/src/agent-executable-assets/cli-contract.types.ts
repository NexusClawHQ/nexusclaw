/**
 * CLI machine command-contract, execution-mode and result types.
 *
 * Frozen by executable-asset design §16.1 (command metadata / modes) and §16.2
 * (machine result). Human `--help`, machine `ai help --json`, scaffold and
 * validators are all generated from ONE command-contract registry (R-14). The
 * registry is owned by the CLI package; these types are the shared import
 * surface consumed by backend guard parity checks as well.
 */
import {
  CLI_COMMAND_CONTRACT_SCHEMA_VERSION,
  CLI_COMMAND_CONTRACT_SCHEMA_VERSION_V2,
  CLI_RESULT_SCHEMA_VERSION,
} from './contract-versions';
import type { JsonValue } from './json-value';

// ---- Stable exit codes (design §20 / R-17) ---------------------------------

export type CliExitCode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 64 | 70;

// ---- argv predicate AST (design §16.1) -------------------------------------

export type CliArgvSchemaMatcher = 'uuid' | 'sha256' | 'positive_integer';

export type CliArgvPredicateAtomV1 =
  | { kind: 'option_present' | 'option_absent'; option: string }
  | {
      kind: 'option_equals';
      option: string;
      value: string | number | boolean;
    }
  | {
      kind: 'option_matches_schema';
      option: string;
      matcher: CliArgvSchemaMatcher;
    }
  | { kind: 'exactly_one' | 'none_of'; options: string[] };

export type CliArgvPredicateExprV1 =
  | CliArgvPredicateAtomV1
  | { kind: 'all_of' | 'any_of'; expressions: CliArgvPredicateExprV1[] }
  | { kind: 'not'; expression: CliArgvPredicateExprV1 };

// ---- permission facts & rules (design §16.1) -------------------------------

export type CliPermissionFactV1 =
  | 'surface_contains_flow'
  | 'verified_context_contains_flow'
  | 'safe_bundle_inventory_contains_flow'
  | 'direct_flow_selector'
  | 'authoritative_candidate_contains_flow'
  | 'authoritative_transition_contains_flow';

export interface CliPermissionRuleV1 {
  readonly when: 'always' | CliPermissionFactV1;
  readonly require: ReadonlyArray<{ capability: string; action: string }>;
}

/** Exact permission profile enum (design §16.1). */
export type CliPermissionProfileId =
  | 'LOCAL'
  | 'CONTEXT_READ'
  | 'BUNDLE_READ'
  | 'CANDIDATE_TEST'
  | 'BUNDLE_STAGE'
  | 'BUNDLE_GATE'
  | 'BUNDLE_PROMOTE'
  | 'BUNDLE_REVOKE'
  // Workforce training/governance plane — independent of the bundle release
  // DAG. These cover the `nexus workforce *` commands (learning loops, config
  // writes, cognition, ops, orchestration, observation) which use a different
  // permission vocabulary (system read/create/update/delete, capability
  // ai.manage execute/update/publish) and are NOT gated by `requiresCanDevelop`.
  | 'WORKFORCE_READ'
  | 'WORKFORCE_EXECUTE'
  | 'WORKFORCE_WRITE'
  | 'WORKFORCE_PUBLISH';

/** Exact effect enum; `['none']` cannot coexist with another effect. */
export type CliEffectKind =
  | 'none'
  | 'local_write'
  | 'remote_read'
  | 'remote_compute'
  | 'remote_write'
  | 'promote';

// ---- command/mode contracts (design §16.1) ---------------------------------

export interface CliArgumentContract {
  readonly name: string;
  readonly required: boolean;
  readonly description: string;
}

export interface CliOptionContract {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
  readonly default?: boolean;
}

export interface CliExecutionModeV1 {
  readonly modeId: string;
  readonly when: CliArgvPredicateExprV1;
  readonly auth: 'none' | 'org';
  readonly effects: ReadonlyArray<CliEffectKind>;
  readonly permissionProfileId: CliPermissionProfileId;
  readonly permissionRules: ReadonlyArray<CliPermissionRuleV1>;
  readonly requiresCanDevelop: boolean;
  readonly requiresStepUp: boolean;
  readonly requiresIdempotencyKey: boolean;
  readonly availability: 'planned' | 'implemented' | 'disabled';
  readonly implementationId: string | null;
}

export interface CliCommandContractV1 {
  readonly schemaVersion: typeof CLI_COMMAND_CONTRACT_SCHEMA_VERSION;
  readonly commandId: string;
  readonly path: string;
  readonly aliases: ReadonlyArray<string>;
  readonly summary: string;
  readonly arguments: ReadonlyArray<CliArgumentContract>;
  readonly options: ReadonlyArray<CliOptionContract>;
  readonly inputSchemaRefs: ReadonlyArray<string>;
  readonly outputSchemaRef: string;
  readonly executionModes: ReadonlyArray<CliExecutionModeV1>;
  readonly exitCodes: ReadonlyArray<CliExitCode>;
  readonly examples: ReadonlyArray<{
    readonly argv: ReadonlyArray<string>;
    readonly purpose: string;
    readonly modeId: string;
  }>;
  readonly nextCommands: ReadonlyArray<{
    readonly commandId: string;
    readonly whenModeIds: ReadonlyArray<string>;
    readonly authorization: 'none' | 'explicit_user';
  }>;
  readonly contractCompleteness: 'complete' | 'derived' | 'partial';
}

// ---- complete command framework contracts (productization v2) -------------

export type CliOutputModeV2 = 'human' | 'machine' | 'dual';
export type CliMutabilityV2 = 'read-only' | 'local-write' | 'remote-write';

export interface CliDryRunExemptionV2 {
  readonly owner: string;
  readonly reason: string;
  readonly exitCriteria: string;
  /** ISO-8601 calendar date. An expired exemption fails the CLI owner gate. */
  readonly expiresOn: string;
}

export interface CliInvocationPolicyV2 {
  readonly outputMode: CliOutputModeV2;
  readonly mutability: CliMutabilityV2;
  readonly supportsDryRun: boolean;
  readonly dryRunExemption?: CliDryRunExemptionV2;
  readonly environmentOption: '--env' | null;
  readonly environmentAliases: ReadonlyArray<string>;
  readonly workspaceOption: '--workspace-id' | null;
  readonly localWorkspaceOption: '--workspace' | null;
  readonly exitCodes: {
    readonly success: ReadonlyArray<CliExitCode>;
    readonly warning: ReadonlyArray<CliExitCode>;
    readonly error: ReadonlyArray<CliExitCode>;
  };
}

export interface CliExecutionModeV2 extends CliExecutionModeV1 {
  readonly invocationPolicy: CliInvocationPolicyV2;
}

/**
 * v2 covers every executable Commander leaf. v1 stays frozen for consumers of
 * the original executable-asset subset; callers must never treat a partial
 * v1-to-v2 projection as satisfying the completeness gate.
 */
export interface CliCommandContractV2
  extends Omit<CliCommandContractV1, 'schemaVersion' | 'executionModes'> {
  readonly schemaVersion: typeof CLI_COMMAND_CONTRACT_SCHEMA_VERSION_V2;
  readonly executionModes: ReadonlyArray<CliExecutionModeV2>;
}

// ---- machine result envelope (design §16.2 / R-17) -------------------------

export interface CliDiagnosticV1 {
  readonly code: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly phase: string;
  readonly artifactId?: string;
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  readonly jsonPath?: string;
  readonly ruleId?: string;
  readonly message: string;
  readonly fixHint?: string;
  readonly retryable: boolean;
  readonly docsRef?: string;
}

export interface CliNextCommandV1 {
  readonly command: string;
  readonly reason: string;
  readonly authorization: 'none' | 'explicit_user';
  readonly requiresReleaseApproval: boolean;
}

export interface CliEvidenceEntryV1 {
  readonly kind: string;
  readonly id?: string;
  readonly path?: string;
  readonly digest?: string;
}

/**
 * The single `--json` stdout document. JSON mode forbids spinner/color/banner
 * or human prose on stdout; stderr must be empty after the JSON renderer is
 * established. Exit precedence when multiple diagnostics: 70 > 3 > 2 > 4 > 5 >
 * 6 > 1.
 */
export interface CliResultV1<T extends JsonValue = JsonValue> {
  readonly schemaVersion: typeof CLI_RESULT_SCHEMA_VERSION;
  readonly ok: boolean;
  readonly exitCode: CliExitCode;
  readonly command: string;
  readonly phase: string;
  readonly contractVersion: string;
  readonly data: T | null;
  readonly diagnostics: ReadonlyArray<CliDiagnosticV1>;
  readonly evidence: ReadonlyArray<CliEvidenceEntryV1>;
  readonly nextCommands: ReadonlyArray<CliNextCommandV1>;
}
