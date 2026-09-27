import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { ThemeBlueprint } from '@backstage/plugin-app-react';
import { UnifiedThemeProvider } from '@backstage/theme';
import DarkIcon from '@material-ui/icons/Brightness2';
import LightIcon from '@material-ui/icons/WbSunny';
import { darkTheme, lightTheme } from './themes';

// Same extension names as plugin-app's built-in themes (theme:app/light,
// theme:app/dark), so these replace them in place — theme ids, titles and the
// Settings page's theme picker are unchanged, only the look is.
const light = ThemeBlueprint.make({
  name: 'light',
  params: {
    theme: {
      id: 'light',
      title: 'Light Theme',
      variant: 'light',
      icon: <LightIcon />,
      Provider: ({ children }) => (
        <UnifiedThemeProvider theme={lightTheme} children={children} />
      ),
    },
  },
});

const dark = ThemeBlueprint.make({
  name: 'dark',
  params: {
    theme: {
      id: 'dark',
      title: 'Dark Theme',
      variant: 'dark',
      icon: <DarkIcon />,
      Provider: ({ children }) => (
        <UnifiedThemeProvider theme={darkTheme} children={children} />
      ),
    },
  },
});

export const themeModule = createFrontendModule({
  pluginId: 'app',
  extensions: [light, dark],
});
