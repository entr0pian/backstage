import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import argocdPlugin, {
  argocdTranslationsModule,
} from '@backstage-community/plugin-argocd';
import { navModule } from './modules/nav';
import { platformActionsModule } from './modules/platformActions';
import { releaseVersionsModule } from './modules/releaseVersions';

export default createApp({
  features: [
    catalogPlugin,
    navModule,
    platformActionsModule,
    releaseVersionsModule,
    argocdPlugin,
    argocdTranslationsModule,
  ],
});
