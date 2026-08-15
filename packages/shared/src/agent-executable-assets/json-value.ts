/**
 * JSON-only recursive types and runtime guards.
 *
 * The executable-workforce contracts exchange exclusively JSON-serializable
 * values (design §8.1). These types and guards are the single owner of "what a
 * JSON value is" for the whole surface: runtime input/output, ToolCall redacted
 * previews, AI generate payloads, connector call bodies and context-pack files.
 *
 * Everything rejected here MUST stay rejected: `undefined`, `bigint`,
 * `function`, `symbol`, `NaN`/`Infinity`, prototype-polluted objects, and
 * cycles. `false`, `0` and `""` are LEGAL present values and must never be
 * confused with absence (design §9 / R-04 rule 5).
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/**
 * A present JSON value with a guaranteed own enumerable structure. Used where a
 * contract needs a non-null object root (e.g. action input/output, AI input).
 */
export type PresentJsonObject = { [key: string]: JsonValue };

const PROTOTYPE_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

/**
 * Type guard: is `value` a finite, cycle-free JSON value with no forbidden
 * primitives and no prototype-pollution keys?
 *
 * Detects cycles via a `WeakSet` of seen containers. Rejects:
 * - `undefined`, `bigint`, `symbol`, `function`
 * - `NaN`, `Infinity`, `-Infinity`
 * - objects whose own keys include `__proto__` / `prototype` / `constructor`
 * - arrays/objects that contain themselves (direct or transitive)
 */
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
      // undefined, bigint, symbol, function
      return value === null;
  }
  if (value === null) {
    return true;
  }
  const obj = value as Record<PropertyKey, unknown>;
  // Cycle defence.
  const seenSet = seen ?? new WeakSet<object>();
  if (seenSet.has(obj)) {
    return false;
  }
  seenSet.add(obj);
  try {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (!isJsonValue(item, seenSet)) {
          return false;
        }
      }
      return true;
    }
    for (const key of Object.keys(obj)) {
      if (PROTOTYPE_KEYS.has(key)) {
        return false;
      }
      if (!isJsonValue(obj[key], seenSet)) {
        return false;
      }
    }
    return true;
  } finally {
    // Do not retain across unrelated calls; callers pass a fresh set per root.
  }
}

/**
 * Deep-clone a value that has already passed {@link isJsonValue}. Structured
 * clone semantics for the JSON subset only; throws if non-JSON slips through.
 */
export function cloneJsonValue<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Canonical string form for hashing/transport. Uses JSON.stringify with stable
 * key ordering via a replacer; for true RFC 8785 canonicalization use
 * {@link canonicalHash} in `canonical-hash.ts` (which owns the JCS algorithm).
 */
export function stableStringify(value: JsonValue): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: JsonObject = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeys((value as JsonObject)[key]!);
    }
    return sorted;
  }
  return value;
}
