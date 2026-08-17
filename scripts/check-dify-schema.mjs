#!/usr/bin/env node
/**
 * Guards the Dify custom-tool schema: it must stay well-formed YAML with an
 * openapi field and at least one path. Run via `npm run check:dify` after a
 * root install (js-yaml is a root devDependency).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml');

const schemaPath = new URL(
  '../governance/adapters/dify/openapi.yaml',
  import.meta.url,
);
const doc = yaml.load(readFileSync(schemaPath, 'utf8'));

if (!doc || typeof doc !== 'object' || !doc.openapi) {
  console.error('dify openapi.yaml: openapi field missing');
  process.exit(1);
}
const paths = Object.keys(doc.paths ?? {});
if (paths.length === 0) {
  console.error('dify openapi.yaml: no paths defined');
  process.exit(1);
}
console.log(
  `dify openapi.yaml: valid YAML — openapi ${doc.openapi}, ${paths.length} paths`,
);
