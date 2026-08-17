import { v7 as uuidv7 } from 'uuid';

/**
 * UUIDv7 (RFC 9562): time-ordered, unpredictable, coordination-free.
 * Extracted from nexusclaw-core common/utils/generate-id.
 */
export function generateId(): string {
  return uuidv7();
}
