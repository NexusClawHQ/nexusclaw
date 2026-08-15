/**
 * Structured mismatch evidence for candidate fixture call dispatch failures.
 *
 * When the verified-isolate dispatcher detects that the actual host RPC call
 * does not match the next expected frozen fixture call (design §12.1 "Candidate
 * fixture dispatch"), it MUST fail closed with `CODE_TEST_CALL_ORDER_MISMATCH`.
 * This module supplies the **structured, sanitised evidence** that travels
 * alongside that error so the caller can diagnose WHICH dimension diverged
 * (ordinal / namespace / method / args) and WHERE (canonical request digests +
 * the first diverging JSON Pointer), WITHOUT ever leaking the raw request or
 * response body.
 *
 * Red lines enforced here and by tests:
 * - Evidence carries digests and structural pointers only — never raw values.
 * - The JSON Pointer identifies a POSITION (`/select`, `/where/0/field`), never
 *   the value at that position.
 * - The diff walker is a pure function over `JsonValue`; no Node service, DB,
 *   network, or filesystem dependency.
 */
import { escapeJsonPointer, canonicalJsonDigest } from './canonical-hash';
import type { JsonValue } from './json-value';

export const CANDIDATE_FIXTURE_MISMATCH_EVIDENCE_SCHEMA_VERSION =
  'nexusclaw.candidate-fixture-mismatch/v1' as const;

/**
 * The dimension of the first divergence between the expected frozen fixture
 * call and the actual host RPC call. Ordered by check priority — the dispatcher
 * evaluates them in this sequence and reports the FIRST failing dimension.
 *
 * - `out_of_bounds`   — the SDK made more calls than the transcript declares
 *                       (over-call), or the transcript has unconsumed calls
 *                       left at finish (under-call; see `unconsumedTailCount`).
 * - `ordinal`         — the call arrived but `callOrdinal` is not `next + 1`
 *                       (gap, duplicate, or out-of-order).
 * - `namespace`       — namespace string differs.
 * - `method`          — method string differs (e.g. fixture declares `get` but
 *                       SDK issued `query`).
 * - `args_digest`     — namespace + method match but the RFC 8785 canonical
 *                       digest of the request args differs.
 */
export type CandidateFixtureMismatchDimension =
  | 'out_of_bounds'
  | 'ordinal'
  | 'namespace'
  | 'method'
  | 'args_digest';

/**
 * Sanitised evidence for a single fixture dispatch mismatch. Every field is
 * either a public identifier, a structural position, or a SHA-256 digest —
 * never a raw request/response value.
 */
export interface CandidateFixtureCallMismatchEvidenceV1 {
  readonly schemaVersion: typeof CANDIDATE_FIXTURE_MISMATCH_EVIDENCE_SCHEMA_VERSION;
  readonly dimension: CandidateFixtureMismatchDimension;
  /** The ordinal the SDK assigned to this call (1-based). */
  readonly callOrdinal: number;
  /** The ordinal the dispatcher expected (`next + 1`), or null for over-call. */
  readonly expectedOrdinal: number | null;
  readonly expectedNamespace: string | null;
  readonly actualNamespace: string | null;
  readonly expectedMethod: string | null;
  readonly actualMethod: string | null;
  /** SHA-256 over RFC 8785 canonical JSON of the expected fixture args. */
  readonly expectedRequestDigest: `sha256:${string}` | null;
  /** SHA-256 over RFC 8785 canonical JSON of the actual request args. */
  readonly actualRequestDigest: `sha256:${string}` | null;
  /**
   * RFC 6901 JSON Pointer of the first diverging position within the args.
   * Only populated when `dimension === 'args_digest'`. Identifies a POSITION
   * only (e.g. `/select`, `/where/0/field`); never carries the value.
   * `''` means the root itself diverges (type mismatch at top level).
   */
  readonly firstDivergingJsonPointer: string | null;
  /**
   * When the failure is an unconsumed tail (under-call at finish), the number
   * of fixture calls that were never consumed. Null for all other dimensions
   * and for over-call.
   */
  readonly unconsumedTailCount: number | null;
}

/**
 * Compute the first diverging JSON Pointer between two JSON values.
 *
 * Walks both trees in parallel, visiting object keys in RFC 8785 lexicographic
 * order (UTF-16 code units) so the "first" divergence is deterministic and
 * matches the canonical-serialisation order used by the digest comparison.
 *
 * Returns the RFC 6901 pointer string of the first position where the two
 * values differ structurally or by primitive value, or `null` if they are
 * deeply equal. The pointer identifies a POSITION only — it never exposes the
 * differing value.
 *
 * - Missing key in actual  → `/<key>` (key present in expected, absent in actual)
 * - Extra key in actual    → `/<key>` (key absent in expected, present in actual)
 * - Type mismatch          → current pointer (e.g. object vs array vs primitive)
 * - Primitive inequality   → current pointer
 * - Array length mismatch  → `/<index>` for the first out-of-bounds index
 *
 * `''` (empty string) is the root pointer per RFC 6901 §5; it means the two
 * top-level values have different JSON types (e.g. expected an object but
 * received a primitive).
 */
export function firstDivergingJsonPointer(
  expected: JsonValue,
  actual: JsonValue,
): string | null {
  return diverge(expected, actual, '');
}

function diverge(
  expected: JsonValue,
  actual: JsonValue,
  pointer: string,
): string | null {
  const eKind = jsonKind(expected);
  const aKind = jsonKind(actual);
  if (eKind !== aKind) {
    // Top-level type divergence — if we're at root, RFC 6901 root is ''.
    return pointer;
  }
  if (eKind === 'object') {
    const eObj = expected as Record<string, JsonValue>;
    const aObj = actual as Record<string, JsonValue>;
    const keys = sortedUnionKeys(eObj, aObj);
    for (const key of keys) {
      const childPointer = `${pointer}/${escapeJsonPointer(key)}`;
      const inExpected = Object.prototype.hasOwnProperty.call(eObj, key);
      const inActual = Object.prototype.hasOwnProperty.call(aObj, key);
      if (inExpected !== inActual) {
        return childPointer;
      }
      const childResult = diverge(eObj[key]!, aObj[key]!, childPointer);
      if (childResult !== null) {
        return childResult;
      }
    }
    return null;
  }
  if (eKind === 'array') {
    const eArr = expected as JsonValue[];
    const aArr = actual as JsonValue[];
    const max = Math.max(eArr.length, aArr.length);
    for (let i = 0; i < max; i++) {
      const childPointer = `${pointer}/${i}`;
      if (i >= eArr.length || i >= aArr.length) {
        return childPointer;
      }
      const childResult = diverge(eArr[i]!, aArr[i]!, childPointer);
      if (childResult !== null) {
        return childResult;
      }
    }
    return null;
  }
  // Primitive (string / number / boolean / null). `===` is correct for the JSON
  // subset: NaN/Infinity are not JSON, and -0 === 0 is fine because canonical
  // JSON normalises both to 0 (so their digests would match and we would not
  // reach here).
  return expected === actual ? null : pointer;
}

type JsonKind = 'object' | 'array' | 'primitive';

function jsonKind(value: JsonValue): JsonKind {
  if (value === null) return 'primitive';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'primitive';
}

function sortedUnionKeys(
  a: Record<string, JsonValue>,
  b: Record<string, JsonValue>,
): string[] {
  const set = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
  // RFC 8785 §3.2.3: lexicographic order by UTF-16 code unit — matches the
  // canonical-serialisation order used by the digest comparison, so the
  // "first" divergence is deterministic.
  return [...set].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
}

/**
 * Build the canonical request digest for a fixture call's args.
 * Convenience wrapper so the dispatcher doesn't re-import canonicalJsonDigest
 * for this specific purpose.
 */
export function fixtureArgsDigest(args: JsonValue): `sha256:${string}` {
  return canonicalJsonDigest(args);
}
