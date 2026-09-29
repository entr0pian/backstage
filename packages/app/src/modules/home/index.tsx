import { createFrontendModule, PageBlueprint } from '@backstage/frontend-plugin-api';
import HomeOutlinedIcon from '@material-ui/icons/HomeOutlined';

// The landing page at `/` (the catalog moves back to /catalog): platform
// pitch, golden-path templates and a live health card per service.
const homePage = PageBlueprint.make({
  name: 'home',
  params: {
    path: '/',
    title: 'Home',
    icon: <HomeOutlinedIcon />,
    noHeader: true,
    loader: () => import('./HomePage').then(m => <m.HomePage />),
  },
});

export const homeModule = createFrontendModule({
  pluginId: 'app',
  extensions: [homePage],
});
