// Pure join + redaction for the Database page (BACKSTAGE_PART9.md Part B):
// a Database XR, the managed resources Crossplane composed for it, and the
// Releases that bind it -> one platform-shaped summary. No I/O here — see
// DatabaseSummaryReader.ts.
//
// Every output field is picked explicitly from an allowlist; raw objects are
// never passed through. Composed resources the reader is not allowed to read
// (Crossplane `Object`s — they embed the connection Secret, password
// included) are listed by kind/name only, with state inferred from the
// Database itself.

export interface XrCondition {
  type?: string;
  status?: string;
  reason?: string;
  message?: string;
}

export interface DatabaseXr {
  metadata?: { name?: string; namespace?: string; creationTimestamp?: string };
  spec?: {
    componentRef?: { name?: string };
    dbName?: string;
    size?: string;
    crossplane?: { resourceRefs?: { apiVersion?: string; kind?: string; name?: string }[] };
  };
  status?: {
    conditions?: XrCondition[];
    exports?: {
      name?: string;
      type?: string;
      ready?: boolean;
      location?: { provider?: string; key?: string };
    }[];
  };
}

export interface ManagedResource {
  apiVersion?: string;
  kind?: string;
  metadata?: { name?: string };
  spec?: { forProvider?: Record<string, unknown> };
  status?: { conditions?: XrCondition[]; atProvider?: Record<string, unknown> };
}

export interface BindingRelease {
  name: string;
  namespace: string;
  environment: string;
  bindingName: string;
}

// The only managed-resource kinds the reader fetches (and RBAC grants). Keep
// in step with DatabaseSummaryReader and chart/templates/clusterrole.yaml.
export const READABLE_KINDS: Record<string, { group: string; plural: string }> = {
  'rds.aws.m.upbound.io/Instance': { group: 'rds.aws.m.upbound.io', plural: 'instances' },
  'rds.aws.m.upbound.io/SubnetGroup': { group: 'rds.aws.m.upbound.io', plural: 'subnetgroups' },
  'ec2.aws.m.upbound.io/SecurityGroup': { group: 'ec2.aws.m.upbound.io', plural: 'securitygroups' },
  'ec2.aws.m.upbound.io/SecurityGroupRule': { group: 'ec2.aws.m.upbound.io', plural: 'securitygrouprules' },
};

export function readableKey(apiVersion: string | undefined, kind: string | undefined): string {
  return `${(apiVersion ?? '').split('/')[0]}/${kind ?? ''}`;
}

export interface ResourceSummary {
  kind: string;
  apiGroup: string;
  name: string;
  // 'observed': read directly. 'inferred': not readable by design (would
  // expose credentials) — state comes from the Database's own readiness.
  source: 'observed' | 'inferred';
  ready: boolean | null;
  synced: boolean | null;
  reason: string | null;
  message?: string | null; // owner only
  note?: string;
}

export interface DatabaseSummary {
  name: string;
  namespace: string;
  component: string | null;
  detailLevel: 'owner' | 'summary';
  createdAt: string | null;
  ready: boolean | null;
  synced: boolean | null;
  // Plain-language explanation whenever the database isn't Ready.
  problem: string | null;
  spec: { dbName: string | null; size: string | null };
  engine: {
    engine: string | null;
    version: string | null;
    instanceClass: string | null;
    storageGb: number | null;
    status: string | null;
    availabilityZone: string | null;
    multiAz: boolean | null;
    encrypted: boolean | null;
  } | null;
  // owner only
  endpoint?: { address: string | null; port: number | null; arn: string | null; consoleUrl: string | null } | null;
  connection: {
    name: string;
    type: string | null;
    provider: string | null;
    key: string | null; // a Secrets Manager PATH, never a value
    ready: boolean | null;
  }[];
  boundBy: { release: string; namespace: string; environment: string; mountPath: string }[];
  resources: ResourceSummary[];
}

const cond = (conditions: XrCondition[] | undefined, type: string) =>
  (conditions ?? []).find(c => c.type === type);

const asBool = (c: XrCondition | undefined) => (c ? c.status === 'True' : null);

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

// Crossplane reports composition progress as "Unready resources: a, b" —
// safe to show (names only). Anything else in a condition message may carry
// provider error text (account IDs, ARNs) and stays owner-only.
function explainNotReady(
  ready: XrCondition | undefined,
  connection: DatabaseSummary['connection'],
  includeSensitive: boolean,
): string | null {
  if (!ready || ready.status === 'True') {
    return null;
  }
  const unready = /Unready resources:\s*(.+)$/.exec(ready.message ?? '')?.[1];
  const exportPending = connection.some(c => c.ready !== true);
  const parts: string[] = [];
  if (unready) {
    parts.push(`Still provisioning: ${unready}.`);
  }
  if (exportPending) {
    parts.push('Waiting for the connection details to be published to Secrets Manager — services binding this database cannot start until then.');
  }
  if (parts.length === 0) {
    parts.push(`Not ready (${ready.reason ?? 'unknown reason'}).`);
    if (includeSensitive && ready.message) {
      parts.push(ready.message);
    }
  }
  return parts.join(' ');
}

function awsConsoleUrl(region: string | null, identifier: string | null): string | null {
  if (!region || !identifier) return null;
  return `https://${region}.console.aws.amazon.com/rds/home?region=${region}#database:id=${encodeURIComponent(identifier)};is-cluster=false`;
}

export function buildDatabaseSummary(
  xr: DatabaseXr,
  managed: ManagedResource[],
  releases: BindingRelease[],
  options: { includeSensitive: boolean },
): DatabaseSummary {
  const { includeSensitive } = options;
  const name = xr.metadata?.name ?? '';
  const namespace = xr.metadata?.namespace ?? '';
  const ready = cond(xr.status?.conditions, 'Ready');

  const connection = (xr.status?.exports ?? []).map(e => ({
    name: e.name ?? 'connection',
    type: e.type ?? null,
    provider: e.location?.provider ?? null,
    key: e.location?.key ?? null,
    ready: typeof e.ready === 'boolean' ? e.ready : null,
  }));

  const observedByKey = new Map<string, ManagedResource>();
  for (const mr of managed) {
    observedByKey.set(`${readableKey(mr.apiVersion, mr.kind)}/${mr.metadata?.name}`, mr);
  }

  const resources: ResourceSummary[] = (xr.spec?.crossplane?.resourceRefs ?? [])
    .filter(r => r.kind && r.name)
    .map(ref => {
      const key = readableKey(ref.apiVersion, ref.kind);
      const apiGroup = (ref.apiVersion ?? '').split('/')[0];
      const observed = observedByKey.get(`${key}/${ref.name}`);
      if (observed) {
        const r = cond(observed.status?.conditions, 'Ready');
        const s = cond(observed.status?.conditions, 'Synced');
        return {
          kind: ref.kind!,
          apiGroup,
          name: ref.name!,
          source: 'observed' as const,
          ready: asBool(r),
          synced: asBool(s),
          reason: r?.reason ?? null,
          ...(includeSensitive ? { message: (r?.status !== 'True' ? r?.message : s?.message) ?? null } : {}),
        };
      }
      return {
        kind: ref.kind!,
        apiGroup,
        name: ref.name!,
        source: 'inferred' as const,
        ready: READABLE_KINDS[key] ? null : asBool(ready),
        synced: null,
        reason: null,
        note: READABLE_KINDS[key]
          ? 'Could not be read.'
          : 'Not read by the portal — it carries the connection credentials. State inferred from the database.',
      };
    });

  const instance = managed.find(m => readableKey(m.apiVersion, m.kind) === 'rds.aws.m.upbound.io/Instance');
  const fp = instance?.spec?.forProvider ?? {};
  const ap = instance?.status?.atProvider ?? {};
  const region = str(ap.region) ?? str(fp.region);

  return {
    name,
    namespace,
    component: xr.spec?.componentRef?.name ?? null,
    detailLevel: includeSensitive ? 'owner' : 'summary',
    createdAt: xr.metadata?.creationTimestamp ?? null,
    ready: asBool(ready),
    synced: asBool(cond(xr.status?.conditions, 'Synced')),
    problem: explainNotReady(ready, connection, includeSensitive),
    spec: { dbName: xr.spec?.dbName ?? null, size: xr.spec?.size ?? null },
    engine: instance
      ? {
          engine: str(ap.engine) ?? str(fp.engine),
          version: str(ap.engineVersionActual) ?? str(fp.engineVersion),
          instanceClass: str(ap.instanceClass) ?? str(fp.instanceClass),
          storageGb: num(ap.allocatedStorage) ?? num(fp.allocatedStorage),
          status: str(ap.status),
          availabilityZone: str(ap.availabilityZone),
          multiAz: bool(ap.multiAz),
          encrypted: bool(ap.storageEncrypted),
        }
      : null,
    ...(includeSensitive
      ? {
          endpoint: instance
            ? {
                address: str(ap.address),
                port: num(ap.port),
                arn: str(ap.arn),
                consoleUrl: awsConsoleUrl(region, str(ap.identifier) ?? str(fp.identifier)),
              }
            : null,
        }
      : {}),
    connection,
    boundBy: releases
      .filter(r => r.namespace === namespace)
      .map(r => ({
        release: r.name,
        namespace: r.namespace,
        environment: r.environment,
        mountPath: `/bindings/${r.bindingName}`,
      })),
    resources,
  };
}
