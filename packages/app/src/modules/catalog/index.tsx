import {
  coreExtensionData,
  createExtensionInput,
  createFrontendModule,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import CategoryIcon from '@material-ui/icons/Category';

// Replaces the catalog plugin's own index page (same extension id,
// page:catalog) with the platform's: branded header with per-kind quick
// filters, and a card grid or trimmed table. It takes the same `filters`
// input, so every stock catalog filter extension still attaches here —
// except catalog-filter:catalog/list, disabled in app-config.yaml because
// the page renders its own guest-aware UserListPicker.
const catalogIndexPage = PageBlueprint.makeWithOverrides({
  inputs: {
    filters: createExtensionInput([coreExtensionData.reactElement]),
  },
  factory(originalFactory, { inputs }) {
    return originalFactory({
      path: '/catalog',
      routeRef: catalogPlugin.routes.catalogIndex,
      title: 'Catalog',
      icon: <CategoryIcon fontSize="inherit" />,
      noHeader: true,
      loader: async () => {
        const { CatalogPage } = await import('./CatalogPage');
        const filters = inputs.filters.map(f => f.get(coreExtensionData.reactElement));
        return <CatalogPage filters={filters} />;
      },
    });
  },
});

export const catalogIndexModule = createFrontendModule({
  pluginId: 'catalog',
  extensions: [catalogIndexPage],
});
