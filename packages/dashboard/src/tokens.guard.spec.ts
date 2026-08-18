import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * Token guard (spec showcase-visual-refinement AC-5.2 / design.md §2).
 *
 * The dashboard and the single-file console implement the SAME design-token
 * table with different variable naming. This guard parses both `:root` blocks
 * and asserts the mapped tokens carry identical values — the regression gate
 * that keeps the two frontends from drifting apart.
 */

const DASHBOARD_CSS = readFileSync(
  new URL('./styles.css', import.meta.url),
  'utf8',
);

const CONSOLE_STYLES_TS = readFileSync(
  new URL(
    '../../backend/src/community/closed-loop/community-demo-console.styles.ts',
    import.meta.url,
  ),
  'utf8',
);

function rootTokens(source: string): Record<string, string> {
  const start = source.indexOf(':root');
  const end = source.indexOf('}', start);
  const block = source.slice(start, end);
  const tokens: Record<string, string> = {};
  for (const match of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

/** dashboard token → console token (unified table, design.md §2.1). */
const TOKEN_MAP: Array<[string, string]> = [
  ['bg', 'bg'],
  ['panel', 'card'],
  ['text', 'ink'],
  ['muted', 'muted'],
  ['border', 'line'],
  ['accent', 'brand'],
  ['accent-soft', 'brand-soft'],
  ['ok', 'ok'],
  ['warn', 'warn'],
  ['bad', 'err'],
  ['info', 'run'],
  ['json-bg', 'json-bg'],
  ['json-ink', 'json-ink'],
  ['radius-sm', 'radius-sm'],
  ['radius-md', 'radius-md'],
  ['sp-4', 'sp-4'],
];

describe('unified design tokens (AC-5.2)', () => {
  it('dashboard and console :root blocks exist', () => {
    expect(DASHBOARD_CSS).toContain(':root');
    expect(CONSOLE_STYLES_TS).toContain(':root');
  });

  it.each(TOKEN_MAP)('token --%s matches console --%s', (dash, cons) => {
    const dashboardTokens = rootTokens(DASHBOARD_CSS);
    const consoleTokens = rootTokens(CONSOLE_STYLES_TS);
    expect(dashboardTokens[dash], `dashboard --${dash}`).toBeDefined();
    expect(consoleTokens[cons], `console --${cons}`).toBeDefined();
    expect(dashboardTokens[dash]).toBe(consoleTokens[cons]);
  });

  it('dashboard carries the compact rhythm constants (design.md §2.2)', () => {
    const tokens = rootTokens(DASHBOARD_CSS);
    expect(tokens['sidebar-w']).toBe('236px');
    expect(tokens['header-h']).toBe('64px');
  });
});
