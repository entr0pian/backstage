// The platform's look: the logo's indigo→cyan gradient as the accent, a deep
// navy sidebar, soft neutral surfaces and rounded, lightly bordered cards.
// Purely presentational — every component and page is still stock Backstage
// or the platform's own modules; this only restyles them.
import {
  createUnifiedTheme,
  genPageTheme,
  pageTheme as defaultPageThemes,
  palettes,
  shapes,
} from '@backstage/theme';

const brand = {
  indigo: '#6366f1',
  indigoDeep: '#4f46e5',
  indigoLight: '#818cf8',
  cyan: '#22d3ee',
  cyanDeep: '#0891b2',
  navy: '#0b1020',
};

export const fontFamily =
  'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// One brand gradient for every page kind (home, service, website, …) so
// entity pages share the logo's colours instead of Backstage's per-kind
// rainbow.
const pageThemes = Object.fromEntries(
  Object.keys(defaultPageThemes).map(key => [
    key,
    genPageTheme({
      colors: [brand.indigoDeep, brand.indigo, brand.cyanDeep],
      shape: shapes.wave,
    }),
  ]),
);

// Shared by both modes: the sidebar stays dark either way.
const navigation = {
  background: brand.navy,
  indicator: brand.cyan,
  color: '#94a3b8',
  selectedColor: '#ffffff',
  navItem: { hoverBackground: 'rgba(148, 163, 184, 0.12)' },
  submenu: { background: '#111833' },
};

type Mode = 'light' | 'dark';

const components = (mode: Mode) => {
  const dark = mode === 'dark';
  const border = dark ? 'rgba(148, 163, 184, 0.14)' : '#e6e8f0';
  const muted = dark ? '#94a3b8' : '#64748b';
  const cardShadow = dark
    ? '0 1px 2px rgba(0, 0, 0, 0.4)'
    : '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px -6px rgba(15, 23, 42, 0.08)';

  return {
    BackstageHeader: {
      styleOverrides: {
        header: {
          boxShadow: 'none',
          borderBottom: `1px solid ${border}`,
        },
        title: {
          fontWeight: 700,
          letterSpacing: '-0.02em',
        },
        subtitle: { opacity: 0.85 },
      },
    },
    BackstageHeaderLabel: {
      styleOverrides: {
        label: { letterSpacing: '0.06em', opacity: 0.8 },
      },
    },
    // No BackstageSidebarDivider override: that component is a MUI v4
    // styled() whose style is a function, and any theme override for it
    // (even one restating every property) makes it render with no styles at
    // all — the divider collapses to a dot.
    BackstageInfoCard: {
      styleOverrides: {
        header: { paddingBottom: 12 },
      },
    },
    BackstageItemCardHeader: {
      styleOverrides: {
        root: {
          backgroundImage: `linear-gradient(135deg, ${brand.indigoDeep}, ${brand.cyanDeep})`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        rounded: { borderRadius: 12 },
        elevation1: { boxShadow: cardShadow, border: `1px solid ${border}` },
        elevation2: { boxShadow: cardShadow, border: `1px solid ${border}` },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        title: { fontWeight: 700, letterSpacing: '-0.01em' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16 },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          letterSpacing: 0,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        containedPrimary: {
          backgroundImage: `linear-gradient(135deg, ${brand.indigo}, ${brand.indigoDeep})`,
          color: '#ffffff',
          '&:hover': {
            backgroundImage: `linear-gradient(135deg, ${brand.indigoDeep}, #4338ca)`,
          },
        },
        outlined: { borderColor: border },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 500 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8 },
        notchedOutline: { borderColor: border },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${border}` },
        head: {
          color: muted,
          fontSize: '0.72rem',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        hover: {
          '&:hover': {
            backgroundColor: dark
              ? 'rgba(129, 140, 248, 0.08)'
              : 'rgba(99, 102, 241, 0.04)',
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 6,
          fontSize: '0.75rem',
          backgroundColor: dark ? '#1e2640' : brand.navy,
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
  };
};

export const lightTheme = createUnifiedTheme({
  palette: {
    ...palettes.light,
    primary: { main: brand.indigoDeep },
    secondary: { main: brand.cyanDeep },
    background: { default: '#f5f6fb', paper: '#ffffff' },
    text: { primary: '#0f172a', secondary: '#64748b' },
    divider: '#e6e8f0',
    link: brand.indigoDeep,
    linkHover: '#4338ca',
    navigation,
    tabbar: { indicator: brand.indigo },
  },
  fontFamily,
  defaultPageTheme: 'home',
  pageTheme: pageThemes,
  components: components('light'),
});

export const darkTheme = createUnifiedTheme({
  palette: {
    ...palettes.dark,
    primary: { main: brand.indigoLight },
    secondary: { main: brand.cyan },
    background: { default: '#0a0e1a', paper: '#121829' },
    text: { primary: '#e2e8f0', secondary: '#94a3b8' },
    divider: 'rgba(148, 163, 184, 0.14)',
    link: brand.indigoLight,
    linkHover: '#a5b4fc',
    navigation,
    tabbar: { indicator: brand.cyan },
  },
  fontFamily,
  defaultPageTheme: 'home',
  pageTheme: pageThemes,
  components: components('dark'),
});
