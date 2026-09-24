// Pure transformation layer: Kubernetes Database CR -> Backstage Resource
// entity. No I/O here — see PlatformEntityProvider.ts for the Kubernetes
// client and polling loop. Kept separate per BACKSTAGE_PART4.md so adding a
// second resource type (Bucket, Queue, Cache, ...) later is "write another
// mapper", not "rewrite the provider".

export interface DatabaseCustomResource {
  metadata?: {
    name?: string;
    namespace?: string;
  };
  spec?: {
    componentRef?: {
      name?: string;
    };
    dbName?: string;
    size?: string;
  };
}

export interface MappedEntity {
  entity: Record<string, unknown>;
}

export interface MapperError {
  error: string;
}

const VALID_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
const PROVIDER_LOCATION_PREFIX = 'platform-entity-provider:database';

// Backstage entity names are unique per Backstage namespace (kept as
// "default" here, matching how Components are already registered — see
// BACKSTAGE_PART4.md's explicit warning not to conflate the Kubernetes
// namespace with the Backstage one). Two Databases with the same CR name in
// different Kubernetes namespaces (dev/checkout-db vs prod/checkout-db)
// would otherwise collide, so the Kubernetes namespace is folded into the
// entity name instead.
export function databaseEntityName(
  kubernetesNamespace: string,
  crName: string,
): string {
  return `${kubernetesNamespace}-${crName}`;
}

export interface MapDatabaseOptions {
  // The owning Component CR's spec.owner (e.g. "payments-team") — the team
  // that owns the service owns its database. Falls back to user:guest when
  // the Component can't be found, so a Database is never dropped for it.
  owner?: string;
  // Base URL of the GitOps repo that defines platform CRs, e.g.
  // https://github.com/entr0pian/application-repositories — adds a link to
  // the environment folder the Database CR is defined in.
  gitopsRepoUrl?: string;
}

export function mapDatabaseToEntity(
  database: DatabaseCustomResource,
  options: MapDatabaseOptions = {},
): MappedEntity | MapperError {
  const crName = database.metadata?.name;
  const crNamespace = database.metadata?.namespace;

  if (!crName || !crNamespace) {
    return {
      error: `Database is missing metadata.name or metadata.namespace (name=${crName}, namespace=${crNamespace})`,
    };
  }

  const componentName = database.spec?.componentRef?.name;
  if (!componentName) {
    return {
      error: `Database ${crNamespace}/${crName} has no spec.componentRef.name — skipping`,
    };
  }
  if (!VALID_NAME.test(componentName)) {
    return {
      error: `Database ${crNamespace}/${crName} has an invalid spec.componentRef.name "${componentName}" — skipping`,
    };
  }

  const entityName = databaseEntityName(crNamespace, crName);
  const locationRef = `${PROVIDER_LOCATION_PREFIX}/${crNamespace}/${crName}`;

  return {
    entity: {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Resource',
      metadata: {
        name: entityName,
        // The CR's own name for display — entityName stays
        // "<namespace>-<crName>" so the same database in two environments
        // never collides.
        title: crName,
        namespace: 'default',
        description: `Database "${database.spec?.dbName ?? crName}" for component ${componentName} (${crNamespace})`,
        annotations: {
          'backstage.io/managed-by-location': locationRef,
          'backstage.io/managed-by-origin-location': locationRef,
          'platform.taskapp.io/environment': crNamespace,
          'platform.taskapp.io/kubernetes-namespace': crNamespace,
          'platform.taskapp.io/database-name': crName,
        },
        labels: {
          'platform.taskapp.io/component': componentName,
        },
        ...(options.gitopsRepoUrl
          ? {
              links: [
                {
                  url: `${options.gitopsRepoUrl.replace(/\/+$/, '')}/tree/main/platform/environments/${crNamespace}`,
                  title: 'Definition in Git',
                },
              ],
            }
          : {}),
      },
      spec: {
        type: 'database',
        owner: options.owner ?? 'user:guest',
        // Standard Backstage relation — Backstage derives the inverse
        // (dependsOn) on the Component automatically. This is the ONLY
        // link between the two; nothing here touches the Component's own
        // catalog-info.yaml, per BACKSTAGE_PART4.md's architectural rules.
        dependencyOf: [`component:default/${componentName}`],
      },
    },
  };
}
