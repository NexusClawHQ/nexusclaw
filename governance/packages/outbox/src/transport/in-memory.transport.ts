import type { EntityManager } from 'typeorm';
import type { OutboxNotifyTransport } from './outbox-transport.port.js';

/**
 * Test / single-process transport: records every notified topic instead of
 * emitting a Postgres NOTIFY. Useful for unit and integration tests that
 * assert the coalesced wake-up contract without a LISTEN connection.
 */
export class InMemoryTransport implements OutboxNotifyTransport {
  readonly notifiedTopics: string[] = [];

  async notify(_manager: EntityManager, topic: string): Promise<void> {
    this.notifiedTopics.push(topic);
  }

  reset(): void {
    this.notifiedTopics.length = 0;
  }
}
