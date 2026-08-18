#!/usr/bin/env node
/**
 * Zero-config sidecar boot — the "one command" evaluation path:
 *
 *   npx @agent-governance/sidecar            (memory storage + demo scenario + MCP gateway)
 *
 * No .env, no provisioned Postgres: `memory` storage runs an embedded
 * Postgres (PGlite/WASM) on a local socket with the same audit-chain schema
 * as production. Everything is overrideable:
 *   SIDECAR_STORAGE=local      persist to ./.agent-governance-data (PGlite)
 *   SIDECAR_STORAGE=postgres   use a real Postgres (SIDECAR_PG* envs)
 *   SIDECAR_PORT=7899          listen port
 *   SIDECAR_MCP_DEMO=none      disable the MCP demo upstream
 */
import 'reflect-metadata';
import { buildSidecarRuntime } from '../runtime.js';
import { createSidecarServer } from '../server.js';
import { attachMcpGateway, bootstrapMcpFromEnv } from '../mcp/bootstrap.js';

async function main(): Promise<void> {
  const startedAt = Date.now();
  process.env.SIDECAR_MCP_DEMO ??= 'memory';
  const port = Number(process.env.SIDECAR_PORT ?? 7899);
  const storage = (process.env.SIDECAR_STORAGE ?? 'memory') as 'memory' | 'local' | 'postgres';

  const envAllowed = (process.env.SIDECAR_GATE_ALLOWED_TOOLS ?? '')
    .split(',').map((tool) => tool.trim()).filter(Boolean);
  const mcp = await bootstrapMcpFromEnv();
  const gateAllowedTools = [...envAllowed, ...mcp.extraAllowedTools];

  const runtime = await buildSidecarRuntime({
    storage,
    gateAllowedTools,
    extraGuardrailRules: mcp.extraGuardrailRules,
  });
  const server = createSidecarServer(runtime);
  await attachMcpGateway(server.app, runtime, mcp, gateAllowedTools);

  let exporter: import('../otel/otel-audit-exporter.js').OtelAuditExporter | undefined;
  if (process.env.SIDECAR_OTLP_ENDPOINT) {
    const { OtelAuditExporter } = await import('../otel/otel-audit-exporter.js');
    exporter = new OtelAuditExporter(runtime, { endpoint: process.env.SIDECAR_OTLP_ENDPOINT });
    exporter.start();
  }

  const { url, close } = await server.listen(port);
  const elapsed = Date.now() - startedAt;
  console.log(`SIDECAR_READY ${url} (+${elapsed}ms, storage=${runtime.storage})`);
  console.log(`SIDECAR_CONSOLE ${url}/console`);
  if (mcp.enabled) console.log(`SIDECAR_MCP_READY ${url}/mcp (stateless Streamable HTTP)`);
  if (exporter) console.log(`SIDECAR_OTEL_READY ${process.env.SIDECAR_OTLP_ENDPOINT}/v1/traces`);

  const shutdown = async () => {
    await exporter?.stop();
    await close();
    await runtime.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error) => {
  console.error('sidecar failed to start:', error);
  process.exit(1);
});
