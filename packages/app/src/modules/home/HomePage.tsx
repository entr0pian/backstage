import { useEffect, useState, type ReactNode } from 'react';
import Box from '@material-ui/core/Box';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { alpha, makeStyles } from '@material-ui/core/styles';
import AddBoxOutlinedIcon from '@material-ui/icons/AddBoxOutlined';
import StorageOutlinedIcon from '@material-ui/icons/StorageOutlined';
import TableChartOutlinedIcon from '@material-ui/icons/TableChartOutlined';
import RocketLaunchIcon from '@material-ui/icons/FlightTakeoff';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import LockOutlinedIcon from '@material-ui/icons/LockOutlined';
import { Content, Link, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { usePermission } from '@backstage/plugin-permission-react';
import { taskCreatePermission } from '@backstage/plugin-scaffolder-common/alpha';
import type { Entity } from '@backstage/catalog-model';
import { useDeployments } from '../deployments/useDeployments';
import { EnvironmentPulseRow } from '../metrics/EnvironmentPulse';
import { brand, displayFont } from '../theme/themes';

const useStyles = makeStyles(theme => ({
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    padding: theme.spacing(5, 5, 4),
    color: '#fff',
    backgroundImage: `linear-gradient(120deg, ${brand.indigoDeep} 0%, ${brand.indigo} 45%, ${brand.cyanDeep} 100%)`,
    // Soft light blobs so the band has depth without an image.
    '&::before, &::after': {
      content: '""',
      position: 'absolute',
      borderRadius: '50%',
      filter: 'blur(40px)',
      pointerEvents: 'none',
    },
    '&::before': {
      width: 420,
      height: 420,
      right: -120,
      top: -200,
      background: alpha(brand.cyan, 0.45),
    },
    '&::after': {
      width: 300,
      height: 300,
      left: '35%',
      bottom: -220,
      background: alpha('#ffffff', 0.18),
    },
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    fontSize: '0.72rem',
    fontWeight: 700,
    opacity: 0.85,
  },
  title: {
    fontFamily: displayFont,
    fontSize: '2.4rem',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
    margin: theme.spacing(1, 0, 1.5),
  },
  lead: { fontSize: '1.05rem', maxWidth: 640, opacity: 0.92, lineHeight: 1.55 },
  stats: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(3.5),
  },
  stat: {
    minWidth: 130,
    padding: theme.spacing(1.25, 2),
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    border: '1px solid rgba(255,255,255,0.22)',
    backdropFilter: 'blur(6px)',
  },
  statValue: { fontFamily: displayFont, fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.1 },
  statLabel: { fontSize: '0.75rem', opacity: 0.85 },
  sectionTitle: {
    fontFamily: displayFont,
    fontSize: '1.25rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
    margin: theme.spacing(4, 0, 1.5),
  },
  action: {
    display: 'flex',
    gap: theme.spacing(2),
    alignItems: 'flex-start',
    height: '100%',
    padding: theme.spacing(2.5),
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    textDecoration: 'none !important',
    transition: 'transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      borderColor: alpha(theme.palette.primary.main, 0.5),
      boxShadow: `0 8px 24px -12px ${alpha(theme.palette.primary.main, 0.45)}`,
    },
  },
  actionIcon: {
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    width: 44,
    height: 44,
    borderRadius: 12,
    color: '#fff',
    backgroundImage: `linear-gradient(135deg, ${brand.indigo}, ${brand.cyanDeep})`,
  },
  actionTitle: { fontFamily: displayFont, fontWeight: 700, fontSize: '1rem' },
  actionText: { fontSize: '0.82rem', color: theme.palette.text.secondary, marginTop: 2 },
  ownerOnly: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    marginTop: theme.spacing(1),
    padding: theme.spacing(0.25, 1),
    borderRadius: 999,
    fontSize: '0.7rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.action.hover,
    '& svg': { fontSize: '0.8rem' },
  },
  service: {
    position: 'relative',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2.5),
    borderRadius: 18,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    borderTop: `3px solid ${brand.indigo}`,
    cursor: 'pointer',
    transition: 'transform 250ms cubic-bezier(.34,1.56,.64,1), box-shadow 250ms ease, border-color 250ms ease',
    '&:hover': {
      transform: 'translateY(-4px)',
      borderColor: alpha(theme.palette.primary.main, 0.45),
      boxShadow: `0 18px 40px -18px ${alpha(theme.palette.primary.main, 0.5)}`,
    },
  },
  serviceName: {
    fontFamily: displayFont,
    fontSize: '1.3rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    textDecoration: 'none !important',
    // Stretched link: the name's ::after covers the whole card, so a click
    // anywhere opens the service; other links inside sit above it.
    '&::after': { content: '""', position: 'absolute', inset: 0, zIndex: 0 },
  },
  serviceMeta: { fontSize: '0.8rem', color: theme.palette.text.secondary },
  serviceLinks: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    gap: theme.spacing(2),
    marginTop: 'auto',
    paddingTop: theme.spacing(1.5),
    fontSize: '0.82rem',
    fontWeight: 600,
  },
  empty: {
    padding: theme.spacing(3),
    borderRadius: 12,
    border: `1px dashed ${theme.palette.divider}`,
    color: theme.palette.text.secondary,
  },
}));

const QUICK_ACTIONS = [
  {
    template: 'onboard-service',
    title: 'Onboard a service',
    text: 'New GitHub repo, scaffolded from a versioned template, via one Component PR.',
    icon: <AddBoxOutlinedIcon />,
  },
  {
    template: 'add-database',
    title: 'Add a database',
    text: 'A Crossplane-provisioned Postgres for an existing service, bound per environment.',
    icon: <StorageOutlinedIcon />,
  },
  {
    template: 'apply-schema',
    title: 'Apply a database schema',
    text: "Ship a service's migrations to an environment's database, separately from its code.",
    icon: <TableChartOutlinedIcon />,
  },
  {
    template: 'create-deployment',
    title: 'Deploy a version',
    text: 'Open the Release PR that Argo CD and release-operator roll out.',
    icon: <RocketLaunchIcon />,
  },
];

const Stat = ({ value, label }: { value: ReactNode; label: string }) => {
  const classes = useStyles();
  return (
    <div className={classes.stat}>
      <div className={classes.statValue}>{value}</div>
      <div className={classes.statLabel}>{label}</div>
    </div>
  );
};

const entityPath = (e: Entity) =>
  `/catalog/${e.metadata.namespace ?? 'default'}/component/${e.metadata.name}`;

// One card per service: identity, then a live health row per environment
// it's deployed to (the same environments as its Deployments tab).
const ServiceCard = ({ entity }: { entity: Entity }) => {
  const classes = useStyles();
  const name = entity.metadata.name;
  const deployments = useDeployments(name);
  const owner = (entity.spec?.owner as string | undefined)?.replace(/^group:(default\/)?/, '');

  return (
    <div className={classes.service}>
      <Link to={entityPath(entity)} className={classes.serviceName}>
        {entity.metadata.title ?? name}
      </Link>
      <Typography className={classes.serviceMeta}>
        {[entity.metadata.description, owner && `owned by ${owner}`].filter(Boolean).join(' · ')}
      </Typography>
      <Box mt={1.5}>
        {deployments.status === 'loading' && <Progress />}
        {deployments.status === 'done' && deployments.deployments.length === 0 && (
          <Typography className={classes.serviceMeta}>Not deployed anywhere yet.</Typography>
        )}
        {deployments.status === 'done' &&
          deployments.deployments.map(d => (
            <EnvironmentPulseRow key={d.environment} component={name} environment={d.environment} />
          ))}
      </Box>
      <div className={classes.serviceLinks}>
        <Link to={`${entityPath(entity)}/metrics`}>Metrics</Link>
        <Link to={`${entityPath(entity)}/deployments`}>Deployments</Link>
        <Link to={entityPath(entity)}>Overview</Link>
      </div>
    </div>
  );
};

// The portal's landing page: what the platform is, what you can do with
// it, and how everything on it is doing right now.
export const HomePage = () => {
  const classes = useStyles();
  const catalogApi = useApi(catalogApiRef);
  const environments = useApi(configApiRef).getOptionalStringArray('platform.environments') ?? [];
  const [services, setServices] = useState<Entity[] | null>(null);
  const [templates, setTemplates] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  // Guests can open a template but not run it; say so before they click.
  const { allowed: canRun, loading: permissionLoading } = usePermission({ permission: taskCreatePermission });
  const readOnly = !permissionLoading && !canRun;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      catalogApi.getEntities({ filter: { kind: 'Component', 'spec.type': 'service' } }),
      catalogApi.getEntities({ filter: { kind: 'Template' }, fields: ['metadata.name'] }),
    ])
      .then(([svc, tpl]) => {
        if (cancelled) return;
        setServices(
          [...svc.items].sort((a, b) => a.metadata.name.localeCompare(b.metadata.name)),
        );
        setTemplates(tpl.items.length);
      })
      .catch(e => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, [catalogApi]);

  return (
    <Content>
      <section className={classes.hero}>
        <Box position="relative" zIndex={1}>
          <Typography className={classes.eyebrow}>Internal Developer Platform</Typography>
          <Typography component="h1" className={classes.title}>
            Ship a service with a pull request.
          </Typography>
          <Typography className={classes.lead}>
            Onboard a component, provision its infrastructure and deploy it across environments — all through
            Kubernetes APIs, operators and GitOps, with live health for everything that runs.
          </Typography>
        </Box>
        <div className={classes.stats}>
          <Stat value={services?.length ?? '–'} label="services" />
          <Stat value={environments.length || '–'} label={environments.length === 1 ? 'environment' : 'environments'} />
          <Stat value={templates ?? '–'} label="golden paths" />
          <Stat value="15s" label="metrics refresh" />
        </div>
      </section>

      <Typography component="h2" className={classes.sectionTitle}>
        Golden paths
      </Typography>
      <Grid container spacing={2}>
        {QUICK_ACTIONS.map(a => (
          <Grid item xs={12} sm={6} lg={3} key={a.template}>
            <Link to={`/create/templates/default/${a.template}`} className={classes.action}>
              <span className={classes.actionIcon}>{a.icon}</span>
              <span>
                <Box display="flex" alignItems="center" style={{ gap: 6 }} className={classes.actionTitle}>
                  {a.title}
                  <ArrowForwardIcon style={{ fontSize: '1rem', opacity: 0.6 }} />
                </Box>
                <div className={classes.actionText}>{a.text}</div>
                {readOnly && (
                  <span className={classes.ownerOnly}>
                    <LockOutlinedIcon /> Owner only · view as guest
                  </span>
                )}
              </span>
            </Link>
          </Grid>
        ))}
      </Grid>

      <Typography component="h2" className={classes.sectionTitle}>
        Services
      </Typography>
      {error && <ResponseErrorPanel error={error} />}
      {!error && services === null && <Progress />}
      {services?.length === 0 && (
        <div className={classes.empty}>No services yet — onboard the first one with the golden path above.</div>
      )}
      <Grid container spacing={2}>
        {services?.map(s => (
          <Grid item xs={12} lg={6} key={s.metadata.uid ?? s.metadata.name}>
            <ServiceCard entity={s} />
          </Grid>
        ))}
      </Grid>
    </Content>
  );
};
