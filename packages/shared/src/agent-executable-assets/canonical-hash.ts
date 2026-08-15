/**
 * Deterministic canonicalization and digest helpers.
 *
 * The SINGLE owner of every hash/digest algorithm on the executable-workforce
 * surface (design §10.1, §10.3, §5.3, §17.1). Pure functions only — no Node
 * service, database, network, or filesystem dependency. `node:crypto` is used
 * solely as a primitive (it is a built-in, not a service).
 *
 * Invariants enforced here and by tests:
 * - Hash algorithm is SHA-256; external form lowercase `sha256:<64 hex>`.
 * - JSON hashes use RFC 8785 JSON Canonicalization Scheme (JCS) over UTF-8.
 * - No digest field hashes itself (each formula excludes its own field).
 * - Raw file digests use raw bytes (no silent newline/Unicode normalization).
 */
import { createHash, type Hash } from 'node:crypto';
import {
  AI_AUTHORING_CONTEXT_LOCK_SCHEMA_VERSION,
  AI_CONTEXT_SIGNATURE_ALG_NONE,
} from './contract-versions';
import type {
  AiAuthoringContextDigestSetV1,
  AiAuthoringContextLockV2,
  AiAuthoringContextManifestV2,
} from './ai-authoring-context.types';
import type { JsonValue } from './json-value';

/** Lowercase `sha256:<64 hex>`. */
export type Sha256Digest = `sha256:${string}`;

const HEX = '0123456789abcdef';

/**
 * RFC 8785 JSON Canonicalization Scheme serialization.
 *
 * Implements the canonical serialization: UTF-8, lexicographic key ordering by
 * UTF-16 code units, minimal number serialization, and string escaping per
 * RFC 8785 §3.2.2/§3.2.3. Rejects `undefined`/`bigint`/`symbol`/`function` and
 * non-finite numbers — only the JSON subset is canonicalizable.
 */
export function canonicalJsonString(value: JsonValue): string {
  const parts: string[] = [];
  serializeCanonical(value, parts);
  return parts.join('');
}

function serializeCanonical(value: JsonValue, out: string[]): void {
  switch (typeof value) {
    case 'string':
      out.push(serializeString(value));
      return;
    case 'number':
      out.push(serializeNumber(value));
      return;
    case 'boolean':
      out.push(value ? 'true' : 'false');
      return;
    case 'object':
      if (value === null) {
        out.push('null');
        return;
      }
      if (Array.isArray(value)) {
        out.push('[');
        for (let i = 0; i < value.length; i++) {
          if (i > 0) out.push(',');
          serializeCanonical(value[i]!, out);
        }
        out.push(']');
        return;
      }
      serializeObject(value as Record<string, JsonValue>, out);
      return;
    default:
      // undefined / bigint / symbol / function — not JSON.
      throw new Error('canonicalJsonString: value is not JSON-serializable');
  }
}

function serializeObject(obj: Record<string, JsonValue>, out: string[]): void {
  out.push('{');
  const keys = Object.keys(obj);
  // RFC 8785 §3.2.3: lexicographic order by UTF-16 code unit.
  keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  let first = true;
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'undefined') continue;
    if (!first) out.push(',');
    first = false;
    out.push(serializeString(key), ':');
    serializeCanonical(v, out);
  }
  out.push('}');
}

function serializeString(s: string): string {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x22) out += '\\"';
    else if (c === 0x5c) out += '\\\\';
    else if (c >= 0x20 && c < 0x7f) out += s[i];
    else if (c === 0x08) out += '\\b';
    else if (c === 0x09) out += '\\t';
    else if (c === 0x0a) out += '\\n';
    else if (c === 0x0c) out += '\\f';
    else if (c === 0x0d) out += '\\r';
    else if (c < 0x10000) out += '\\u' + hex4(c);
    else {
      // Surrogate pair.
      const cp = 0x10000 + (((c & 0x3ff) << 10) | (s.charCodeAt(++i) & 0x3ff));
      out += '\\u' + hex4(0xd800 + (cp >> 10)) + '\\u' + hex4(0xdc00 + (cp & 0x3ff));
    }
  }
  return out + '"';
}

function hex4(n: number): string {
  return (
    HEX[(n >> 12) & 0xf]! +
    HEX[(n >> 8) & 0xf]! +
    HEX[(n >> 4) & 0xf]! +
    HEX[n & 0xf]!
  );
}

/**
 * RFC 8785 §3.2.2 minimal number serialization. Uses `Number.prototype` output
 * for the JSON numeric grammar; rejects non-finite (NaN/Infinity) values.
 */
function serializeNumber(n: number): string {
  if (!Number.isFinite(n)) {
    throw new Error('canonicalJsonString: non-finite number is not JSON');
  }
  if (Object.is(n, -0)) return '0';
  // JSON.stringify matches RFC 8785's required output for all finite doubles
  // (shortest round-trip). Both engines produce the same minimal form here.
  return JSON.stringify(n);
}

// ---- raw byte hashing -------------------------------------------------------

function sha256Bytes(bytes: Uint8Array): string {
  const h: Hash = createHash('sha256');
  h.update(bytes);
  return h.digest('hex');
}

function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** SHA-256 over raw file bytes; no normalization. Returns `sha256:<hex>`. */
export function rawByteDigest(bytes: Uint8Array): Sha256Digest {
  return `sha256:${sha256Bytes(bytes)}`;
}

/** SHA-256 over a UTF-8 string's raw bytes. */
export function rawStringDigest(s: string): Sha256Digest {
  return rawByteDigest(utf8Bytes(s));
}

/** SHA-256 over RFC 8785 canonical JSON of `value`, UTF-8 encoded. */
export function canonicalJsonDigest(value: JsonValue): Sha256Digest {
  return rawStringDigest(canonicalJsonString(value));
}

// ---- Composite digests (design §5.3 / §10.2 / §10.3) -----------------------

const AI_CONTEXT_SELF_FILES = new Set([
  'context-manifest.json',
  'context-lock.json',
]);

/**
 * Compute the four non-recursive AI context-pack digests from the manifest and
 * the exact raw content-file bytes it declares (design §17.1).
 *
 * `contentFiles` MUST contain only manifest content files. Both self files are
 * rejected, every declared raw digest is rechecked, and undeclared/missing or
 * duplicate paths fail closed before any composite digest is returned.
 */
export function aiAuthoringContextDigests(
  manifest: AiAuthoringContextManifestV2,
  contentFiles: Readonly<Record<string, Uint8Array>>,
): AiAuthoringContextDigestSetV1 {
  const entries = [...manifest.files];
  const declared = new Set<string>();
  for (const entry of entries) {
    if (
      !entry.path ||
      AI_CONTEXT_SELF_FILES.has(entry.path) ||
      declared.has(entry.path)
    ) {
      throw new Error('AI_CONTEXT_TAMPERED');
    }
    declared.add(entry.path);
  }

  const actualPaths = Object.keys(contentFiles);
  if (
    actualPaths.some((path) => AI_CONTEXT_SELF_FILES.has(path)) ||
    actualPaths.length !== declared.size ||
    actualPaths.some((path) => !declared.has(path))
  ) {
    throw new Error('AI_CONTEXT_TAMPERED');
  }

  const rows = entries.map((entry) => {
    const bytes = contentFiles[entry.path];
    if (!bytes || rawByteDigest(bytes) !== entry.digest) {
      throw new Error('AI_CONTEXT_TAMPERED');
    }
    return { path: entry.path, digest: entry.digest };
  });
  rows.sort((a, b) =>
    Buffer.from(a.path, 'utf8').compare(Buffer.from(b.path, 'utf8')),
  );

  const contentDigest = rawStringDigest(
    rows.map((row) => `${row.path}\u0000${row.digest}\n`).join(''),
  );
  const {
    generatedAt: _generatedAt,
    expiresAt: _expiresAt,
    ...manifestContent
  } = manifest;
  const manifestContentDigest = canonicalJsonDigest(
    manifestContent as unknown as JsonValue,
  );
  const manifestEnvelopeDigest = canonicalJsonDigest({
    manifestContentDigest,
    generatedAt: manifest.generatedAt,
    expiresAt: manifest.expiresAt ?? null,
    target: (manifest.target ?? null) as unknown as JsonValue,
  });
  const lockDigest = canonicalJsonDigest({
    contentDigest,
    manifestContentDigest,
    manifestEnvelopeDigest,
  });
  return {
    contentDigest,
    manifestContentDigest,
    manifestEnvelopeDigest,
    lockDigest,
  };
}

/** Build the explicitly non-authoritative lock used by offline context packs. */
export function unsignedAiAuthoringContextLock(
  digests: AiAuthoringContextDigestSetV1,
): AiAuthoringContextLockV2 {
  return {
    schemaVersion: AI_AUTHORING_CONTEXT_LOCK_SCHEMA_VERSION,
    ...digests,
    signatureAlgorithm: AI_CONTEXT_SIGNATURE_ALG_NONE,
    signature: '',
  };
}

/**
 * `releaseItemSetDigest = SHA256(RFC8785(sorted plannedItems.map(
 *   {itemKind,canonicalKey,checksum,descriptorHash:descriptorHash ?? null})))`.
 * Sort key: `(itemKind, canonicalKey)`. Content-addressed — derivable before
 * any owner UUID exists, so dry-run and stage produce identical digests.
 */
export interface ReleaseItemDigestInput {
  readonly itemKind: string;
  readonly canonicalKey: string;
  readonly checksum: Sha256Digest;
  readonly descriptorHash: Sha256Digest | null;
}

export function releaseItemSetDigest(items: ReadonlyArray<ReleaseItemDigestInput>): Sha256Digest {
  const sorted = [...items].sort((a, b) => {
    const k = a.itemKind.localeCompare(b.itemKind);
    return k !== 0 ? k : a.canonicalKey.localeCompare(b.canonicalKey);
  });
  const projected = sorted.map((i) => ({
    itemKind: i.itemKind,
    canonicalKey: i.canonicalKey,
    checksum: i.checksum,
    descriptorHash: i.descriptorHash ?? null,
  }));
  return canonicalJsonDigest(projected as JsonValue);
}

/**
 * `portableBundleDigest = SHA256` over transitive semantic inventories, rows
 * `<bundle-relative-path> NUL <semanticEntryDigest> LF` sorted by UTF-8 bytes.
 * Excludes `bindings/` and all `.nexusclaw/` generated files. Caller supplies
 * the already-sorted (path, digest) rows; this helper is the pure reduction.
 */
export function portableBundleDigest(
  rows: ReadonlyArray<{ readonly path: string; readonly semanticEntryDigest: Sha256Digest }>,
): Sha256Digest {
  const sorted = [...rows].sort((a, b) =>
    Buffer.from(a.path, 'utf8').compare(Buffer.from(b.path, 'utf8')),
  );
  let payload = '';
  for (const r of sorted) {
    payload += `${r.path}\u0000${r.semanticEntryDigest}\n`;
  }
  return rawStringDigest(payload);
}

/**
 * `materializedItemRefsDigest` — post-stage digest that each resolver proves
 * matches its content hash. Computed after DB refs materialise; differs from
 * the pre-stage `releaseItemSetDigest` only by persistence fields.
 */
export function materializedItemRefsDigest(
  refs: ReadonlyArray<{
    readonly itemKind: string;
    readonly canonicalKey: string;
    readonly revisionRef: string;
    readonly checksum: Sha256Digest;
    readonly descriptorHash: Sha256Digest | null;
  }>,
): Sha256Digest {
  const sorted = [...refs].sort((a, b) => {
    const k = a.itemKind.localeCompare(b.itemKind);
    return k !== 0 ? k : a.canonicalKey.localeCompare(b.canonicalKey);
  });
  return canonicalJsonDigest(
    sorted.map((r) => ({
      itemKind: r.itemKind,
      canonicalKey: r.canonicalKey,
      revisionRef: r.revisionRef,
      checksum: r.checksum,
      descriptorHash: r.descriptorHash ?? null,
    })) as JsonValue,
  );
}

/**
 * `releaseEnvelopeDigest = SHA256(RFC8785({
 *   releaseSetId, sourceLockDigest, releaseItemSetDigest,
 *   materializedItemRefsDigest, evidencePayloadHash,
 *   approvalId, previousReleaseSetId }))`.
 */
export function releaseEnvelopeDigest(input: {
  readonly releaseSetId: string;
  readonly sourceLockDigest: Sha256Digest;
  readonly releaseItemSetDigest: Sha256Digest;
  readonly materializedItemRefsDigest: Sha256Digest;
  readonly evidencePayloadHash: Sha256Digest;
  readonly approvalId: string;
  readonly previousReleaseSetId?: string;
}): Sha256Digest {
  const payload = {
    releaseSetId: input.releaseSetId,
    sourceLockDigest: input.sourceLockDigest,
    releaseItemSetDigest: input.releaseItemSetDigest,
    materializedItemRefsDigest: input.materializedItemRefsDigest,
    evidencePayloadHash: input.evidencePayloadHash,
    approvalId: input.approvalId,
    ...(input.previousReleaseSetId !== undefined
      ? { previousReleaseSetId: input.previousReleaseSetId }
      : {}),
  };
  return canonicalJsonDigest(payload as JsonValue);
}

/**
 * `stageRequestFingerprint = SHA256(RFC8785({
 *   sourceLockDigest, releaseItemSetDigest, materializedItemRefsDigest,
 *   planDigest, expectedActiveReleaseSetId, expectedGeneration }))`
 * (executable-asset design §5.3 line 1308, task 4.19).
 *
 * This is the **only** stage domain replay fingerprint. The
 * `UNIQUE(workspace_id, agent_api_name, stage_request_key_hash)` index is the
 * only replay key; `stage_request_key_hash` is the caller-supplied idempotency
 * key hash and `stage_request_fingerprint` is this digest over the exact plan
 * + expected head. Same key + same fingerprint replays the same candidate;
 * same key + different fingerprint returns `IDEMPOTENCY_KEY_CONFLICT`; a new
 * key may create a new release set with the same source lock.
 *
 * `expectedActiveReleaseSetId` is `'none'` when the head is NULL (first
 * release); otherwise the active release-set id. `expectedGeneration` is the
 * head generation the stage expects to land against.
 */
export function stageRequestFingerprint(input: {
  readonly sourceLockDigest: Sha256Digest;
  readonly releaseItemSetDigest: Sha256Digest;
  readonly materializedItemRefsDigest: Sha256Digest;
  readonly planDigest: Sha256Digest;
  readonly expectedActiveReleaseSetId: string;
  readonly expectedGeneration: number;
}): Sha256Digest {
  return canonicalJsonDigest({
    sourceLockDigest: input.sourceLockDigest,
    releaseItemSetDigest: input.releaseItemSetDigest,
    materializedItemRefsDigest: input.materializedItemRefsDigest,
    planDigest: input.planDigest,
    expectedActiveReleaseSetId: input.expectedActiveReleaseSetId,
    expectedGeneration: input.expectedGeneration,
  } as JsonValue);
}

/**
 * Compute a self-digest over an object while EXCLUDING one or more of its own
 * fields (e.g. `sourceLockDigest`, `releaseEnvelopeDigest`). This is the
 * generic primitive behind `sourceLockDigest` and similar self-excluding
 * digests: callers pass the object and the field name(s) to omit.
 */
export function selfExcludingDigest(
  obj: Record<string, JsonValue>,
  omit: ReadonlyArray<string>,
): Sha256Digest {
  const omitSet = new Set(omit);
  const filtered: Record<string, JsonValue> = {};
  for (const key of Object.keys(obj)) {
    if (!omitSet.has(key)) {
      filtered[key] = obj[key]!;
    }
  }
  return canonicalJsonDigest(filtered as JsonValue);
}

/**
 * RFC 6901 JSON Pointer escape helper (used by Flow input mappings and
 * diagnostics). Escapes `~` to `~0` and `/` to `~1`.
 */
export function escapeJsonPointer(s: string): string {
  return s.replace(/~/g, '~0').replace(/\//g, '~1');
}

/** Parse a `sha256:<hex>` digest into its hex part; throws if malformed. */
export function parseSha256(digest: string): { hex: string } {
  const m = /^sha256:([0-9a-f]{64})$/.exec(digest);
  if (!m) {
    throw new Error(`parseSha256: not a valid sha256 digest: ${digest}`);
  }
  return { hex: m[1]! };
}

/** Type guard for the `sha256:<64 hex>` literal form. */
export function isSha256Digest(s: string): s is Sha256Digest {
  return /^sha256:[0-9a-f]{64}$/.test(s);
}
