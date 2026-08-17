import type { EntityManager } from 'typeorm';
import type { OutboxNotifyTransport } from './outbox-transport.port.js';

/**
 * Default transport: `SELECT pg_notify('outbox_pending', $1)` inside the
 * producing transaction. The channel name is a stable identifier; only the
 * topic payload varies (parameterised to avoid quoting bugs).
 */
export class PgNotifyTransport implements OutboxNotifyTransport {
  async notify(manager: EntityManager, topic: string): Promise<void> {
    await manager.query(`SELECT pg_notify('outbox_pending', $1)`, [topic]);
  }
}
