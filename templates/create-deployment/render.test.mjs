import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Standalone, dependency-free check that the skeleton renders the Release
// manifest release-operator expects, with and without a database binding.
// Like add-database's render test this is a minimal stand-in for the
// scaffolder's nunjucks, supporting only what the skeleton uses:
// `${{ values.a.b }}` and a whitespace-trimming `{%- if values.a.b %}` block.
//
// Run with: node --test templates/create-deployment/render.test.mjs

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'skeleton', 'release.yaml'), 'utf8');

const lookup = (values, path) =>
  path.split('.').reduce((obj, key) => (obj == null ? undefined : obj[key]), values);

function render(values) {
  const withBlocks = source.replace(
    /\s*\{%-\s*if\s+values\.([\w.]+)\s*%\}([\s\S]*?)\s*\{%-\s*endif\s*%\}/g,
    (_, path, body) => (lookup(values, path) ? body.replace(/\s+$/, '') : ''),
  );
  return withBlocks.replace(/\$\{\{\s*values\.([\w.]+)\s*\}\}/g, (_, path) => {
    const value = lookup(values, path);
    if (value === undefined) {
      throw new Error(`render: missing value "${path}"`);
    }
    return value;
  });
}

const SHA = 'ff5987e8395c2fc8f52f3cd078416830244b5019';

test('renders a Release with a database binding', () => {
  assert.equal(
    render({
      componentName: 'payments',
      environment: 'management',
      version: SHA,
      bindings: { database: 'payments-db' },
    }),
    `apiVersion: platform.taskapp.io/v1alpha1
kind: Release
metadata:
  name: payments-management
  labels:
    platform.taskapp.io/component: payments
spec:
  componentRef:
    name: payments
  environment: management
  version: "${SHA}"
  bindings:
    database:
      enabled: true
      ref: payments-db
`,
  );
});

test('renders a Release with no bindings block when nothing is bound', () => {
  assert.equal(
    render({ componentName: 'payments', environment: 'management', version: SHA, bindings: {} }),
    `apiVersion: platform.taskapp.io/v1alpha1
kind: Release
metadata:
  name: payments-management
  labels:
    platform.taskapp.io/component: payments
spec:
  componentRef:
    name: payments
  environment: management
  version: "${SHA}"
`,
  );
});
