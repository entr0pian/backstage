import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Standalone, dependency-free check that the skeleton renders the Release
// manifest release-operator expects: pinned or auto-deploy, with and
// without a database binding. Like add-database's render test this is a
// minimal stand-in for the scaffolder's nunjucks, supporting only what the
// skeleton uses: `${{ values.a.b }}` and a whitespace-trimming
// `{%- if values.a.b %}` block with an optional `{%- else %}`.
//
// Run with: node --test templates/create-deployment/render.test.mjs

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'skeleton', 'release.yaml'), 'utf8');

const lookup = (values, path) =>
  path.split('.').reduce((obj, key) => (obj == null ? undefined : obj[key]), values);

function render(values) {
  const withBlocks = source.replace(
    /\s*\{%-\s*if\s+values\.([\w.]+)\s*%\}([\s\S]*?)(?:\s*\{%-\s*else\s*%\}([\s\S]*?))?\s*\{%-\s*endif\s*%\}/g,
    (_, path, body, elseBody = '') => (lookup(values, path) ? body : elseBody).replace(/\s+$/, ''),
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

test('turning auto-deploy on renders autoDeploy.branch and leaves version to release-operator', () => {
  assert.equal(
    render({ componentName: 'orders', environment: 'dev', autoDeploy: true, bindings: {} }),
    `apiVersion: platform.taskapp.io/v1alpha1
kind: Release
metadata:
  name: orders-dev
  labels:
    platform.taskapp.io/component: orders
spec:
  componentRef:
    name: orders
  environment: dev
  autoDeploy:
    branch: main
`,
  );
});

test('renders an auto-deploy Release that keeps its database binding', () => {
  assert.equal(
    render({ componentName: 'orders', environment: 'dev', autoDeploy: true, bindings: { database: 'orders-db' } }),
    `apiVersion: platform.taskapp.io/v1alpha1
kind: Release
metadata:
  name: orders-dev
  labels:
    platform.taskapp.io/component: orders
spec:
  componentRef:
    name: orders
  environment: dev
  autoDeploy:
    branch: main
  bindings:
    database:
      enabled: true
      ref: orders-db
`,
  );
});

test('turning auto-deploy off pins the chosen version again', () => {
  const rendered = render({ componentName: 'orders', environment: 'dev', autoDeploy: false, version: SHA, bindings: {} });
  assert.match(rendered, new RegExp(`version: "${SHA}"`));
  assert.doesNotMatch(rendered, /autoDeploy/);
});

test('an auto-deploy Release keeps its committed version when only a binding changes', () => {
  assert.equal(
    render({
      componentName: 'orders',
      environment: 'dev',
      autoDeploy: true,
      version: SHA,
      bindings: { database: 'orders-db' },
    }),
    `apiVersion: platform.taskapp.io/v1alpha1
kind: Release
metadata:
  name: orders-dev
  labels:
    platform.taskapp.io/component: orders
spec:
  componentRef:
    name: orders
  environment: dev
  version: "${SHA}"
  autoDeploy:
    branch: main
  bindings:
    database:
      enabled: true
      ref: orders-db
`,
  );
});
