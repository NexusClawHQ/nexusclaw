/**
 * Public contract surface for the agent-executable-assets module.
 *
 * This barrel is the ONLY import path for backend and CLI. Re-declaring any of
 * these types/schemas/literals elsewhere is forbidden (design §3.1). Import
 * surface is grouped by concern and re-exported with explicit `type` modifiers
 * to honour `isolatedModules`.
 */

// Frozen version literals — the single source of every schema/provider/CLI id.
export * from './contract-versions';

// JSON-only value types and guards.
export {
  type JsonPrimitive,
  type JsonObject,
  type JsonArray,
  type JsonValue,
  type PresentJsonObject,
  isJsonValue,
  cloneJsonValue,
  stableStringify,
} from './json-value';

// Action ABI, tool catalog descriptor, resolved descriptor, SDK contracts.
export * from './code-action.types';

// Code-extension manifest v1/v2 governance + ACTION artifact entry (design §6.1).
export * from './code-extension-manifest.types';
export * from './executable-package-validation.types';
export * from './candidate-execution-workspace-admin.types';
export * from './workforce-release-events.types';

// Composite bundle + runtime bindings.
export {
  type AiWorkforceExecutableBundleV1,
  type WorkforceRuntimeBindingsV1,
} from './workforce-bundle.types';

// Generated source lock.
export {
  type WorkforceBundleSourceLockV1,
  type Sha256Digest,
} from './workforce-lock.types';

// Release registry, evidence, candidate isolation, lineage, gate receipt.
export {
  type WorkforceReleaseItemKindV1,
  type ReleaseSetEligibility,
  type ExactReleaseItemRefV1,
  type ReleaseEvidenceRefKindV1,
  type ReleaseEvidenceRefV1,
  type WorkforceReleaseEvidencePayloadV1,
  type WorkforceReleaseEnvelopeV1,
  type CandidateStageReceiptV1,
  type CodeTestSuiteSelector,
  type FlowTestSuiteSelector,
  type BundleTestSuiteKind,
  type CandidateTestSuiteSelectorV1,
  type CandidateIsolationBinding,
  type CandidateTestRunInputV1,
  type ReleaseExecutionSnapshotV1,
  type AgentAssetLineage,
  type WorkforceReleaseGateReceiptV1,
} from './release-evidence.types';
export {
  validateWorkforceReleaseEvidencePayload,
  type CandidateEvidenceExecutionIdentityV1,
  type WorkforceReleaseEvidenceExpectationV1,
} from './release-evidence-validation';
export { buildWorkforceReleaseGateReceipt } from './workforce-release-gate-receipt';

// Flow payload/v2.
export {
  FLOW_PAYLOAD_V2_VERSION,
  type FlowActionTypeV2,
  type FlowInvokeUnitActionSettingV2,
  type FlowInputMappingV2,
  type FlowErrorPolicyV2,
  type FlowFaultMarkerV2,
  type FlowRuleSugarActionTypeV2,
  type FlowRevisionIdentityV1,
  type WorkflowVersionLifecycleStatus,
  type ApprovalSubjectDecidedEventV1,
  type FlowBindingRiskLevelV2,
} from './flow-payload-v2.types';
export {
  type FlowRevisionDefinitionV2,
  canonicalizeFlowJsonPointer,
  normalizeFlowInputMappings,
  buildCanonicalFlowMappedInput,
  normalizeFlowRevisionDefinition,
  computeFlowRevisionIdentity,
} from './flow-v2-canonical';

// CLI machine contract + result.
export {
  type CliExitCode,
  type CliArgvSchemaMatcher,
  type CliArgvPredicateAtomV1,
  type CliArgvPredicateExprV1,
  type CliPermissionFactV1,
  type CliPermissionRuleV1,
  type CliPermissionProfileId,
  type CliEffectKind,
  type CliArgumentContract,
  type CliOptionContract,
  type CliExecutionModeV1,
  type CliCommandContractV1,
  type CliOutputModeV2,
  type CliMutabilityV2,
  type CliDryRunExemptionV2,
  type CliInvocationPolicyV2,
  type CliExecutionModeV2,
  type CliCommandContractV2,
  type CliDiagnosticV1,
  type CliNextCommandV1,
  type CliEvidenceEntryV1,
  type CliResultV1,
} from './cli-contract.types';

// AI authoring context pack.
export {
  type AiContextPrincipalKind,
  type AiContextOnlineSelector,
  type AiContextSurface,
  type AiContextSha256,
  type DescribeAiAuthoringContextRequestV2,
  type AiAuthoringCandidateReleaseStampV1,
  type AiAuthoringCatalogDocumentV1,
  type AiAuthoringContextHashesV1,
  type AiAuthoringContextSnapshotV2,
  type VerifyAiAuthoringContextFreshnessRequestV2,
  type SignAiAuthoringContextLockRequestV2,
  type AiAuthoringContextVerificationV1,
  type AiAuthoringContextManifestV2,
  type AiAuthoringContextLockV2,
  type AiAuthoringContextDigestSetV1,
  type AiContextSignatureHeaderV1,
  type AiContextSignaturePayloadV1,
  type AiContextSigningPublicJwkV1,
  type AiContextSigningKeySetV1,
  type AiContextCommonFileEntry,
  AI_CONTEXT_COMMON_FILES,
  AI_CONTEXT_SURFACE_FILES,
  resolveAiContextFileMatrix,
  resolveAiContextManifestFileMatrix,
  assertAiContextDeclaredPaths,
} from './ai-authoring-context.types';

// Canonicalization + digest helpers.
export {
  type Sha256Digest as CanonicalSha256Digest,
  canonicalJsonString,
  canonicalJsonDigest,
  rawByteDigest,
  rawStringDigest,
  aiAuthoringContextDigests,
  unsignedAiAuthoringContextLock,
  releaseItemSetDigest,
  type ReleaseItemDigestInput,
  portableBundleDigest,
  materializedItemRefsDigest,
  releaseEnvelopeDigest,
  selfExcludingDigest,
  escapeJsonPointer,
  parseSha256,
  isSha256Digest,
} from './canonical-hash';
export {
  type AiContextSigningErrorCode,
  AiContextSigningError,
  type AiContextDetachedSigningInput,
  type VerifyAiContextDetachedJwsInput,
  assertAiContextSigningKeySet,
  buildAiContextDetachedSigningInput,
  verifyAiContextDetachedJws,
} from './ai-authoring-context-signing';

// Candidate fixture dispatch mismatch evidence (sanitised diagnostics only).
export {
  CANDIDATE_FIXTURE_MISMATCH_EVIDENCE_SCHEMA_VERSION,
  type CandidateFixtureMismatchDimension,
  type CandidateFixtureCallMismatchEvidenceV1,
  firstDivergingJsonPointer,
  fixtureArgsDigest,
} from './candidate-fixture-mismatch-evidence';

// JSON Schema contracts + frozen AJV config.
export {
  FROZEN_AJV_CONFIG,
  SCHEMA_LIMITS,
  DECIMAL_MONEY_PATTERN,
  CURRENCY_PATTERN,
  TOOL_NAME_PATTERN,
  SHA256_PATTERN,
  actionIoSchemaRoot,
  agentCodeToolExportSchema,
  cliResultSchema,
  flowInvokeUnitActionSettingSchema,
  workforceBundleIdentitySchema,
  codeActionCasesV1Schema,
} from './contract-schemas';

// Frozen error catalog + exit mapping.
export {
  EXECUTABLE_ASSET_ERROR_CODES,
  type ExecutableAssetErrorCode,
  ERROR_CODE_TO_EXIT,
  EXIT_PRECEDENCE,
  resolveExitCode,
} from './error-catalog';
