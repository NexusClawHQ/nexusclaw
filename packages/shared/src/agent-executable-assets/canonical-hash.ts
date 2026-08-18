/**
 * Deterministic canonicalization and digest helpers (Community subset).
 *
 * RFC 8785 canonical JSON + SHA-256 digests — the primitives behind the
 * governed runtime's audit-record and tool-call content digests. Pure
 * functions only — no Node service, database, network, or filesystem
 * dependency. `node:crypto` is used solely as a primitive (it is a built-in,
 * not a service).
 *
 * Invariants enforced here and by tests:
 * - Hash algorithm is SHA-256; external form lowercase `sha256:<64 hex>`.
 * - JSON hashes use RFC 8785 JSON Canonicalization Scheme (JCS) over UTF-8.
 * - No digest field hashes itself (each formula excludes its own field).
 * - Raw file digests use raw bytes (no silent newline/Unicode normalization).
 */
import { createHash, type Hash } from 'node:crypto';
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

// ---- hashing -----------------------------------------------------------------

function sha256Bytes(bytes: Uint8Array): string {
  const h: Hash = createHash('sha256');
  h.update(bytes);
  return h.digest('hex');
}

function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** SHA-256 over a UTF-8 string's raw bytes. */
export function rawStringDigest(s: string): Sha256Digest {
  return `sha256:${sha256Bytes(utf8Bytes(s))}`;
}

/** SHA-256 over RFC 8785 canonical JSON of `value`, UTF-8 encoded. */
export function canonicalJsonDigest(value: JsonValue): Sha256Digest {
  return rawStringDigest(canonicalJsonString(value));
}
