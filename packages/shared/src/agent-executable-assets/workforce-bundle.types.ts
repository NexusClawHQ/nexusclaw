/**
 * Composite workforce executable bundle & runtime bindings contracts.
 *
 * Frozen verbatim from executable-asset design §5.1 (source bundle) and §5.2
 * (runtime bindings). The bundle is the source composite surface; bindings are
 * the environment overlay. Neither contains source code, secrets, URLs, or
 * credential material (R-01).
 */
import {
  BUNDLE_SCHEMA_VERSION,
  RUNTIME_BINDINGS_SCHEMA_VERSION,
} from './contract-versions';
import type { ActionRiskLevel } from './code-action.types';

/**
 * Source composite bundle. `ai-workforce-executable-bundle/v1`.
 *
 * Identity rules (design §5.1):
 * - exactly one `agentApiName`, MUST exactly equal Employee Package
 *   `agent.apiName`; every `toolBindings[].agentApiName` and
 *   `flowBindings[].agentApiName` MUST equal it; no `employeeKey`/`agentKey`/
 *   `packageKey`/`topicKey` alias is accepted.
 * - `version`/package versions are exact semver — no range/tag/latest.
 * - `minimumSimulationPassRate` is the literal JSON number `1`.
 * - executable Flow containing `INVOKE_UNIT` MUST have a `flowBindings[]` entry
 *   with `principalMode:'bound_agent'`.
 */
export interface AiWorkforceExecutableBundleV1 {
  readonly schemaVersion: typeof BUNDLE_SCHEMA_VERSION;
  readonly name: string;
  /** Exact semver. */
  readonly version: string;
  /** Exactly one Employee Package agent.apiName; the bundle's identity. */
  readonly agentApiName: string;
  readonly employeePackage: {
    readonly path: string;
    readonly employeePackageName: string;
    /** Explicit immutable candidate-eval asset; never inferred from name/head. */
    readonly evalCasesPath: string;
  };
  readonly codePackages: ReadonlyArray<{
    readonly path: string;
    readonly packageName: string;
    readonly packageVersion: string;
  }>;
  readonly flowPackages: ReadonlyArray<{
    readonly path: string;
    readonly packageName: string;
    readonly packageVersion: string;
  }>;
  readonly toolBindings: ReadonlyArray<{
    readonly employeeToolBindingId: string;
    readonly agentApiName: string;
    readonly topicId: string;
    readonly toolName: `custom.${string}.${string}`;
    readonly codeExport: {
      readonly packageName: string;
      readonly packageVersion: string;
      readonly exportId: string;
    };
  }>;
  readonly flowBindings: ReadonlyArray<{
    readonly flowApiName: string;
    readonly flowPackageName: string;
    readonly agentApiName: string;
    readonly principalMode: 'bound_agent';
    readonly bindingRiskLevel: Exclude<ActionRiskLevel, 'L4'>;
  }>;
  readonly requiredRuntimeBindings: ReadonlyArray<{
    readonly bindingKey: string;
    readonly kind: 'connector' | 'ai_policy';
  }>;
  readonly releasePolicy: {
    readonly requireCandidateTests: true;
    readonly requireRegressionBaseline: true;
    readonly requireHumanApproval: true;
    readonly workforceReleaseApprovalPolicyApiName: string;
    readonly defaultToolApprovalPolicyApiName: string;
    readonly minimumSimulationPassRate: 1;
    readonly mutationPolicy: 'sandbox-only';
  };
}

/**
 * Portable runtime bindings overlay. `workforce-runtime-bindings/v1`.
 * Maps stable `bindingKey` to workspace resource apiName only — never to id,
 * URL, token, header, certificate bytes, or provider key. The server resolves
 * within the authenticated workspace and writes the resolved snapshot to the
 * lock (design §5.2).
 */
export interface WorkforceRuntimeBindingsV1 {
  readonly schemaVersion: typeof RUNTIME_BINDINGS_SCHEMA_VERSION;
  readonly targetOrgAlias: string;
  readonly bindings: ReadonlyArray<
    | {
        readonly bindingKey: string;
        readonly kind: 'connector';
        readonly connectorApiName: string;
      }
    | {
        readonly bindingKey: string;
        readonly kind: 'ai_policy';
        readonly policyKey: string;
      }
  >;
}
