import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Red-line gate (Phase E2): kernel packages take NO external runtime
 * dependencies — only workspace-internal @agent-governance/* references are
 * allowed. Grandfathered exceptions (legacy, tracked as debt): the `uuid`
 * package in guardrail/approval/audit-chain and `zod` in outbox. Only
 * @agent-governance/sidecar — the assembly layer — may declare arbitrary
 * runtime dependencies.
 */
const PACKAGES = [
  'contracts', 'permission', 'guardrail', 'approval',
  'audit-chain', 'outbox', 'governor', 'executor',
] as const;

const GRANDFATHERED: Record<string, string[]> = {
  guardrail: ['uuid'],
  approval: ['uuid'],
  'audit-chain': ['uuid'],
  outbox: ['uuid', 'zod'],
};

describe('kernel zero-dependency red line', () => {
  it.each(PACKAGES)('@agent-governance/%s takes no external runtime dependencies', async (name) => {
    const manifest = JSON.parse(
      await readFile(fileURLToPath(new URL(`../../${name}/package.json`, import.meta.url)), 'utf-8'),
    ) as { dependencies?: Record<string, string> };
    const external = Object.keys(manifest.dependencies ?? {})
      .filter((dep) => !dep.startsWith('@agent-governance/'))
      .filter((dep) => !(GRANDFATHERED[name] ?? []).includes(dep));
    expect(external, `${name} must not add external runtime deps`).toHaveLength(0);
  });

  it('sidecar is the only package with runtime dependencies', async () => {
    const manifest = JSON.parse(
      await readFile(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8'),
    ) as { dependencies: Record<string, string> };
    expect(Object.keys(manifest.dependencies).length).toBeGreaterThan(0);
  });
});
