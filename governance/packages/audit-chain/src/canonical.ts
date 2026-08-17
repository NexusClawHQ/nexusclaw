import { createHash, type Hash } from 'node:crypto';

/**
 * Pure canonicalization helpers, extracted from nexusclaw-core
 * shared/agent-executable-assets (canonical-hash.ts + json-value.ts):
 * RFC 8785 JSON Canonicalization Scheme (JCS) over UTF-8, SHA-256 digests.
 */

export type Sha256Digest = `sha256:${string}`;

export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

const HEX = '0123456789abcdef';

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

function serializeNumber(n: number): string {
  if (!Number.isFinite(n)) {
    throw new Error('canonicalJsonString: non-finite number is not JSON');
  }
  if (Object.is(n, -0)) return '0';
  return JSON.stringify(n);
}

function sha256Bytes(bytes: Uint8Array): string {
  const h: Hash = createHash('sha256');
  h.update(bytes);
  return h.digest('hex');
}

function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function rawByteDigest(bytes: Uint8Array): Sha256Digest {
  return `sha256:${sha256Bytes(bytes)}`;
}

export function rawStringDigest(s: string): Sha256Digest {
  return rawByteDigest(utf8Bytes(s));
}

export function canonicalJsonDigest(value: JsonValue): Sha256Digest {
  return rawStringDigest(canonicalJsonString(value));
}

export function isJsonValue(value: unknown, seen?: WeakSet<object>): value is JsonValue {
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'object':
      break;
    default:
      return value === null;
  }
  if (value === null) return true;
  const obj = value as Record<PropertyKey, unknown>;
  const seenSet = seen ?? new WeakSet<object>();
  if (seenSet.has(obj)) return false;
  seenSet.add(obj);
  if (Array.isArray(obj)) {
    return obj.every((entry) => isJsonValue(entry, seenSet));
  }
  return Object.keys(obj).every((key) => isJsonValue(obj[key], seenSet));
}

export function cloneJsonValue<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
