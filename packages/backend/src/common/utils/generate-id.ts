import { v5 as uuidv5, v7 as uuidv7 } from 'uuid';

/**
 * Generate a UUIDv7 identifier.
 *
 * UUIDv7 (RFC 9562) embeds a Unix-epoch millisecond timestamp in the
 * high 48 bits, followed by random data.  This gives us:
 *
 *  - Time-ordered: B-Tree friendly, no page-split write amplification.
 *  - Unpredictable: random tail prevents enumeration attacks.
 *  - Distributed-safe: no coordination needed across nodes.
 *  - Standard UUID format: drop-in replacement for UUIDv4 columns.
 */
export function generateId(): string {
  return uuidv7();
}

/**
 * Fixed application namespace (RFC 9562 §5.5) for deriving deterministic
 * UUIDv5 identifiers from human-readable keys. Generated once and frozen —
 * changing this value would silently re-map every id ever derived from it.
 */
const STABLE_ID_NAMESPACE = '20ab8d53-5d65-5cd7-a266-c58dbf0e8994';

/**
 * Derive a stable UUIDv5 from a human-readable key. The same key always
 * maps to the same UUID, so it is safe to store in a `uuid` column that
 * must reference an entity which has no natural surrogate UUID of its own
 * (e.g. a metadata package keyed by `${workspaceId}:${name}`).
 *
 * Unlike {@link generateId}, this is reproducible: callers across the
 * install / upgrade / rollback lifecycle that pass the same key all land
 * on the same id, so the audit trail naturally groups by target.
 */
export function deriveStableId(key: string): string {
  return uuidv5(key, STABLE_ID_NAMESPACE);
}
