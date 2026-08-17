import type { EntityManager } from 'typeorm';

/**
 * Notification seam of the transactional outbox.
 *
 * The core invariant is that the wake-up must be issued INSIDE the producing
 * transaction (Postgres queues NOTIFY until COMMIT), so the transport
 * receives the EntityManager and runs within the caller's transaction.
 * Implementations:
 *   - PgNotifyTransport  — `pg_notify('outbox_pending', topic)` (default)
 *   - InMemoryTransport  — buffers topics for tests / single-process use
 */
export interface OutboxNotifyTransport {
  notify(manager: EntityManager, topic: string): Promise<void>;
}
