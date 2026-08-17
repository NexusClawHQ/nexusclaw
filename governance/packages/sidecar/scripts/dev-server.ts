/**
 * Boot the governance sidecar for local development / adapter integration
 * tests. Scratch database (dropped on exit) + gate grants from
 * SIDECAR_GATE_ALLOWED_TOOLS or the default demo set.
 */
import 'reflect-metadata';
import pg from 'pg';
import { buildSidecarRuntime } from '../src/runtime.js';
import { createSidecarServer } from '../src/server.js';

const HOST = process.env.SIDECAR_PGHOST ?? 'localhost';
const PORT = Number(process.env.SIDECAR_PGPORT ?? 5432);
const USER = process.env.SIDECAR_PGUSER ?? 'postgres';
const PASSWORD = process.env.SIDECAR_PGPASSWORD ?? 'postgres';
const DB = process.env.SIDECAR_PGDATABASE ?? 'nexusclaw_sidecar_dev_tmp';
const LISTEN = Number(process.env.SIDECAR_PORT ?? 7899);

async function main(): Promise<void> {
  const admin = new pg.Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: 'postgres' });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DB}`);
  await admin.query(`CREATE DATABASE ${DB}`);
  await admin.end();

  const runtime = await buildSidecarRuntime({
    host: HOST, port: PORT, user: USER, password: PASSWORD, database: DB,
    gateAllowedTools: ['crm.update_customer', 'demo.send_followup_email'],
  });
  const server = createSidecarServer(runtime);
  const { url, close } = await server.listen(LISTEN);
  console.log(`SIDECAR_READY ${url}`);

  const shutdown = async () => {
    await close();
    await runtime.close();
    const cleanup = new pg.Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: 'postgres' });
    await cleanup.connect();
    await cleanup.query(`DROP DATABASE IF EXISTS ${DB}`);
    await cleanup.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error) => {
  console.error('sidecar dev server failed:', error);
  process.exit(1);
});
