import { startTransition, Suspense, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import { alpha, makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import ViewModuleIcon from '@material-ui/icons/ViewModule';
import ViewListIcon from '@material-ui/icons/ViewList';
import ExtensionOutlinedIcon from '@material-ui/icons/ExtensionOutlined';
import StorageOutlinedIcon from '@material-ui/icons/StorageOutlined';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import GroupOutlinedIcon from '@material-ui/icons/GroupOutlined';
import PersonOutlineIcon from '@material-ui/icons/PersonOutline';
import SettingsEthernetIcon from '@material-ui/icons/SettingsEthernet';
import CategoryOutlinedIcon from '@material-ui/icons/CategoryOutlined';
import RoomOutlinedIcon from '@material-ui/icons/RoomOutlined';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import StarIcon from '@material-ui/icons/Star';
import StarBorderIcon from '@material-ui/icons/StarBorder';
import { Content, Link, Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import {
  CatalogFilterLayout,
  EntityListProvider,
  UserListPicker,
  catalogApiRef,
  getEntitySourceLocation,
  useEntityList,
  useStarredEntities,
} from '@backstage/plugin-catalog-react';
import { CatalogTable, type CatalogTableRow } from '@backstage/plugin-catalog';
import { usePermission } from '@backstage/plugin-permission-react';
import { taskCreatePermission } from '@backstage/plugin-scaffolder-common/alpha';
import { scmIntegrationsApiRef } from '@backstage/integration-react';
import type { Entity } from '@backstage/catalog-model';
import { useDeployments } from '../deployments/useDeployments';
import { EnvironmentHealthPill } from '../metrics/EnvironmentPulse';
import { brand } from '../theme/themes';

const KIND_ICONS: Record<string, ReactElement> = {
  component: <ExtensionOutlinedIcon />,
  resource: <StorageOutlinedIcon />,
  template: <DescriptionOutlinedIcon />,
  group: <GroupOutlinedIcon />,
  user: <PersonOutlineIcon />,
  api: <SettingsEthernetIcon />,
  system: <CategoryOutlinedIcon />,
  location: <RoomOutlinedIcon />,
};
const kindIcon = (kind: string) => KIND_ICONS[kind.toLowerCase()] ?? <CategoryOutlinedIcon />;

const VIEW_KEY = 'platform.catalog.view';
type View = 'cards' | 'table';

const useStyles = makeStyles(theme => ({
  band: {
    position: 'relative',
    overflow: 'hidden',
    color: '#fff',
    borderRadius: 16,
    padding: theme.spacing(3, 4),
    marginBottom: theme.spacing(3),
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
  bandTop: { position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', gap: theme.spacing(2), flexWrap: 'wrap' },
  eyebrow: { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85 },
  title: { fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, margin: theme.spacing(0.5, 0) },
  lead: { fontSize: '0.92rem', opacity: 0.9, maxWidth: 620 },
  kinds: { position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', gap: theme.spacing(1), marginTop: theme.spacing(2.5) },
  kindChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: theme.spacing(0.75, 1.5),
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    color: '#fff',
    font: 'inherit',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
    '&:hover': { backgroundColor: 'rgba(255,255,255,0.24)' },
    '& svg': { fontSize: '1rem' },
  },
  kindChipActive: { backgroundColor: '#fff !important', color: brand.indigoDeep },
  kindCount: { opacity: 0.75, fontWeight: 700 },
  createButton: {
    backgroundColor: '#fff !important',
    backgroundImage: 'none !important',
    color: `${brand.indigoDeep} !important`,
    alignSelf: 'flex-start',
  },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing(2) },
  count: { fontWeight: 700, fontSize: '1.05rem' },
  toggle: {
    display: 'inline-flex',
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    overflow: 'hidden',
    backgroundColor: theme.palette.background.paper,
  },
  toggleButton: { borderRadius: 0, padding: 6 },
  toggleActive: { backgroundColor: alpha(theme.palette.primary.main, 0.12), color: theme.palette.primary.main },
  card: {
    position: 'relative',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2.5),
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    overflow: 'hidden',
    transition: 'transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease',
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: '0 0 auto 0',
      height: 3,
      backgroundImage: `linear-gradient(90deg, ${brand.indigo}, ${brand.cyanDeep})`,
    },
    '&:hover': {
      transform: 'translateY(-2px)',
      borderColor: alpha(theme.palette.primary.main, 0.45),
      boxShadow: `0 10px 28px -14px ${alpha(theme.palette.primary.main, 0.5)}`,
    },
  },
  cardHead: { display: 'flex', alignItems: 'flex-start', gap: theme.spacing(1.5) },
  cardIcon: {
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 10,
    color: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.1),
  },
  cardName: { fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.01em', lineHeight: 1.3 },
  cardKind: { fontSize: '0.72rem', color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: '0.06em' },
  cardText: {
    marginTop: theme.spacing(1.5),
    fontSize: '0.86rem',
    color: theme.palette.text.secondary,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    minHeight: '2.6em',
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: theme.spacing(1.5) },
  chip: { height: 22, fontSize: '0.72rem', fontWeight: 600 },
  envs: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto', paddingTop: theme.spacing(2) },
  empty: {
    padding: theme.spacing(4),
    borderRadius: 12,
    border: `1px dashed ${theme.palette.divider}`,
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
}));

const entityPath = (e: Entity) =>
  `/catalog/${e.metadata.namespace ?? 'default'}/${e.kind.toLowerCase()}/${e.metadata.name}`;

const ownerOf = (e: Entity) => (e.spec?.owner as string | undefined)?.replace(/^[a-z]+:(default\/)?/, '');

const Chips = ({ entity }: { entity: Entity }) => {
  const classes = useStyles();
  const items = [
    entity.spec?.type as string | undefined,
    entity.spec?.lifecycle as string | undefined,
    ownerOf(entity) && `owner: ${ownerOf(entity)}`,
  ].filter(Boolean) as string[];
  return (
    <div className={classes.chips}>
      {items.map(i => (
        <Chip key={i} label={i} size="small" variant="outlined" className={classes.chip} />
      ))}
    </div>
  );
};

// Live environment health for a service, the same pills as its header.
const ServiceEnvironments = ({ entity }: { entity: Entity }) => {
  const classes = useStyles();
  const deployments = useDeployments(entity.metadata.name);
  if (deployments.status !== 'done' || deployments.deployments.length === 0) return null;
  return (
    <div className={classes.envs}>
      {deployments.deployments.map(d => (
        <EnvironmentHealthPill
          key={d.environment}
          component={entity.metadata.name}
          environment={d.environment}
          href={`${entityPath(entity)}/metrics`}
        />
      ))}
    </div>
  );
};

const EntityCard = ({ entity }: { entity: Entity }) => {
  const classes = useStyles();
  const isService = entity.kind === 'Component' && entity.spec?.type === 'service';
  return (
    <div className={classes.card}>
      <div className={classes.cardHead}>
        <span className={classes.cardIcon}>{kindIcon(entity.kind)}</span>
        <div style={{ minWidth: 0 }}>
          <Typography className={classes.cardKind}>{entity.kind}</Typography>
          <Link to={entityPath(entity)} className={classes.cardName}>
            {entity.metadata.title ?? entity.metadata.name}
          </Link>
        </div>
      </div>
      <Typography className={classes.cardText}>{entity.metadata.description ?? 'No description.'}</Typography>
      <Chips entity={entity} />
      {isService && <ServiceEnvironments entity={entity} />}
    </div>
  );
};

const CardGrid = () => {
  const classes = useStyles();
  const { entities, loading, error } = useEntityList();
  if (error) return <ResponseErrorPanel error={error} />;
  if (loading) return <Progress />;
  if (entities.length === 0) {
    return <div className={classes.empty}>Nothing matches these filters.</div>;
  }
  return (
    <Grid container spacing={2}>
      {entities.map(e => (
        <Grid item xs={12} md={6} xl={4} key={e.metadata.uid ?? entityPath(e)}>
          <EntityCard entity={e} />
        </Grid>
      ))}
    </Grid>
  );
};

// Table view: only the columns that carry information here (no System or
// Tags, which are empty for every entity today), and no edit action —
// visitors browse read-only.
const Table = () => {
  const scm = useApi(scmIntegrationsApiRef);
  const { isStarredEntity, toggleStarredEntity } = useStarredEntities();
  const columns = [
    CatalogTable.columns.createNameColumn(),
    CatalogTable.columns.createOwnerColumn(),
    CatalogTable.columns.createSpecTypeColumn(),
    CatalogTable.columns.createSpecLifecycleColumn(),
    { ...CatalogTable.columns.createMetadataDescriptionColumn(), width: 'auto' },
  ];
  const actions = [
    ({ entity }: CatalogTableRow) => {
      const source = (() => {
        try {
          return getEntitySourceLocation(entity, scm)?.locationTargetUrl;
        } catch {
          return undefined;
        }
      })();
      return {
        icon: () => <OpenInNewIcon fontSize="small" />,
        tooltip: 'View source',
        disabled: !source,
        onClick: () => source && window.open(source, '_blank', 'noopener'),
      };
    },
    ({ entity }: CatalogTableRow) => {
      const starred = isStarredEntity(entity);
      return {
        icon: () => (starred ? <StarIcon fontSize="small" style={{ color: '#f3ba37' }} /> : <StarBorderIcon fontSize="small" />),
        tooltip: starred ? 'Remove from favorites' : 'Add to favorites',
        onClick: () => toggleStarredEntity(entity),
      };
    },
  ];
  return <CatalogTable columns={columns} actions={actions} />;
};

const Toolbar = ({ view, setView }: { view: View; setView: (v: View) => void }) => {
  const classes = useStyles();
  const { entities, loading, filters } = useEntityList();
  const kind = filters.kind?.label ?? 'Entities';
  return (
    <div className={classes.toolbar}>
      <Typography className={classes.count}>
        {kind} {loading ? '' : `(${entities.length})`}
      </Typography>
      <div className={classes.toggle} role="group" aria-label="View">
        <Tooltip title="Cards">
          <IconButton
            size="small"
            className={`${classes.toggleButton} ${view === 'cards' ? classes.toggleActive : ''}`}
            aria-pressed={view === 'cards'}
            aria-label="Card view"
            onClick={() => setView('cards')}
          >
            <ViewModuleIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Table">
          <IconButton
            size="small"
            className={`${classes.toggleButton} ${view === 'table' ? classes.toggleActive : ''}`}
            aria-pressed={view === 'table'}
            aria-label="Table view"
            onClick={() => setView('table')}
          >
            <ViewListIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
};

// Count per kind, for the header's quick filters.
function useKindCounts(): { kind: string; count: number }[] {
  const catalogApi = useApi(catalogApiRef);
  const [counts, setCounts] = useState<{ kind: string; count: number }[]>([]);
  useEffect(() => {
    let cancelled = false;
    catalogApi
      .getEntityFacets({ facets: ['kind'] })
      .then(res => {
        if (cancelled) return;
        setCounts(
          (res.facets.kind ?? [])
            .map(f => ({ kind: f.value, count: f.count }))
            .filter(f => f.kind !== 'Location')
            .sort((a, b) => b.count - a.count),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [catalogApi]);
  return counts;
}

const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards';
  } catch {
    return 'cards';
  }
};

// The catalog index: a branded header with per-kind quick filters, the
// stock filter sidebar, and a card grid (default) or trimmed table.
export const CatalogPage = ({ filters }: { filters: ReactNode[] }) => {
  const classes = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const kinds = useKindCounts();
  const [view, setViewState] = useState<View>(readView);
  // Remounts the list provider when a header chip picks a kind, so every
  // filter re-reads the URL.
  const [resetKey, setResetKey] = useState(0);
  const { allowed: isOwner } = usePermission({ permission: taskCreatePermission });
  const activeKind = new URLSearchParams(location.search).get('filters[kind]')?.toLowerCase() ?? 'component';

  const setView = (v: View) => {
    // The table view loads lazily; a transition keeps the current view on
    // screen until it's ready instead of flashing a spinner.
    startTransition(() => setViewState(v));
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // per-viewer convenience only
    }
  };
  const pickKind = (kind: string) => {
    navigate(`/catalog?filters[kind]=${encodeURIComponent(kind.toLowerCase())}&filters[user]=all`);
    setResetKey(k => k + 1);
  };

  // "Owned" is always 0 for a guest; show them just Starred / All.
  const listPicker = (
    <UserListPicker
      key="list"
      initialFilter="all"
      availableFilters={isOwner ? ['owned', 'starred', 'all'] : ['starred', 'all']}
    />
  );
  const sidebar = [...filters.slice(0, 2), listPicker, ...filters.slice(2)];

  return (
    <Content>
      <section className={classes.band}>
        <div className={classes.bandTop}>
          <div>
            <Typography className={classes.eyebrow}>Software catalog</Typography>
            <Typography component="h1" className={classes.title}>
              Catalog
            </Typography>
            <Typography className={classes.lead}>
              Everything the platform knows about: services onboarded through a Component, the infrastructure bound
              to them, golden-path templates and the teams that own it all.
            </Typography>
          </div>
          {isOwner && (
            <Button variant="contained" startIcon={<AddIcon />} className={classes.createButton} onClick={() => navigate('/create')}>
              Create
            </Button>
          )}
        </div>
        <div className={classes.kinds}>
          {kinds.map(k => (
            <button
              type="button"
              key={k.kind}
              className={`${classes.kindChip} ${activeKind === k.kind.toLowerCase() ? classes.kindChipActive : ''}`}
              onClick={() => pickKind(k.kind)}
            >
              {kindIcon(k.kind)}
              {k.kind}
              <span className={classes.kindCount}>{k.count}</span>
            </button>
          ))}
        </div>
      </section>

      <EntityListProvider key={resetKey} pagination={false}>
        <CatalogFilterLayout>
          <CatalogFilterLayout.Filters>
            {/* Stock pickers load their icons lazily and can suspend on a
                re-render; keep that local too. */}
            <Suspense fallback={<Progress />}>{sidebar}</Suspense>
          </CatalogFilterLayout.Filters>
          <CatalogFilterLayout.Content>
            <Toolbar view={view} setView={setView} />
            {/* The stock CatalogTable can suspend while it loads; keep that
                to the list area rather than the whole page. */}
            <Suspense fallback={<Progress />}>
              <Box>{view === 'cards' ? <CardGrid /> : <Table />}</Box>
            </Suspense>
          </CatalogFilterLayout.Content>
        </CatalogFilterLayout>
      </EntityListProvider>
    </Content>
  );
};
