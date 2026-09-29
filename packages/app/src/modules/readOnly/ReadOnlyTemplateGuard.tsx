import type { ReactNode } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import LockOutlinedIcon from '@material-ui/icons/LockOutlined';
import GitHubIcon from '@material-ui/icons/GitHub';
import { usePermission } from '@backstage/plugin-permission-react';
import { taskCreatePermission } from '@backstage/plugin-scaffolder-common/alpha';
import { brand } from '../theme/themes';

// Where the platform's templates live, for "see what it would do".
const TEMPLATE_SOURCE = 'https://github.com/entr0pian/backstage/tree/main/templates';

const useStyles = makeStyles(theme => ({
  paper: { borderRadius: 16, overflow: 'hidden', maxWidth: 520 },
  band: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2.5, 3),
    color: '#fff',
    backgroundImage: `linear-gradient(120deg, ${brand.indigoDeep}, ${brand.indigo} 55%, ${brand.cyanDeep})`,
  },
  icon: {
    display: 'grid',
    placeItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    flexShrink: 0,
  },
  title: { fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-0.01em' },
  subtitle: { fontSize: '0.85rem', opacity: 0.9 },
  body: { padding: theme.spacing(2.5, 3, 1) },
  list: { margin: theme.spacing(1, 0, 0), paddingLeft: theme.spacing(2.5), '& li': { marginBottom: 4 } },
  actions: { padding: theme.spacing(1.5, 3, 2.5), gap: theme.spacing(1), flexWrap: 'wrap' },
}));

// Guests browse read-only (modules/permissionPolicy in the backend): they
// can open a template but can't run it, and the stock scaffolder form then
// shows an empty "Review" step with a Create button that would fail. This
// wraps the whole app and, on any template page, explains that instead —
// however the visitor got there (Home, the Create page, a pasted link).
export const ReadOnlyTemplateGuard = ({ children }: { children: ReactNode }) => {
  const classes = useStyles();
  const location = useLocation();
  const navigate = useNavigate();
  const match = matchPath('/create/templates/:namespace/:name', location.pathname);
  const { loading, allowed } = usePermission({ permission: taskCreatePermission });
  const open = Boolean(match) && !loading && !allowed;
  const name = match?.params.name;

  return (
    <>
      {children}
      <Dialog
        open={open}
        onClose={() => navigate('/create')}
        classes={{ paper: classes.paper }}
        aria-labelledby="read-only-title"
      >
        <div className={classes.band}>
          <span className={classes.icon}>
            <LockOutlinedIcon />
          </span>
          <div>
            <Typography id="read-only-title" className={classes.title}>
              You're browsing read-only
            </Typography>
            <Typography className={classes.subtitle}>Signed in as a guest</Typography>
          </div>
        </div>
        <DialogContent className={classes.body}>
          <Typography variant="body2">
            Golden-path templates open real pull requests against this platform's GitOps repositories, so running
            them is limited to the platform owner.
          </Typography>
          <Typography variant="body2" component="div" style={{ marginTop: 12 }}>
            As a guest you can still:
            <ul className={classes.list}>
              <li>explore every service, its deployments and live metrics;</li>
              <li>open the public Grafana and Argo CD views;</li>
              <li>read the template definition to see exactly what it would do.</li>
            </ul>
          </Typography>
        </DialogContent>
        <DialogActions className={classes.actions}>
          {name && (
            <Button
              href={`${TEMPLATE_SOURCE}/${encodeURIComponent(name)}`}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<GitHubIcon />}
            >
              View template source
            </Button>
          )}
          <Box flex={1} />
          <Button onClick={() => navigate('/create')}>Back to templates</Button>
          <Button variant="contained" color="primary" onClick={() => navigate('/')}>
            Go to Home
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
