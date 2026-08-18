import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { COMMUNITY_DEMO_CONSOLE_STYLES } from './community-demo-console.styles';
import { COMMUNITY_DEMO_CONSOLE_BODY } from './community-demo-console.body';
import { COMMUNITY_DEMO_CONSOLE_SCRIPT } from './community-demo-console.script';
import { COMMUNITY_DEMO_CONSOLE_HTML } from './community-demo-console.page';

/**
 * Guard tests for the single-file demo console (spec
 * console-experience-byo-model, AC-1.7 / AC-1.8 / AC-1.4 / AC-1.1).
 *
 * These scan the literal page content — the same bytes the browser receives.
 */

const EXECUTION_STATUS_CODES = [
  'pending',
  'running',
  'guardrail_pending',
  'done',
  'failed',
  'timeout',
  'cancelled',
] as const;

/** Extract the COPY map's zh / en key sets from the literal script text. */
function copyKeys(section: 'zh' | 'en'): Set<string> {
  const marker = '    ' + section + ': {';
  const start = COMMUNITY_DEMO_CONSOLE_SCRIPT.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const rest = COMMUNITY_DEMO_CONSOLE_SCRIPT.slice(start + marker.length);
  // The section ends at a closing brace on its own line (`    },` for zh,
  // `    }` for en — it is the last map entry).
  const lines = rest.split('\n');
  const bodyLines: string[] = [];
  for (const line of lines) {
    if (/^ {4}\},?$/.test(line)) break;
    bodyLines.push(line);
  }
  const keys = new Set<string>();
  // Keys are `'code':` pairs — several may share a line.
  for (const match of bodyLines.join('\n').matchAll(/'([^']+)':\s*'/g)) {
    keys.add(match[1]);
  }
  return keys;
}

describe('console guard: injection safety (AC-1.8)', () => {
  it('never assigns untrusted data through innerHTML or insertAdjacentHTML', () => {
    expect(COMMUNITY_DEMO_CONSOLE_SCRIPT).not.toMatch(/\.innerHTML\s*=/);
    expect(COMMUNITY_DEMO_CONSOLE_SCRIPT).not.toMatch(/insertAdjacentHTML/);
    expect(COMMUNITY_DEMO_CONSOLE_SCRIPT).not.toMatch(/document\.write/);
    expect(COMMUNITY_DEMO_CONSOLE_BODY).not.toMatch(/\bon[a-z]+\s*=\s*["']/);
  });

  it('assembles the three parts into a complete document', () => {
    expect(COMMUNITY_DEMO_CONSOLE_HTML).toContain('<!doctype html>');
    expect(COMMUNITY_DEMO_CONSOLE_HTML).toContain('</html>');
    expect(COMMUNITY_DEMO_CONSOLE_HTML).toContain(COMMUNITY_DEMO_CONSOLE_STYLES.trim().slice(0, 40));
    expect(COMMUNITY_DEMO_CONSOLE_HTML).toContain(COMMUNITY_DEMO_CONSOLE_BODY.trim().slice(0, 30));
    expect(COMMUNITY_DEMO_CONSOLE_HTML).toContain(COMMUNITY_DEMO_CONSOLE_SCRIPT.trim().slice(0, 30));
    expect(COMMUNITY_DEMO_CONSOLE_HTML).toContain('communityModelSource');
  });
});

describe('console guard: i18n parity (AC-1.7)', () => {
  it('zh and en COPY maps carry identical key sets', () => {
    const zh = copyKeys('zh');
    const en = copyKeys('en');
    expect(zh.size).toBeGreaterThan(0);
    expect([...zh]).toEqual(expect.arrayContaining([...en]));
    expect([...en]).toEqual(expect.arrayContaining([...zh]));
  });

  it('ships both run.hint modes and model badge copy', () => {
    const zh = copyKeys('zh');
    for (const key of [
      'run.hint.smoke',
      'run.hint.byo',
      'model.smoke',
      'model.byo',
      'model.note.smoke',
      'model.note.byo',
    ]) {
      expect(zh.has(key)).toBe(true);
    }
  });
});

describe('console guard: stable status keys (AC-1.4)', () => {
  it('status.* COPY keys are exactly the executor status codes', () => {
    const zh = [...copyKeys('zh')]
      .filter((key) => key.startsWith('status.'))
      .map((key) => key.slice('status.'.length))
      .sort();
    expect(zh).toEqual([...EXECUTION_STATUS_CODES].sort());
  });

  it('chips are classed by status code, never by display string', () => {
    for (const code of EXECUTION_STATUS_CODES) {
      expect(COMMUNITY_DEMO_CONSOLE_STYLES).toContain('.chip.s-' + code);
    }
  });
});

describe('console guard: zero external resources (AC-1.1)', () => {
  it('styles contain no CDN / import / url references', () => {
    expect(COMMUNITY_DEMO_CONSOLE_STYLES).not.toMatch(/@import/);
    expect(COMMUNITY_DEMO_CONSOLE_STYLES).not.toMatch(/url\(/);
    expect(COMMUNITY_DEMO_CONSOLE_STYLES).not.toMatch(/https?:\/\//);
  });

  it('body pulls no external scripts, styles or fonts', () => {
    expect(COMMUNITY_DEMO_CONSOLE_BODY).not.toMatch(/<link/i);
    expect(COMMUNITY_DEMO_CONSOLE_BODY).not.toMatch(/<script[^>]+src=/i);
    expect(COMMUNITY_DEMO_CONSOLE_BODY).not.toMatch(/https?:\/\//);
  });
});

describe('console guard: accessibility baseline (AC-1.9)', () => {
  it('tabs use ARIA roles and panels are labelled', () => {
    expect(COMMUNITY_DEMO_CONSOLE_BODY).toContain('role="tablist"');
    expect(COMMUNITY_DEMO_CONSOLE_BODY).toContain('aria-labelledby');
    const tabCount = (COMMUNITY_DEMO_CONSOLE_BODY.match(/role="tab"/g) ?? []).length;
    expect(tabCount).toBe(3);
  });

  it('the source files are tracked in this repository snapshot', () => {
    // Cheap canary that the literal parts stay in-repo (no generated assets).
    const page = readFileSync(new URL('./community-demo-console.page.ts', import.meta.url), 'utf8');
    expect(page).toContain('COMMUNITY_DEMO_CONSOLE_STYLES');
  });
});
