import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RemoteClusters, toClusterDetails } from './RemoteClusters';

describe('RemoteClusters', () => {
  let dir: string;

  const writeCluster = (env: string, files: Record<string, string>) => {
    mkdirSync(join(dir, env), { recursive: true });
    for (const [name, value] of Object.entries(files)) {
      writeFileSync(join(dir, env, name), value);
    }
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'clusters-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('lists complete clusters and skips partial ones', () => {
    writeCluster('dev', { clusterName: 'taskapp-dev\n', server: 'https://dev.eks', caData: 'Q0E=' });
    writeCluster('prod', { clusterName: 'taskapp-prod' });

    expect(new RemoteClusters(dir).list()).toEqual([
      { environment: 'dev', clusterName: 'taskapp-dev', server: 'https://dev.eks', caData: 'Q0E=' },
    ]);
  });

  it('follows kubelet secret-volume symlinks and skips its internals', () => {
    writeCluster('..2026_09_30', { clusterName: 'taskapp-dev', server: 'https://dev.eks', caData: 'Q0E=' });
    symlinkSync('..2026_09_30', join(dir, '..data'));
    symlinkSync(join('..data'), join(dir, 'dev'));
    expect(new RemoteClusters(dir).list().map(c => c.environment)).toEqual(['dev']);
  });

  it('is empty when unset or missing', () => {
    expect(new RemoteClusters(undefined).list()).toEqual([]);
    expect(new RemoteClusters(join(dir, 'nope')).list()).toEqual([]);
  });

  it('names the cluster after its environment and authenticates with AWS', () => {
    expect(
      toClusterDetails({ environment: 'dev', clusterName: 'taskapp-dev', server: 'https://dev.eks', caData: 'Q0E=' }),
    ).toEqual({
      name: 'dev',
      url: 'https://dev.eks',
      caData: 'Q0E=',
      skipMetricsLookup: true,
      authMetadata: {
        'kubernetes.io/auth-provider': 'aws',
        'kubernetes.io/x-k8s-aws-id': 'taskapp-dev',
      },
    });
  });
});
