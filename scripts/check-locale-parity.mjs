#!/usr/bin/env node
/**
 * Fails when the en-US and zh-CN locale trees drift apart. Runs against the
 * compiled packages/shared output — the root `check:i18n` script rebuilds
 * @nexusclaw/shared first so dist always matches src.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const flatten = (node, prefix = '', out = new Set()) => {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out.add(path);
    }
  }
  return out;
};

const en = flatten(require('../packages/shared/dist/locales/en-US.js'));
const zh = flatten(require('../packages/shared/dist/locales/zh-CN.js'));

const missingInZh = [...en].filter((key) => !zh.has(key));
const missingInEn = [...zh].filter((key) => !en.has(key));

console.log(`en-US keys: ${en.size}`);
console.log(`zh-CN keys: ${zh.size}`);

if (missingInZh.length > 0 || missingInEn.length > 0) {
  if (missingInZh.length > 0) {
    console.error(`missing in zh-CN (${missingInZh.length}):`);
    for (const key of missingInZh.slice(0, 20)) console.error(`  - ${key}`);
  }
  if (missingInEn.length > 0) {
    console.error(`missing in en-US (${missingInEn.length}):`);
    for (const key of missingInEn.slice(0, 20)) console.error(`  - ${key}`);
  }
  process.exit(1);
}

console.log('locale trees aligned — no missing keys in either direction');
