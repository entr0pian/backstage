import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Standalone, dependency-free check that the skeleton renders the Component
// manifest BACKSTAGE.md's Definition of Done expects, and that the name
// validation rejects what it's supposed to. Not a test of Backstage's own
// fetch:template/publish:github:pull-request actions — those are the
// platform's dependency, not ours to test here.
//
// Run with: node --test templates/onboard-service/render.test.mjs

const here = dirname(fileURLToPath(import.meta.url));
const skeletonDir = join(here, 'skeleton');

// Mirrors template.yaml's parameters.name.pattern — keep the two in sync.
const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

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

test('renders a Component manifest matching the current Component API', () => {
  const rendered = render({
    name: 'order-service',
    owner: 'order-team',
    visibility: 'public',
    scaffoldTemplate: 'golang-service',
    scaffoldVersion: '0.3.0',
  });

  assert.equal(
    rendered,
    `apiVersion: platform.taskapp.io/v1alpha1
kind: Component
metadata:
  name: order-service
  labels:
    platform.taskapp.io/component: order-service
spec:
  owner: order-team
  repository:
    name: order-service
    visibility: public
  scaffold:
    template: golang-service
    version: "0.3.0"
`,
  );
});

test('valid lowercase DNS-style names are accepted', () => {
  for (const name of ['payments', 'order-service', 'customer-api']) {
    assert.match(name, NAME_PATTERN);
  }
});

test('invalid names are rejected', () => {
  for (const name of ['Payments Service', 'My_Service', 'TEST SERVICE']) {
    assert.doesNotMatch(name, NAME_PATTERN);
  }
});
