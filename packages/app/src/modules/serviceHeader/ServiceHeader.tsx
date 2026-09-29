import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@material-ui/core/Box';
import IconButton from '@material-ui/core/IconButton';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import GitHubIcon from '@material-ui/icons/GitHub';
import TimelineIcon from '@material-ui/icons/Timeline';
import SyncIcon from '@material-ui/icons/Sync';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { useEntity, FavoriteEntity } from '@backstage/plugin-catalog-react';
import type { EntityHeaderLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import { useDeployments } from '../deployments/useDeployments';
import { EnvironmentHealthPill } from '../metrics/EnvironmentPulse';
import { useGrafanaUiUrl, serviceOverviewUrl } from '../metrics/grafana';
import { argoApplicationUrl, useArgocdUiUrl } from '../platformUi/argocd';
import { shortVersion } from '../platformUi';
import { brand } from '../theme/themes';

const useStyles = makeStyles(theme => ({
  // Inset and rounded like the cards below it, so the page reads as one
  // column rather than a full-bleed banner over an inset body.
  root: { padding: theme.spacing(2.5, 3, 0) },
  band: {
    position: 'relative',
    overflow: 'hidden',
    color: '#fff',
    borderRadius: 16,
    padding: theme.spacing(3, 4, 2.5),
    backgroundImage: `linear-gradient(120deg, ${brand.indigoDeep} 0%, ${brand.indigo} 50%, ${brand.cyanDeep} 100%)`,
    '&::after': {
      content: '""',
      position: 'absolute',
      width: 360,
      height: 360,
      right: -100,
      top: -220,
      borderRadius: '50%',
      background: 'rgba(34, 211, 238, 0.35)',
      filter: 'blur(40px)',
      pointerEvents: 'none',
    },
  },
  top: { position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing(2) },
  eyebrow: { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85 },
  title: { fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, margin: theme.spacing(0.5, 0) },
  meta: { fontSize: '0.88rem', opacity: 0.9 },
  row: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  version: {
    fontFamily: 'monospace',
    fontSize: '0.78rem',
    padding: theme.spacing(0.5, 1.25),
    borderRadius: 999,
    backgroundColor: 'rgba(11, 16, 32, 0.28)',
    border: '1px solid rgba(255,255,255,0.18)',
  },
  links: { display: 'flex', alignItems: 'center', gap: theme.spacing(0.5) },
  linkButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: theme.spacing(0.5, 1.25),
    borderRadius: 8,
    color: '#fff !important',
    fontSize: '0.8rem',
    fontWeight: 600,
    textDecoration: 'none !important',
    backgroundColor: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.22)',
    transition: 'background-color 150ms ease',
    '&:hover': { backgroundColor: 'rgba(255,255,255,0.22)' },
    '& svg': { fontSize: '1rem' },
  },
  iconOnBrand: { color: '#fff' },
  tabs: {
    display: 'flex',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0, 1),
    marginTop: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.divider}`,
    overflowX: 'auto',
    overflowY: 'hidden',
  },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: theme.spacing(1.5, 1.5),
    fontSize: '0.9rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    color: theme.palette.text.secondary,
    textDecoration: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: -1,
    background: 'none',
    border: 0,
    cursor: 'pointer',
    font: 'inherit',
    '&:hover': { color: theme.palette.text.primary },
  },
  tabActive: {
    color: theme.palette.text.primary,
    borderBottom: `2px solid ${brand.indigo}`,
  },
}));

type Tab = EntityHeaderLayoutProps['tabs'][number];

const TabLink = ({ tab, active }: { tab: Tab; active: boolean }) => {
  const classes = useStyles();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const cls = `${classes.tab} ${active ? classes.tabActive : ''}`;
  if ('href' in tab) {
    return (
      <RouterLink to={tab.href} className={cls} aria-current={active ? 'page' : undefined}>
        {tab.label}
      </RouterLink>
    );
  }
  // A content group with several tabs: a small dropdown.
  return (
    <>
      <button type="button" className={cls} onClick={e => setAnchor(e.currentTarget)} aria-haspopup="menu">
        {tab.label}
        <ExpandMoreIcon fontSize="small" />
      </button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {tab.items.map(item => (
          <MenuItem key={item.id} component={RouterLink} to={item.href} onClick={() => setAnchor(null)}>
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

const isActive = (tab: Tab, activeTabId?: string) =>
  tab.id === activeTabId || ('items' in tab && tab.items.some(i => i.id === activeTabId));

// The service page header: a brand band with the service's identity, a live
// health pill per environment (same rules as the Metrics tab), the running
// version and one-click links to its repo, Grafana and Argo CD — then the
// usual tab row. Used for Components of type service only; every other
// entity keeps Backstage's default header.
export const ServiceHeader = ({ tabs, activeTabId }: EntityHeaderLayoutProps) => {
  const classes = useStyles();
  const { entity } = useEntity();
  const name = entity.metadata.name;
  const deployments = useDeployments(name);
  const grafanaUiUrl = useGrafanaUiUrl();
  const argocdUiUrl = useArgocdUiUrl();
  const [menu, setMenu] = useState<HTMLElement | null>(null);

  const envs = deployments.status === 'done' ? deployments.deployments : [];
  const primary = envs[0];
  const slug = entity.metadata.annotations?.['github.com/project-slug'];
  const owner = (entity.spec?.owner as string | undefined)?.replace(/^group:(default\/)?/, '');
  const grafanaUrl = primary ? serviceOverviewUrl(grafanaUiUrl, name, primary.environment) : null;
  const argoUrl = primary
    ? argoApplicationUrl(argocdUiUrl, { name: primary.argoApplicationName, namespace: primary.argoApplicationNamespace })
    : null;
  const base = `/catalog/${entity.metadata.namespace ?? 'default'}/component/${name}`;

  return (
    <header className={classes.root}>
      <div className={classes.band}>
        <div className={classes.top}>
          <div>
            <Typography className={classes.eyebrow}>
              {entity.kind} · {String(entity.spec?.type ?? '')}
            </Typography>
            <Typography component="h1" className={classes.title}>
              {entity.metadata.title ?? name}
            </Typography>
            <Typography className={classes.meta}>
              {[entity.metadata.description, owner && `owned by ${owner}`, entity.spec?.lifecycle as string]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          </div>
          <Box display="flex" alignItems="center">
            <FavoriteEntity entity={entity} className={classes.iconOnBrand} />
            <IconButton aria-label="More" className={classes.iconOnBrand} onClick={e => setMenu(e.currentTarget)}>
              <MoreVertIcon />
            </IconButton>
            <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
              <MenuItem component={RouterLink} to="?inspect=overview" onClick={() => setMenu(null)}>
                Inspect entity
              </MenuItem>
            </Menu>
          </Box>
        </div>
        <div className={classes.row}>
          {envs.map(d => (
            <EnvironmentHealthPill
              key={d.environment}
              component={name}
              environment={d.environment}
              href={`${base}/metrics`}
              onBrand
            />
          ))}
          {primary?.version && <span className={classes.version}>{shortVersion(primary.version)}</span>}
          <Box flex={1} />
          <div className={classes.links}>
            {slug && (
              <a className={classes.linkButton} href={`https://github.com/${slug}`} target="_blank" rel="noopener noreferrer">
                <GitHubIcon /> Repository
              </a>
            )}
            {grafanaUrl && (
              <a className={classes.linkButton} href={grafanaUrl} target="_blank" rel="noopener noreferrer">
                <TimelineIcon /> Grafana
              </a>
            )}
            {argoUrl && (
              <a className={classes.linkButton} href={argoUrl} target="_blank" rel="noopener noreferrer">
                <SyncIcon /> Argo CD
              </a>
            )}
          </div>
        </div>
      </div>
      <nav className={classes.tabs} aria-label="Service sections">
        {tabs.map(tab => (
          <TabLink key={tab.id} tab={tab} active={isActive(tab, activeTabId)} />
        ))}
      </nav>
    </header>
  );
};
