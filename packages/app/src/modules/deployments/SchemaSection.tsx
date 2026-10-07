import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import {
  LinkButton,
  StatusError,
  StatusOK,
  StatusPending,
  StatusRunning,
  StatusWarning,
} from '@backstage/core-components';
import { applySchemaHref } from '../platformActions/applySchemaHref';
import { useSchemaStatus } from './useSchemaStatus';
import { schemaView, type SchemaTone } from './schemaView';

const useStyles = makeStyles(theme => ({
  label: { color: theme.palette.text.secondary, fontSize: '0.8rem', margin: theme.spacing(2, 0, 0.75) },
  line: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing(1), fontSize: '0.9rem' },
  detail: { fontFamily: 'monospace', fontSize: '0.9rem' },
  muted: { color: theme.palette.text.secondary, fontSize: '0.8rem' },
  message: {
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: theme.spacing(1, 0, 0),
    padding: theme.spacing(1, 1.5),
    borderRadius: 6,
    background: theme.palette.background.default,
    maxHeight: 160,
    overflow: 'auto',
  },
  warning: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing(1), marginTop: theme.spacing(1) },
}));

const STATUS: Record<SchemaTone, typeof StatusOK> = {
  ok: StatusOK,
  running: StatusRunning,
  pending: StatusPending,
  error: StatusError,
};

// The environment's database schema, released separately from the code: is
// the DatabaseSchema's version applied (the AtlasMigration's status), and
// does the deployed code expect a migration the database doesn't have yet.
// Hidden for environments with no schema released.
export const SchemaSection = ({
  component,
  environment,
  canDeploy,
}: {
  component: string;
  environment: string;
  canDeploy: boolean;
}) => {
  const classes = useStyles();
  const view = schemaView(useSchemaStatus(component, environment));
  if (!view) {
    return null;
  }
  const Status = STATUS[view.tone];
  return (
    <>
      <Typography className={classes.label}>Database schema</Typography>
      <div className={classes.line}>
        <Status>{view.status}</Status>
        {view.detail && <span className={classes.detail}>{view.detail}</span>}
        {view.reason && <span className={classes.muted}>{view.reason}</span>}
      </div>
      {view.message && <pre className={classes.message}>{view.message}</pre>}
      {view.warning && (
        <Box className={classes.warning}>
          <StatusWarning>{view.warning}</StatusWarning>
          {canDeploy && (
            <LinkButton size="small" color="primary" variant="outlined" to={applySchemaHref(component, environment)}>
              Apply database schema
            </LinkButton>
          )}
        </Box>
      )}
    </>
  );
};
