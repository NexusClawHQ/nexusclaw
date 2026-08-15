/**
 * Flow payload/v2 contracts. `payload/v2`.
 *
 * Frozen by executable-asset design §15.1-15.4. v2 is a SEPARATE envelope — it
 * does NOT extend the frozen `payload/v1` union. v1 stays compatible; v2 adds
 * the `INVOKE_UNIT` engine-native ACTION setting and the `invoke_action` rule
 * sugar that compiles to it. Real execution wiring is fixed as
 * `FlowExecutionEngine → ActionNodeExecutor → InvokableActionNodeExecutorService
 * → ToolRegistry` (design §3.6, R-11.13).
 */
import { FLOWS_PAYLOAD_V2, APPROVAL_SUBJECT_DECIDED_EVENT } from './contract-versions';
import type { JsonValue } from './json-value';
import type { ActionRiskLevel } from './code-action.types';

/** Frozen payload envelope discriminator. */
export const FLOW_PAYLOAD_V2_VERSION = FLOWS_PAYLOAD_V2;

/** Engine-native ACTION setting kind. */
export type FlowActionTypeV2 = 'INVOKE_UNIT';

/**
 * ACTION setting added in v2. `actionType: INVOKE_UNIT` resolves
 * `action:<toolName>` to an exact candidate/active descriptor — never to a
 * function id or "current name". Input mappings are declarative context-path /
 * literal mappings; output writes to exactly one `outputVariableName`.
 */
export interface FlowInvokeUnitActionSettingV2 {
  readonly actionType: 'INVOKE_UNIT';
  /** `action:<toolName>`; resolves to exact descriptor. */
  readonly unitId: `action:${string}`;
  readonly inputMappings: ReadonlyArray<FlowInputMappingV2>;
  readonly outputVariableName: string;
  readonly onError: 'fail' | 'fault_path';
  readonly faultEdgeHandle?: 'fault';
}

/**
 * Declarative input mapping. Canonical RFC 6901 targets; duplicate targets and
 * ancestor/descendant overlap are rejected at compile (design §15.2, R-11.13).
 */
export interface FlowInputMappingV2 {
  readonly targetJsonPointer: string;
  readonly source:
    | { readonly kind: 'context_path'; readonly path: string }
    | { readonly kind: 'literal'; readonly value: JsonValue };
}

/** Error policy: `fail` or follow exactly one explicit `fault` edge. */
export type FlowErrorPolicyV2 =
  | { readonly kind: 'fail' }
  | { readonly kind: 'fault_path'; readonly faultEdgeId: string };

/** Fault marker written to the step log on failure; redacted, follows one edge. */
export interface FlowFaultMarkerV2 {
  readonly $fault: {
    readonly code: string;
    readonly message: string;
    readonly toolCallId: string | null;
    readonly failedNodeId: string;
  };
}

/** Rule-sugar action type that compiles to `INVOKE_UNIT` (design §15.3). */
export type FlowRuleSugarActionTypeV2 = 'invoke_action';

/**
 * Immutable Flow revision identity. The source lock uses the content-addressed
 * `flowRevisionKey + definitionHash`; stage materialises to the exact
 * `WorkflowVersion.id`. Mutable version display name is NOT identity.
 */
export interface FlowRevisionIdentityV1 {
  readonly flowApiName: string;
  readonly flowRevisionKey: `sha256:${string}`;
  readonly definitionHash: `sha256:${string}`;
  readonly workflowVersionId?: string;
}

/** WorkflowVersion v2 lifecycle (design §11.5, R-11.12). */
export type WorkflowVersionLifecycleStatus =
  | 'DRAFT'
  | 'CANDIDATE'
  | 'RELEASED'
  | 'ACTIVE';

/**
 * Approval subject decision outbox event. Fixed as
 * `approval.subject.decided.v1`. Approval decision/outbox event is the single
 * resume signal for an L3 Flow ACTION WAIT checkpoint; approve creates exactly
 * one FunctionExecution, never a second ToolCall (R-11.14).
 */
export interface ApprovalSubjectDecidedEventV1 {
  readonly eventType: typeof APPROVAL_SUBJECT_DECIDED_EVENT;
  readonly workspaceId: string;
  readonly approvalInstanceId: string;
  readonly subjectType: 'agent_tool' | 'flow_tool' | 'workforce_release';
  readonly subjectId: string;
  readonly toolCallId: string | null;
  readonly decision: 'approved' | 'rejected' | 'expired';
  readonly decisionVersion: number;
  readonly governanceContextDigest: `sha256:${string}`;
  readonly actor:
    | { readonly kind: 'human'; readonly userId: string }
    | {
        readonly kind: 'system_expiry';
        readonly owner: 'ApprovalExpirySweep';
        readonly runId: string;
      };
  readonly decidedAt: string;
}

/** Flow binding risk floor (v1 forbids L4 on Flow invocation). */
export type FlowBindingRiskLevelV2 = Exclude<ActionRiskLevel, 'L4'>;
