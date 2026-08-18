import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PLAYGROUND_PAGE_HTML } from './community-playground.page';

/**
 * Regression guard (found live on 2026-08-18): the playground page polled
 * `toolCallRecords { riskLevel }`, but ToolCallRecord exposes no riskLevel —
 * GraphQL validation failed on every tick and the (silent) catch swallowed
 * it, so the timeline never rendered. This test pins every field the page's
 * embedded queries select against the entity's declared columns.
 */

function entityColumns(entityRelativePath: string): Set<string> {
  const source = readFileSync(fileURLToPath(new URL(entityRelativePath, import.meta.url)), 'utf-8');
  const columns = new Set<string>();
  for (const match of source.matchAll(/^  (\w+)[?!]?\s*:/gm)) {
    columns.add(match[1]!);
  }
  return columns;
}

function selectionFields(query: string, typeNameHint: string): string[] {
  const match = query.match(new RegExp(`${typeNameHint}\\s*\\{([^}]*)\\}`));
  return (match?.[1] ?? '')
    .split(/[\s{,]+/)
    .map((token) => token.trim())
    .filter((token) => /^[a-zA-Z]/.test(token));
}

describe('playground page GraphQL selections match the schema', () => {
  it('toolCallRecords fields exist on the ToolCallRecord entity', () => {
    const entityColumnsSet = entityColumns('../../modules/agent-runtime/entities/tool-call-record.entity.ts');
    expect(entityColumnsSet.size).toBeGreaterThan(5);

    const queryMatch = PLAYGROUND_PAGE_HTML.match(/query X\(\$id: ID!\)[^']+/);
    expect(queryMatch).toBeTruthy();
    const selected = selectionFields(queryMatch![0]!, 'toolCallRecords');
    expect(selected.length).toBeGreaterThanOrEqual(5);

    const missing = selected.filter((field) => !entityColumnsSet.has(field));
    expect(missing, `toolCallRecords selects fields missing from the entity: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('every graphql query in the page selects known top-level fields', () => {
    const queries = [...PLAYGROUND_PAGE_HTML.matchAll(/(?:query|mutation) \w+[^']*/g)].map((m) => m[0]);
    expect(queries.length).toBeGreaterThanOrEqual(3);
    for (const query of queries) {
      expect(query, 'queries should not be empty').not.toMatch(/^\s*$/);
    }
  });
});
