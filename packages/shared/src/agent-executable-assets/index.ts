/**
 * Community contract surface for agent-executable-assets.
 *
 * Trimmed to the contracts the Community runtime actually imports: the tool
 * framework's export/resolved descriptors, the execution-snapshot types, and
 * the RFC 8785 digest primitives used for audit content hashes. Enterprise
 * release/workforce/CLI/Flow-payload contracts are NOT part of the Community
 * edition (see ROADMAP.md) — re-adding them requires a boundary review
 * (`npm run check:boundary`, docs/snapshot-export-policy.md).
 */

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

// Tool catalog export descriptor, resolved descriptor, frozen version literals.
export * from './code-action.types';

// Execution-snapshot contracts recorded by the governed agent runtime.
export {
  type CandidateIsolationBinding,
  type ReleaseExecutionSnapshotV1,
} from './release-evidence.types';

// Canonicalization + digest helpers.
export {
  type Sha256Digest,
  type Sha256Digest as CanonicalSha256Digest,
  canonicalJsonString,
  canonicalJsonDigest,
  rawStringDigest,
} from './canonical-hash';
