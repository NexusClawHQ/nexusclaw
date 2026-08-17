import type { JsonValue } from './canonical.js';
import { cloneJsonValue } from './canonical.js';

const SENSITIVE_KEYS =
  /password|passwd|secret|token|api[_-]?key|authorization|credential|cookie|private[_-]?key|id[_-]?card|identity[_-]?card|bank[_-]?(account|card)|credit[_-]?card|card[_-]?(no|number)|phone|mobile|cvv/i;

const SECRET_PATTERN =
  /\b(sk-[A-Za-z0-9_-]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|AKIA[0-9A-Z]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)\b/gi;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_PATTERN = /\b1[3-9]\d{9}\b/g;
const ID_CARD_PATTERN = /\b\d{17}[\dXx]\b/g;
const MASK = '********';

/**
 * Platform-wide JSON payload scrubber (extracted from nexusclaw-core
 * common/security/redact-sensitive-payload.ts). Sensitive-key values are
 * removed entirely; PII/credential-shaped string content is replaced with a
 * constant-length marker so neither the value nor its original length leaks.
 */
export function redactSensitivePayload(
  value: unknown,
  options: { sensitiveKeyMode?: 'mask' | 'drop' } = {},
): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitivePayload(entry, options));
  }
  if (typeof value === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (SENSITIVE_KEYS.test(key)) {
        if (options.sensitiveKeyMode !== 'drop') redacted[key] = MASK;
      } else {
        redacted[key] = redactSensitivePayload(item, options);
      }
    }
    return redacted;
  }
  if (typeof value !== 'string') return value;
  return value
    .replace(SECRET_PATTERN, MASK)
    .replace(EMAIL_PATTERN, MASK)
    .replace(PHONE_PATTERN, MASK)
    .replace(ID_CARD_PATTERN, MASK);
}

const REDACTED = '[REDACTED]';

/**
 * Shared RFC 6901 pointer redaction owner for persisted previews and logs
 * (extracted from nexusclaw-core common/security/apply-json-redaction-pointers.ts).
 */
export function applyJsonRedactionPointers(
  raw: JsonValue,
  pointers: readonly string[],
  invalidPointerCode = 'JSON_REDACTION_POINTER_INVALID',
): JsonValue {
  let output = cloneJsonValue(raw);
  for (const pointer of [...pointers].sort()) {
    if (pointer === '') {
      output = REDACTED;
      continue;
    }
    if (!pointer.startsWith('/')) {
      throw new Error(invalidPointerCode);
    }
    const segments = pointer.slice(1).split('/').map((segment) => {
      if (/~(?![01])/u.test(segment)) {
        throw new Error(invalidPointerCode);
      }
      return segment.replace(/~1/gu, '/').replace(/~0/gu, '~');
    });
    let current: JsonValue = output;
    for (let index = 0; index < segments.length - 1; index += 1) {
      if (!current || typeof current !== 'object') {
        current = null;
        break;
      }
      current = (Array.isArray(current)
        ? current[Number(segments[index])!]
        : current[segments[index]!]) ?? null;
    }
    if (!current || typeof current !== 'object') continue;
    const last = segments[segments.length - 1]!;
    if (Array.isArray(current)) {
      const index = Number(last);
      if (Number.isInteger(index) && index >= 0 && index < current.length) {
        current[index] = REDACTED;
      }
    } else if (last in current) {
      current[last] = REDACTED;
    }
  }
  return output;
}
