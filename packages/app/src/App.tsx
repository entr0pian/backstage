import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { navModule } from './modules/nav';
import { platformActionsModule } from './modules/platformActions';

export default createApp({
  features: [catalogPlugin, navModule, platformActionsModule],
});
