// The platform's look: the logo's indigo→cyan gradient as the accent, a deep
// navy sidebar, soft neutral surfaces and rounded, lightly bordered cards.
// Purely presentational — every component and page is still stock Backstage
// or the platform's own modules; this only restyles them.
import {
  createUnifiedTheme,
  defaultTypography,
  genPageTheme,
  pageTheme as defaultPageThemes,
  palettes,
  shapes,
} from '@backstage/theme';

export const brand = {
  indigo: '#6366f1',
  indigoDeep: '#4f46e5',
  indigoLight: '#818cf8',
  cyan: '#22d3ee',
  cyanDeep: '#0891b2',
  navy: '#0b1020',
};

export const fontFamily =
  'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// Headings, card titles and tabs: rounder and friendlier than Inter, which
// stays for body text and data.
export const displayFont = `"Plus Jakarta Sans", ${fontFamily}`;

const typography = {
  ...defaultTypography,
  fontFamily,
  h1: { ...defaultTypography.h1, fontFamily: displayFont, fontWeight: 800 },
  h2: { ...defaultTypography.h2, fontFamily: displayFont, fontWeight: 800 },
  h3: { ...defaultTypography.h3, fontFamily: displayFont, fontWeight: 700 },
  h4: { ...defaultTypography.h4, fontFamily: displayFont, fontWeight: 700 },
  h5: { ...defaultTypography.h5, fontFamily: displayFont, fontWeight: 700 },
  h6: { ...defaultTypography.h6, fontFamily: displayFont, fontWeight: 700 },
};

// Springy easing for hovers: a small overshoot reads as playful.
const spring = 'cubic-bezier(.34,1.56,.64,1)';

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
  // Cards aren't flat white: a faint brand wash fades in from the top.
  const cardSurface = dark
    ? 'linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, rgba(18, 24, 41, 0) 140px)'
    : 'linear-gradient(180deg, rgba(99, 102, 241, 0.05) 0%, rgba(255, 255, 255, 0) 140px)';

  return {
    MuiCssBaseline: {
      styleOverrides: {
        '@global': {
          // Soft brand glows behind the page, so the canvas isn't flat grey.
          body: {
            backgroundImage: dark
              ? 'radial-gradient(900px 500px at 100% -10%, rgba(34, 211, 238, 0.08), transparent 60%), radial-gradient(800px 500px at 20% 0%, rgba(99, 102, 241, 0.12), transparent 60%)'
              : 'radial-gradient(900px 500px at 100% -10%, rgba(34, 211, 238, 0.10), transparent 60%), radial-gradient(800px 500px at 20% 0%, rgba(99, 102, 241, 0.10), transparent 60%)',
            backgroundRepeat: 'no-repeat',
          },
          '@keyframes platformFadeUp': {
            from: { opacity: 0, transform: 'translateY(8px)' },
            to: { opacity: 1, transform: 'none' },
          },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '0.01ms !important',
              transitionDuration: '0.01ms !important',
            },
          },
        },
      },
    },
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
    // Cards fade up as a page loads. No hover lift here: most cards aren't
    // clickable, and motion on hover reads as "click me". Cards that are a
    // single link (Home golden paths, Catalog service cards) add their own.
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          backgroundImage: cardSurface,
          animation: 'platformFadeUp 380ms ease both',
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        title: { fontFamily: displayFont, fontWeight: 800, letterSpacing: '-0.02em' },
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
          transition: `transform 200ms ${spring}, box-shadow 200ms ease`,
          '&:hover': { boxShadow: 'none' },
        },
        containedPrimary: {
          backgroundImage: `linear-gradient(135deg, ${brand.indigo}, ${brand.indigoDeep})`,
          color: '#ffffff',
          '&:hover': {
            backgroundImage: `linear-gradient(135deg, ${brand.indigoDeep}, #4338ca)`,
            transform: 'translateY(-1px)',
            boxShadow: `0 10px 20px -10px ${brand.indigo}`,
          },
        },
        outlined: {
          borderColor: border,
          transition: `transform 200ms ${spring}, background-color 200ms ease, border-color 200ms ease`,
          '&:hover': {
            transform: 'translateY(-1px)',
            borderColor: dark ? brand.indigoLight : brand.indigo,
            backgroundColor: dark ? 'rgba(129, 140, 248, 0.12)' : 'rgba(99, 102, 241, 0.06)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 500 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
      },
    },
    // Form fields (scaffolder templates and every other form): soft filled
    // boxes with a focus ring instead of Material's underline, and the label
    // always above the field rather than floating inside it.
    MuiInput: {
      styleOverrides: {
        root: {
          backgroundColor: dark ? 'rgba(148, 163, 184, 0.06)' : '#f8f9fe',
          border: `1px solid ${border}`,
          borderRadius: 12,
          padding: '2px 14px',
          transition: 'border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease',
          '&:hover:not(.Mui-disabled)': { borderColor: dark ? brand.indigoLight : brand.indigo },
          '&.Mui-focused': {
            borderColor: dark ? brand.indigoLight : brand.indigo,
            boxShadow: `0 0 0 4px ${dark ? 'rgba(129, 140, 248, 0.2)' : 'rgba(99, 102, 241, 0.15)'}`,
            backgroundColor: dark ? '#121829' : '#ffffff',
          },
          '&.Mui-error': { borderColor: dark ? '#f87171' : '#dc2626' },
          '&.Mui-disabled': { opacity: 0.75 },
        },
        formControl: { 'label + &': { marginTop: 26 } },
        input: { padding: '10px 0' },
        underline: {
          '&:before, &:after, &:hover:not(.Mui-disabled):before': { display: 'none' },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        formControl: { transform: 'none' },
        shrink: { transform: 'none' },
        root: {
          fontFamily: displayFont,
          fontWeight: 700,
          fontSize: '0.88rem',
          color: dark ? '#cbd5e1' : '#334155',
          '&.Mui-focused': { color: dark ? brand.indigoLight : brand.indigoDeep },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: { fontSize: '0.78rem', marginTop: 6, color: muted },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: { right: 10, color: muted },
        select: { '&:focus': { backgroundColor: 'transparent' } },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 6px',
          '&.Mui-selected, &.Mui-selected:hover': {
            backgroundColor: dark ? 'rgba(129, 140, 248, 0.16)' : 'rgba(99, 102, 241, 0.1)',
            fontWeight: 600,
          },
        },
      },
    },
    // Template steps: bigger numbered dots, a thick connector that fills in
    // the brand colour as steps are done.
    MuiStepper: {
      styleOverrides: {
        root: { backgroundColor: 'transparent' },
      },
    },
    MuiStepIcon: {
      styleOverrides: {
        root: {
          width: 32,
          height: 32,
          color: dark ? 'rgba(148, 163, 184, 0.3)' : '#d7dbe8',
          transition: `transform 250ms ${spring}, color 200ms ease`,
          '&.MuiStepIcon-active': {
            color: dark ? brand.indigoLight : brand.indigo,
            transform: 'scale(1.12)',
            filter: `drop-shadow(0 4px 10px ${dark ? 'rgba(129, 140, 248, 0.5)' : 'rgba(99, 102, 241, 0.45)'})`,
          },
          '&.MuiStepIcon-completed': { color: dark ? brand.cyan : brand.cyanDeep },
        },
        text: { fontFamily: displayFont, fontWeight: 800, fontSize: '0.8rem' },
      },
    },
    MuiStepConnector: {
      styleOverrides: {
        alternativeLabel: { top: 15, left: 'calc(-50% + 26px)', right: 'calc(50% + 26px)' },
        line: { borderColor: border, borderTopWidth: 3, borderRadius: 3 },
        active: { '& $line': { borderColor: dark ? brand.indigoLight : brand.indigo } },
        completed: { '& $line': { borderColor: dark ? brand.cyan : brand.cyanDeep } },
      },
    },
    MuiStepLabel: {
      styleOverrides: {
        label: {
          fontFamily: displayFont,
          fontWeight: 600,
          '&.MuiStepLabel-active': { fontWeight: 800 },
          '&.MuiStepLabel-completed': { fontWeight: 700 },
        },
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
    // The catalog's Personal / All list: the stock grey panel becomes a
    // plain bordered card like the rest of the portal, with a brand-tinted
    // selected row.
    CatalogReactUserListPicker: {
      styleOverrides: {
        root: {
          backgroundColor: dark ? '#121829' : '#ffffff',
          border: `1px solid ${border}`,
          borderRadius: 12,
          boxShadow: 'none',
          padding: 8,
        },
        title: {
          color: muted,
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          padding: '8px 8px 4px',
        },
        groupWrapper: {
          boxShadow: 'none',
          border: 0,
          backgroundColor: 'transparent',
          margin: 0,
        },
        menuItem: {
          borderRadius: 8,
          minHeight: 38,
          '&.Mui-selected, &.Mui-selected:hover': {
            backgroundColor: dark ? 'rgba(129, 140, 248, 0.16)' : 'rgba(99, 102, 241, 0.1)',
            color: dark ? brand.indigoLight : brand.indigoDeep,
            fontWeight: 600,
          },
        },
      },
    },
  } as Record<string, unknown>;
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
  typography,
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
  typography,
  defaultPageTheme: 'home',
  pageTheme: pageThemes,
  components: components('dark'),
});
