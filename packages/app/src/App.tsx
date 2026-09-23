import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import argocdPlugin, {
  argocdTranslationsModule,
} from '@backstage-community/plugin-argocd';
import { navModule } from './modules/nav';
import { signInModule } from './modules/signIn';
import { platformActionsModule } from './modules/platformActions';
import { deploymentsModule } from './modules/deployments';
import { dependenciesModule } from './modules/dependencies';

export default createApp({
  features: [
    catalogPlugin,
    navModule,
    signInModule,
    platformActionsModule,
    deploymentsModule,
    dependenciesModule,
    argocdPlugin,
    argocdTranslationsModule,
  ],
});
