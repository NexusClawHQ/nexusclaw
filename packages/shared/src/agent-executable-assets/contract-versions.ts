/**
 * Frozen contract version literals for the agent-executable-assets surface.
 *
 * This file is the SINGLE owner of every version string / provider id /
 * schema-version discriminator used by the executable-workforce authoring,
 * release and runtime contracts. Backend and CLI MUST import from here and
 * MUST NOT redeclare any of these literals (executable-asset design §3.1, §1).
 *
 * Adding or changing a value here is a contract-version change, not an ad hoc
 * edit: it requires paired schema/test/release-evidence updates.
 */

// ---- Composite workforce bundle & bindings (design §5) ----------------------

/** Source bundle contract. */
export const BUNDLE_SCHEMA_VERSION = 'ai-workforce-executable-bundle/v1' as const;
/** Environment binding contract (portable, no secrets). */
export const RUNTIME_BINDINGS_SCHEMA_VERSION =
  'workforce-runtime-bindings/v1' as const;
/** Server-generated lock contract (never hand-written). */
export const BUNDLE_LOCK_SCHEMA_VERSION = 'workforce-bundle.lock/v1' as const;
/** Append-only connector binding revision key envelope. */
export const CONNECTOR_BINDING_REVISION_SCHEMA_VERSION =
  'nexusclaw.connector-binding-revision/v1' as const;

// ---- Code-extension governance & tool catalog (design §6) -------------------

/** Manifest governance discriminant that permits Agent/Flow binding. */
export const CODE_EXTENSION_GOVERNANCE_V2 = 'code-extension-governance/v2' as const;
/** Legacy governance (kept compatible; no Agent binding). */
export const CODE_EXTENSION_GOVERNANCE_V1 = 'code-extension-governance/v1' as const;
/** Sidecar catalog contract referenced by `agentToolCatalogPath`. */
export const AGENT_CODE_TOOL_CATALOG_SCHEMA_VERSION =
  'agent-code-tool-catalog/v1' as const;
/** Per-export descriptor contract inside the catalog. */
export const AGENT_CODE_TOOL_EXPORT_SCHEMA_VERSION = 'agent-code-tool/v1' as const;

// ---- Handler ABI & runtime (design §7, §12.4) -------------------------------

/** The only TypeScript handler ABI accepted for ACTION exports. */
export const ACTION_CONTRACT_VERSION = 'nexus-code-action/v1' as const;
/** Runtime API version that selects the verified-isolate provider surface. */
export const RUNTIME_API_VERSION_V2 = 'runtime/v2' as const;
/**
 * The only provider id permitted for runtime/v2. Frozen replacement for the
 * unverified worker-thread provider (design §12.4). Implemented in Phase 5.
 */
export const VERIFIED_ISOLATE_PROVIDER_ID =
  'nexusclaw-verified-isolate-v1' as const;
/**
 * Legacy worker-thread provider id, kept for compatibility evidence only.
 * Its `securityLevel` is `unverified`; it may only run repository fixtures.
 */
export const WORKER_THREAD_PROVIDER_ID =
  'worker-thread-hardened-isolate' as const;
/**
 * Sandbox execution ticket / result envelope versions (design §12.4).
 */
export const SANDBOX_EXECUTION_TICKET_SCHEMA_VERSION =
  'nexusclaw.sandbox-execution-ticket/v1' as const;
export const SANDBOX_EXECUTION_RESULT_SCHEMA_VERSION =
  'nexusclaw.sandbox-execution-result/v1' as const;
export const SANDBOX_PAYLOAD_CIPHER_SCHEMA_VERSION =
  'nexusclaw.sandbox-payload-cipher/v1' as const;
export const CODE_RUNTIME_ISOLATION_EVIDENCE_SCHEMA_VERSION =
  'nexusclaw.code-runtime-isolation-evidence/v1' as const;

// ---- Flow payload/v2 (design §15) -------------------------------------------

/** Frozen flows payload envelope that adds `INVOKE_UNIT`. */
export const FLOWS_PAYLOAD_V2 = 'payload/v2' as const;
/** Legacy payload envelope (kept compatible; no `INVOKE_UNIT`). */
export const FLOWS_PAYLOAD_V1 = 'payload/v1' as const;
/** Rule-sugar action type that compiles to `INVOKE_UNIT`. */
export const RULE_SUGAR_INVOKE_ACTION = 'invoke_action' as const;
/** Engine-native ACTION setting for exact revision invocation. */
export const FLOW_ACTION_TYPE_INVOKE_UNIT = 'INVOKE_UNIT' as const;
/** Approval subject decision outbox event (design §6/§15.4). */
export const APPROVAL_SUBJECT_DECIDED_EVENT =
  'approval.subject.decided.v1' as const;

// ---- Release registry & evidence (design §11.3) ----------------------------

/** Release-set eligibility values; active truth lives only on the head row. */
export const RELEASE_SET_ELIGIBILITY_STAGED = 'staged' as const;
export const RELEASE_SET_ELIGIBILITY_ELIGIBLE = 'eligible' as const;
export const RELEASE_SET_ELIGIBILITY_REJECTED = 'rejected' as const;
/** Post-commit active-head transition event (design §11.3). */
export const WORKFORCE_RELEASE_HEAD_CHANGED_EVENT =
  'ai.workforce.release.head.changed.v1' as const;
/** Append-only executable-tool emergency revocation event (design §19). */
export const CODE_ACTION_REVOKED_EVENT =
  'ai.workforce.code-action.revoked.v1' as const;

// ---- CLI machine contract (design §16) --------------------------------------

/** Machine-readable command-contract registry version. */
export const CLI_COMMAND_CONTRACT_SCHEMA_VERSION =
  'nexusclaw.cli-command-contract/v1' as const;
/** Complete all-Commander-leaf contract with invocation/output policy. */
export const CLI_COMMAND_CONTRACT_SCHEMA_VERSION_V2 =
  'nexusclaw.cli-command-contract/v2' as const;
/** Exported registry document containing every command contract. */
export const CLI_COMMAND_REGISTRY_SCHEMA_VERSION =
  'nexusclaw.cli-command-registry/v1' as const;
/** Complete all-Commander-leaf registry. */
export const CLI_COMMAND_REGISTRY_SCHEMA_VERSION_V2 =
  'nexusclaw.cli-command-registry/v2' as const;
/** The single machine result envelope emitted on `--json` stdout. */
export const CLI_RESULT_SCHEMA_VERSION = 'nexusclaw.cli-result/v1' as const;
/** Deterministic command-order DAG (implemented modes only). */
export const COMMAND_ORDER_SCHEMA_VERSION = 'nexusclaw.command-order/v1' as const;
/** Human-help and machine-help share one command-contract source (R-14). */
export const CLI_CONTRACT_HUMAN_HELP_POINTER =
  'nexus ai help --all --json' as const;

// ---- AI authoring context pack (design §17.1) ------------------------------

/** Context pack manifest version. */
export const AI_AUTHORING_CONTEXT_SCHEMA_VERSION =
  'nexusclaw.ai-authoring-context/v2' as const;
/** Context pack lock (digests + signature) version. */
export const AI_AUTHORING_CONTEXT_LOCK_SCHEMA_VERSION =
  'nexusclaw.ai-authoring-context-lock/v2' as const;
export const WORKSPACE_AUTHORING_CONTRACT_SCHEMA_VERSION =
  'nexusclaw.workspace-authoring-contract/v1' as const;
/** Context-pack JSON Web Signature type for online packs. */
export const AI_CONTEXT_SIGNATURE_TYP = 'NEXUSCLAW-AI-CONTEXT-V2' as const;
/** Online context signature algorithm. */
export const AI_CONTEXT_SIGNATURE_ALG_ED25519 = 'EdDSA' as const;
/** Offline context signature algorithm (non-authoritative). */
export const AI_CONTEXT_SIGNATURE_ALG_NONE = 'none' as const;
export const AI_CONTEXT_SIGNING_KEY_SET_SCHEMA_VERSION =
  'nexusclaw.ai-context-signing-key-set/v1' as const;
/** Deployment-secret keyring consumed only by the backend signing owner. */
export const AI_CONTEXT_SIGNING_KEYRING_SCHEMA_VERSION =
  'nexusclaw.ai-context-signing-keyring/v1' as const;
/** Public-key-only CLI cache; bearer/session data is schema-forbidden. */
export const AI_CONTEXT_SIGNING_KEY_CACHE_SCHEMA_VERSION =
  'nexusclaw.ai-context-signing-key-cache/v1' as const;
/** Authoring catalog version literals surfaced inside context packs. */
export const OBJECT_AUTHORING_CATALOG_SCHEMA_VERSION =
  'nexusclaw.object-authoring-catalog/v1' as const;
export const CONNECTOR_AUTHORING_CATALOG_SCHEMA_VERSION =
  'nexusclaw.connector-authoring-catalog/v1' as const;
export const AI_POLICY_AUTHORING_CATALOG_SCHEMA_VERSION =
  'nexusclaw.ai-policy-authoring-catalog/v1' as const;
export const APPROVAL_POLICY_AUTHORING_CATALOG_SCHEMA_VERSION =
  'nexusclaw.approval-policy-authoring-catalog/v1' as const;
export const INVOKABLE_AUTHORING_CATALOG_SCHEMA_VERSION =
  'nexusclaw.invokable-authoring-catalog/v1' as const;
export const FLOW_NODE_CATALOG_SCHEMA_VERSION =
  'nexusclaw.flow-node-catalog/v1' as const;
export const FLOW_PACKAGE_SCHEMA_VERSION = 'flow-package/v1' as const;
export const EMPLOYEE_PACKAGE_V2_SCHEMA_VERSION =
  'employee-package/v2' as const;
export const WORKFORCE_RELEASE_EVIDENCE_SCHEMA_VERSION =
  'ai-workforce-release-evidence/v1' as const;
/** Declarative action test cases file contract (design §19). */
export const CODE_ACTION_CASES_SCHEMA_VERSION = 'code-action-cases/v1' as const;

// ---- Toolchain pins (design §7.2, §9, §10) ----------------------------------

/** Frozen toolchain versions; changing any changes compiler/sdk hashes. */
export const TYPESCRIPT_VERSION = '5.9.3' as const;
export const AJV_VERSION = '8.18.0' as const;
export const JSZIP_VERSION = '3.10.1' as const;

/** Canonical archive format (design §10.4). */
export const CANONICAL_ARCHIVE_FORMAT = 'zip-store-v1' as const;

/** HMAC key-derivation domains (design §8.2, §13.3). */
export const IDEMPOTENCY_DOMAIN_RECORD_CURSOR = 'record_cursor/v1' as const;
export const IDEMPOTENCY_DOMAIN_CODE_ACTION_WRITE = 'code_action_write/v1' as const;

// ---- Approval subject types (design §11.5, R-12.15) -------------------------

/** Approval subject that can satisfy the release gate. */
export const APPROVAL_SUBJECT_WORKFORCE_RELEASE = 'workforce_release' as const;
/** Approval subject for a single Agent/Flow tool call (L3). */
export const APPROVAL_SUBJECT_AGENT_TOOL = 'agent_tool' as const;
export const APPROVAL_SUBJECT_FLOW_TOOL = 'flow_tool' as const;
/** Legacy approval subject; can never satisfy release gate. */
export const APPROVAL_SUBJECT_LEGACY = 'legacy' as const;

/** Approval policy purposes (exactly two per bundle, design §5.3). */
export const APPROVAL_POLICY_PURPOSE_TOOL_CALL = 'tool_call' as const;
export const APPROVAL_POLICY_PURPOSE_WORKFORCE_RELEASE =
  'workforce_release' as const;

// ---- Re-exported as a typed literal union for type-level guards -------------

/** All schema-version string literals as a discriminated alias. */
export type AgentExecutableAssetSchemaVersion =
  | typeof BUNDLE_SCHEMA_VERSION
  | typeof RUNTIME_BINDINGS_SCHEMA_VERSION
  | typeof BUNDLE_LOCK_SCHEMA_VERSION
  | typeof CONNECTOR_BINDING_REVISION_SCHEMA_VERSION
  | typeof AGENT_CODE_TOOL_CATALOG_SCHEMA_VERSION
  | typeof AGENT_CODE_TOOL_EXPORT_SCHEMA_VERSION
  | typeof ACTION_CONTRACT_VERSION
  | typeof RUNTIME_API_VERSION_V2
  | typeof FLOWS_PAYLOAD_V2
  | typeof FLOWS_PAYLOAD_V1
  | typeof CLI_COMMAND_CONTRACT_SCHEMA_VERSION
  | typeof CLI_COMMAND_CONTRACT_SCHEMA_VERSION_V2
  | typeof CLI_COMMAND_REGISTRY_SCHEMA_VERSION
  | typeof CLI_COMMAND_REGISTRY_SCHEMA_VERSION_V2
  | typeof CLI_RESULT_SCHEMA_VERSION
  | typeof COMMAND_ORDER_SCHEMA_VERSION
  | typeof AI_AUTHORING_CONTEXT_SCHEMA_VERSION
  | typeof AI_AUTHORING_CONTEXT_LOCK_SCHEMA_VERSION;
