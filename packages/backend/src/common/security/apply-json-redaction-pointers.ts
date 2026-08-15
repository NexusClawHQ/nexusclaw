import {
  cloneJsonValue,
  type JsonValue,
} from '@nexusclaw/shared/agent-executable-assets';

const REDACTED = '[REDACTED]';

/** Shared RFC 6901 pointer redaction owner for persisted previews and logs. */
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
      current = Array.isArray(current)
        ? current[Number(segments[index])]
        : current[segments[index]];
    }
    if (!current || typeof current !== 'object') continue;
    const last = segments[segments.length - 1];
    if (Array.isArray(current)) {
      const index = Number(last);
      if (
        Number.isInteger(index) &&
        index >= 0 &&
        index < current.length
      ) {
        current[index] = REDACTED;
      }
    } else if (last in current) {
      current[last] = REDACTED;
    }
  }
  return output;
}
