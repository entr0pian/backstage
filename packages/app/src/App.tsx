import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import argocdPlugin, {
  argocdTranslationsModule,
} from '@backstage-community/plugin-argocd';
import { navModule } from './modules/nav';
import { signInModule } from './modules/signIn';
import { themeModule } from './modules/theme';
import { platformActionsModule } from './modules/platformActions';
import { deploymentsModule } from './modules/deployments';
import { metricsModule } from './modules/metrics';
import { homeModule } from './modules/home';
import { serviceHeaderModule } from './modules/serviceHeader';
import { readOnlyModule } from './modules/readOnly';
import { dependenciesModule } from './modules/dependencies';
import { databasesModule } from './modules/databases';
import { createDeploymentModule } from './modules/createDeployment';
import { onboardServiceModule } from './modules/onboardService';

export default createApp({
  features: [
    catalogPlugin,
    navModule,
    signInModule,
    themeModule,
    platformActionsModule,
    deploymentsModule,
    metricsModule,
    homeModule,
    serviceHeaderModule,
    readOnlyModule,
    dependenciesModule,
    databasesModule,
    createDeploymentModule,
    onboardServiceModule,
    argocdPlugin,
    argocdTranslationsModule,
  ],
});
