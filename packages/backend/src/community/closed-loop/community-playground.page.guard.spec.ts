import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { PLAYGROUND_PAGE_HTML } from './community-playground.page';

/**
 * Guard tests for the playground landing page (spec hosted-playground
 * AC-5.4) — same invariants as the /console page.
 */

function copyKeys(section: 'zh' | 'en'): Set<string> {
  const marker = '    ' + section + ': {';
  const start = PLAYGROUND_PAGE_HTML.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const rest = PLAYGROUND_PAGE_HTML.slice(start + marker.length);
  const lines: string[] = [];
  for (const line of rest.split('\n')) {
    if (/^ {4}\},?$/.test(line)) break;
    lines.push(line);
  }
  const keys = new Set<string>();
  for (const match of lines.join('\n').matchAll(/'([^']+)':\s*'/g)) {
    keys.add(match[1]);
  }
  return keys;
}

describe('playground page guard (AC-5.4)', () => {
  it('renders untrusted data via textContent only — no innerHTML assignments', () => {
    expect(PLAYGROUND_PAGE_HTML).not.toMatch(/\.innerHTML\s*=/);
    expect(PLAYGROUND_PAGE_HTML).not.toMatch(/insertAdjacentHTML/);
    expect(PLAYGROUND_PAGE_HTML).not.toMatch(/document\.write/);
  });

  it('pulls zero external resources', () => {
    expect(PLAYGROUND_PAGE_HTML).not.toMatch(/<link/i);
    expect(PLAYGROUND_PAGE_HTML).not.toMatch(/<script[^>]+src=/i);
    expect(PLAYGROUND_PAGE_HTML).not.toMatch(/https?:\/\/[^"']*\.(js|css|woff)/i);
  });

  it('carries identical zh/en COPY key sets', () => {
    const zh = copyKeys('zh');
    const en = copyKeys('en');
    expect([...zh]).toEqual(expect.arrayContaining([...en]));
    expect([...en]).toEqual(expect.arrayContaining([...zh]));
  });

  it('keeps the session token in memory only (no storage persistence)', () => {
    expect(PLAYGROUND_PAGE_HTML).not.toMatch(/localStorage/);
    expect(PLAYGROUND_PAGE_HTML).not.toMatch(/sessionStorage/);
  });

  it('is a complete standalone document served as a constant', () => {
    expect(PLAYGROUND_PAGE_HTML).toContain('<!doctype html>');
    expect(PLAYGROUND_PAGE_HTML).toContain('</html>');
    const source = readFileSync(
      new URL('./community-playground.page.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain('PLAYGROUND_PAGE_HTML');
  });
});
