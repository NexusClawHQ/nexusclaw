import 'reflect-metadata';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import pg from 'pg';

import { OutboxService, OutboxRequestContextMissingError, OutboxPayloadInvalidError, InMemoryTransport, OutboxEvent } from '../src/index.js';

const HOST = process.env.OUTBOX_TEST_PGHOST ?? 'localhost';
const PORT = Number(process.env.OUTBOX_TEST_PGPORT ?? 5432);
const USER = process.env.OUTBOX_TEST_PGUSER ?? 'postgres';
const PASSWORD = process.env.OUTBOX_TEST_PGPASSWORD ?? 'postgres';
const DB = 'nexusclaw_outbox_verify_tmp';

const trace = { traceId: 'trace-1', correlationId: 'corr-1', executionId: 'exec-1' };

describe('OutboxService (transactional enqueue, real Postgres)', () => {
  let admin: pg.Client;
  let dataSource: DataSource;
  let transport: InMemoryTransport;
  let service: OutboxService;

  beforeAll(async () => {
    admin = new pg.Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: 'postgres' });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${DB}`);
    await admin.query(`CREATE DATABASE ${DB}`);
    await admin.end();

    dataSource = new DataSource({
      type: 'postgres',
      host: HOST,
      port: PORT,
      username: USER,
      password: PASSWORD,
      database: DB,
      entities: [OutboxEvent],
      synchronize: true,
    });
    await dataSource.initialize();

    transport = new InMemoryTransport();
    service = new OutboxService(dataSource, {
      getTraceContext: () => trace,
      transport,
    });
  });

  afterAll(async () => {
    await dataSource.destroy();
    const cleanup = new pg.Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: 'postgres' });
    await cleanup.connect();
    await cleanup.query(`DROP DATABASE IF EXISTS ${DB}`);
    await cleanup.end();
  });

  const event = {
    workspaceId: '00000000-0000-4000-8000-000000000001',
    topic: 'queue_events',
    eventType: 'queue.job.enqueued',
    aggregateType: 'QueueDefinition',
    aggregateId: 'q-1',
    payload: { jobId: 'j-1' },
  };

  it('persists the row and notifies exactly once per topic after commit', async () => {
    transport.reset();
    const id = await service.runInTransaction(async (_manager, outbox) => {
      await outbox.enqueue(event);
      await outbox.enqueue({ ...event, aggregateId: 'q-2', payload: { jobId: 'j-2' } });
      return 'ok';
    });
    expect(id).toBe('ok');

    const rows = await dataSource.getRepository(OutboxEvent).find();
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.publishedAt === null && row.attemptCount === 0)).toBe(true);
    expect(rows[0]!.traceContext).toMatchObject({ traceId: 'trace-1', correlationId: 'corr-1' });
    // Two enqueues, one topic -> one coalesced notify
    expect(transport.notifiedTopics).toEqual(['queue_events']);
  });

  it('notifies once per distinct topic', async () => {
    transport.reset();
    await service.runInTransaction(async (_manager, outbox) => {
      await outbox.enqueue(event);
      await outbox.enqueue({ ...event, topic: 'file_events', eventType: 'file.uploaded', aggregateType: 'ContentDocument', aggregateId: 'f-1' });
    });
    expect(transport.notifiedTopics.sort()).toEqual(['file_events', 'queue_events']);
  });

  it('rolls back the row AND the notify when the callback throws', async () => {
    transport.reset();
    await expect(
      service.runInTransaction(async (_manager, outbox) => {
        await outbox.enqueue(event);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const count = await dataSource.getRepository(OutboxEvent).count();
    expect(count).toBe(4); // two from the first test + two from the second
    expect(transport.notifiedTopics).toEqual([]);
  });

  it('fails closed when no trace context is provided', async () => {
    const noTrace = new OutboxService(dataSource, { transport: new InMemoryTransport() });
    await expect(
      noTrace.runInTransaction(async (_manager, outbox) => {
        await outbox.enqueue(event);
      }),
    ).rejects.toBeInstanceOf(OutboxRequestContextMissingError);
  });

  it('rejects payloads that violate the shared schema', async () => {
    await expect(
      service.runInTransaction(async (_manager, outbox) => {
        await outbox.enqueue({ ...event, eventType: '' });
      }),
    ).rejects.toBeInstanceOf(OutboxPayloadInvalidError);
  });

  it('enqueueInTransaction requires an explicit notifyTopic at txn end', async () => {
    transport.reset();
    await dataSource.transaction(async (manager) => {
      await service.enqueueInTransaction(manager, event);
      await service.notifyTopic(manager, event.topic);
    });
    expect(transport.notifiedTopics).toEqual(['queue_events']);
  });
});
