import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Standalone, dependency-free check that the skeleton renders the Database
// manifest BACKSTAGE_PART3.md's Definition of Done expects. Not a test of
// Backstage's own fetch:template/publish:github:pull-request actions —
// those are the platform's dependency, not ours to test here.
//
// Run with: node --test templates/add-database/render.test.mjs

const here = dirname(fileURLToPath(import.meta.url));
const skeletonDir = join(here, 'skeleton');

function render(values) {
  const [file] = readdirSync(skeletonDir);
  const source = readFileSync(join(skeletonDir, file), 'utf8');
  return source.replace(/\$\{\{\s*values\.(\w+)\s*\}\}/g, (_, key) => {
    if (!(key in values)) {
      throw new Error(`render: missing value "${key}"`);
    }
    return values[key];
  });
}

test('renders a Database manifest matching the current Database XRD', () => {
  const rendered = render({
    componentName: 'checkout',
    dbName: 'checkoutdb',
    size: 'small',
  });

  assert.equal(
    rendered,
    `apiVersion: database.taskapp.io/v1alpha1
kind: Database
metadata:
  name: checkout-db
  labels:
    platform.taskapp.io/component: checkout
spec:
  componentRef:
    name: checkout
  dbName: checkoutdb
  size: small
`,
  );
});

test('destination path is platform/environments/<environment>/<component>-db.yaml', () => {
  const environment = 'dev';
  const componentName = 'checkout';
  const path = `platform/environments/${environment}/${componentName}-db.yaml`;

  assert.equal(path, 'platform/environments/dev/checkout-db.yaml');
});
