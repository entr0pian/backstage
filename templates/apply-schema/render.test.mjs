import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Standalone, dependency-free check that the skeleton renders the
// DatabaseSchema schema-operator expects. A minimal stand-in for the
// scaffolder's nunjucks, supporting only what the skeleton uses:
// `${{ values.a }}`.
//
// Run with: node --test templates/apply-schema/render.test.mjs

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'skeleton', 'schema.yaml'), 'utf8');

function render(values) {
  return source.replace(/\$\{\{\s*values\.(\w+)\s*\}\}/g, (_, key) => {
    if (values[key] === undefined) {
      throw new Error(`render: missing value "${key}"`);
    }
    return values[key];
  });
}

const SHA = 'ff5987e8395c2fc8f52f3cd078416830244b5019';

test('renders a DatabaseSchema for the component', () => {
  assert.equal(
    render({ componentName: 'orders', version: SHA }),
    `apiVersion: platform.taskapp.io/v1alpha1
kind: DatabaseSchema
metadata:
  name: orders
  labels:
    platform.taskapp.io/component: orders
spec:
  componentRef:
    name: orders
  version: "${SHA}"
`,
  );
});

test('only uses values the template passes', () => {
  assert.throws(() => render({ componentName: 'orders' }), /missing value "version"/);
});
