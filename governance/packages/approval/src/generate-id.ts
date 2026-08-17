import { v7 as uuidv7 } from 'uuid';

/** UUIDv7 (RFC 9562): time-ordered, unpredictable, coordination-free. */
export function generateId(): string {
  return uuidv7();
}
