#!/usr/bin/env node
/**
 * Structural boundary gate for the Community tree.
 *
 * Fails when `packages/shared/src` drifts outside the published Community
 * boundary: top-level entries must be explicitly allowlisted, the trimmed
 * `agent-executable-assets` module must contain only its five contract files,
 * path names must not carry commercial-edition vocabulary, and the locale
 * files must stay small. Together with `check:i18n` (key-count ceiling) this
 * is the regression gate that keeps an exclusion-based snapshot export from
 * ever re-leaking enterprise assets — see docs/snapshot-export-policy.md.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SHARED_SRC = 'packages/shared/src';
const LOCALES_DIR = join(SHARED_SRC, 'locales');
const AEA_DIR = join(SHARED_SRC, 'agent-executable-assets');

const ALLOWED_SHARED_ENTRIES = new Set([
  'index.ts',
  'community-capabilities.ts',
  'package-payload.ts',
  'system-object-persistence.ts',
  'workspace-regional-settings.ts',
  'agent-avatars',
  'agent-executable-assets',
  'agent-markdown-policy',
  'locales',
  'source-format',
]);

const ALLOWED_AEA_FILES = new Set([
  'index.ts',
  'canonical-hash.ts',
  'code-action.types.ts',
  'json-value.ts',
  'release-evidence.types.ts',
]);

// Mirrors ROADMAP.md "Deliberately out of the Community edition" plus the
// commercial domains identified in the 2026-08 boundary audit.
const BANNED_NAME_PATTERN =
  /(platform-admin|employee-package|workforce|billing|cpq|telephony|journey-builder|page-builder|flow-editor|record-page-builder|dashboard-workbench|trial-console|ai-workforce-learning|agent-builder-ui)/i;

const MAX_LOCALE_LINES = 200;

const errors = [];

for (const entry of readdirSync(SHARED_SRC)) {
  if (!ALLOWED_SHARED_ENTRIES.has(entry)) {
    errors.push(`shared/src entry not on the Community allowlist: ${entry}`);
  }
}

for (const entry of readdirSync(AEA_DIR)) {
  if (!ALLOWED_AEA_FILES.has(entry)) {
    errors.push(
      `agent-executable-assets file not on the Community allowlist: ${entry}`,
    );
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path);
    }
    if (BANNED_NAME_PATTERN.test(entry)) {
      errors.push(`commercial-edition path name in Community tree: ${path}`);
    }
  }
}
walk(SHARED_SRC);

for (const locale of ['en-US.ts', 'zh-CN.ts']) {
  const lines = readFileSync(join(LOCALES_DIR, locale), 'utf8').split('\n').length;
  if (lines > MAX_LOCALE_LINES) {
    errors.push(
      `${LOCALES_DIR}/${locale} is ${lines} lines (max ${MAX_LOCALE_LINES}) — ` +
        'commercial locale trees must not be re-imported',
    );
  }
}

if (errors.length > 0) {
  console.error(`community boundary violations (${errors.length}):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  'community boundary intact — shared/src allowlist, contract-file allowlist, ' +
    'name patterns and locale size all within policy',
);
