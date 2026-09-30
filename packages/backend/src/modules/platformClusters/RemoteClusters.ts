import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Config } from '@backstage/config';
import type { ClusterDetails } from '@backstage/plugin-kubernetes-node';
import {
  ANNOTATION_KUBERNETES_AUTH_PROVIDER,
  ANNOTATION_KUBERNETES_AWS_CLUSTER_ID,
} from '@backstage/plugin-kubernetes-common';

// A workload cluster Backstage reads from outside it (BACKSTAGE_CLUSTER_ACCESS.md in
// platform-architecture). Each cluster's own Terraform publishes its
// connection details to taskapp/clusters/<env>; the chart's ExternalSecrets
// write them here as <dir>/<env>/{clusterName,server,caData}. A missing or
// partial folder just means that cluster isn't there right now — it's left
// out, never an error, so Backstage starts whether or not dev exists.
export type RemoteCluster = {
  environment: string;
  clusterName: string;
  server: string;
  caData: string;
};

const FILES = ['clusterName', 'server', 'caData'] as const;

export class RemoteClusters {
  constructor(private readonly dir: string | undefined) {}

  static fromConfig(config: Config): RemoteClusters {
    return new RemoteClusters(config.getOptionalString('platform.clustersDir'));
  }

  // Read on every call: a handful of tiny files, and ESO/kubelet update them
  // in place when a cluster is recreated or removed.
  list(): RemoteCluster[] {
    if (!this.dir || !existsSync(this.dir)) {
      return [];
    }
    // Entries are symlinks into kubelet's ..data (secret volume), so stat
    // follows them; dot-entries are kubelet's own bookkeeping.
    return readdirSync(this.dir)
      .filter(name => !name.startsWith('.') && statSync(join(this.dir!, name)).isDirectory())
      .flatMap(name => {
        const folder = join(this.dir!, name);
        if (!FILES.every(f => existsSync(join(folder, f)))) {
          return [];
        }
        const [clusterName, server, caData] = FILES.map(f =>
          readFileSync(join(folder, f), 'utf8').trim(),
        );
        return [{ environment: name, clusterName, server, caData }];
      });
  }

  get(environment: string): RemoteCluster | undefined {
    return this.list().find(c => c.environment === environment);
  }
}

// As the Kubernetes plugin sees it: named after its environment (the same
// name the local cluster uses, kubernetes.clusterName), authenticated with
// an EKS token signed by this pod's own IAM role (Pod Identity) — no stored
// credential.
export function toClusterDetails(cluster: RemoteCluster): ClusterDetails {
  return {
    name: cluster.environment,
    url: cluster.server,
    caData: cluster.caData,
    skipMetricsLookup: true,
    authMetadata: {
      [ANNOTATION_KUBERNETES_AUTH_PROVIDER]: 'aws',
      [ANNOTATION_KUBERNETES_AWS_CLUSTER_ID]: cluster.clusterName,
    },
  };
}
