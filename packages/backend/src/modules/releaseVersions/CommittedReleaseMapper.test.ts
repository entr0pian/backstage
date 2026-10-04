import { committedReleasePath, isValidName, parseCommittedRelease } from './CommittedReleaseMapper';

const SHA = 'ff5987e8395c2fc8f52f3cd078416830244b5019';

describe('parseCommittedRelease', () => {
  it('reports no Release when the file does not exist', () => {
    expect(parseCommittedRelease(null)).toEqual({ exists: false, autoDeploy: false, version: null, bindings: {} });
  });

  it('reads an auto-deploy Release', () => {
    expect(
      parseCommittedRelease(`apiVersion: platform.taskapp.io/v1alpha1
kind: Release
metadata:
  name: orders-dev
spec:
  componentRef:
    name: orders
  environment: dev
  autoDeploy:
    branch: main
`),
    ).toEqual({ exists: true, autoDeploy: true, version: null, bindings: {} });
  });

  it('keeps the version release-operator committed to an auto-deploy Release', () => {
    expect(
      parseCommittedRelease(`apiVersion: platform.taskapp.io/v1alpha1
kind: Release
metadata:
  name: orders-dev
spec:
  componentRef:
    name: orders
  environment: dev
  version: "${SHA}"
  autoDeploy:
    branch: main
`),
    ).toEqual({ exists: true, autoDeploy: true, version: SHA, bindings: {} });
  });

  it('reads a pinned Release with its enabled bindings', () => {
    expect(
      parseCommittedRelease(`apiVersion: platform.taskapp.io/v1alpha1
kind: Release
metadata:
  name: payments-dev
spec:
  componentRef:
    name: payments
  environment: dev
  version: "${SHA}"
  bindings:
    database:
      enabled: true
      ref: payments-db
    cache:
      enabled: false
      ref: payments-cache
`),
    ).toEqual({ exists: true, autoDeploy: false, version: SHA, bindings: { database: 'payments-db' } });
  });

  it('treats a file that is not a Release as absent instead of failing', () => {
    expect(parseCommittedRelease('kind: Database\nspec: {}\n').exists).toBe(false);
    expect(parseCommittedRelease(': not yaml : [').exists).toBe(false);
  });
});

describe('committed Release path', () => {
  it('is where the Create deployment template writes it', () => {
    expect(committedReleasePath('payments', 'dev')).toBe('platform/environments/dev/payments-release.yaml');
  });

  it('only accepts Kubernetes-style names, so nothing else can reach the path', () => {
    expect(isValidName('payments')).toBe(true);
    expect(isValidName('../secrets')).toBe(false);
    expect(isValidName('Payments')).toBe(false);
    expect(isValidName('a'.repeat(64))).toBe(false);
  });
});
