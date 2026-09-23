import type {
  CatalogProcessor,
  CatalogProcessorCache,
  CatalogProcessorEmit,
  LocationSpec,
} from '@backstage/plugin-catalog-node';
import type { Entity } from '@backstage/catalog-model';

// Derives the ArgoCD plugin's discovery annotation from the entity's own
// name — see BACKSTAGE_PART5.md's "Annotations" section for why this can't
// just be the platform.taskapp.io/* labels already on the Argo Application:
// the plugin needs something on the *entity* telling it what to query for,
// and this is that pointer. Exported so it's independently testable without
// constructing a full CatalogProcessor.
export function argoCdAppSelectorFor(componentName: string): string {
  return `platform.taskapp.io/component=${componentName},platform.taskapp.io/type=service`;
}

// Stamps argocd/app-selector onto every Component entity as it's ingested,
// regardless of what (if anything) its own catalog-info.yaml declares —
// Component entities here come from GitHub discovery of catalog-info.yaml
// in each entr0pian repo, not from a provider this module could feed
// pre-annotated. A CatalogProcessor is the mechanism for enriching an
// entity from any source without touching the source itself. Read-only
// with respect to Kubernetes/Argo CD — this only ever writes to the entity
// object passing through the catalog's own processing pipeline.
export class ArgoCdAnnotator implements CatalogProcessor {
  getProcessorName(): string {
    return 'argocd-annotator';
  }

  async preProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
    _originLocation: LocationSpec,
    _cache: CatalogProcessorCache,
  ): Promise<Entity> {
    if (entity.kind !== 'Component') {
      return entity;
    }

    return {
      ...entity,
      metadata: {
        ...entity.metadata,
        annotations: {
          ...entity.metadata.annotations,
          'argocd/app-selector': argoCdAppSelectorFor(entity.metadata.name),
        },
      },
    };
  }
}
