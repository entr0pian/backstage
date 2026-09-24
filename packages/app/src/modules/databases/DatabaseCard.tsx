import Box from '@material-ui/core/Box';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import {
  InfoCard,
  Link,
  Progress,
  ResponseErrorPanel,
  StatusError,
  StatusOK,
  StatusPending,
  StatusWarning,
  StructuredMetadataTable,
  Table,
  type TableColumn,
} from '@backstage/core-components';
import { useRouteRef } from '@backstage/core-plugin-api';
import { entityRouteRef, useEntity } from '@backstage/plugin-catalog-react';
import { useDatabaseDetails, type DatabaseDetails } from './useDatabaseDetails';

type Resource = DatabaseDetails['resources'][number];

const ResourceState = ({ r }: { r: Resource }) => {
  if (r.ready === true) return <StatusOK>{r.source === 'inferred' ? 'Ready (inferred)' : 'Ready'}</StatusOK>;
  if (r.ready === false) return <StatusError>{r.reason ?? 'Not ready'}</StatusError>;
  return <StatusPending>Unknown</StatusPending>;
};

const resourceColumns: TableColumn<Resource>[] = [
  { title: 'Kind', field: 'kind' },
  { title: 'Name', field: 'name' },
  { title: 'State', render: r => <ResourceState r={r} /> },
  {
    title: 'Notes',
    render: r => (
      <Typography variant="body2" color="textSecondary">
        {r.note ?? r.message ?? ''}
      </Typography>
    ),
  },
];

const HeaderStatus = ({ d }: { d: DatabaseDetails }) => {
  if (d.ready === true) return <StatusOK>Ready</StatusOK>;
  if (d.ready === false) return <StatusWarning>Not ready</StatusWarning>;
  return <StatusPending>Unknown</StatusPending>;
};

const yesNo = (v: boolean | null) => {
  if (v === null) return '—';
  return v ? 'yes' : 'no';
};

// The platform view of a Database (BACKSTAGE_PART9.md Part B): its status,
// how services get its credentials (the binding chain), and what Crossplane
// provisioned for it. Data comes pre-joined and redacted from
// /api/platform/databases/:namespace/:name.
export const DatabaseCard = () => {
  const { entity } = useEntity();
  const entityRoute = useRouteRef(entityRouteRef);
  const annotations = entity.metadata.annotations ?? {};
  const namespace = annotations['platform.taskapp.io/kubernetes-namespace'] ?? '';
  const name = annotations['platform.taskapp.io/database-name'] ?? entity.metadata.title ?? '';
  const state = useDatabaseDetails(namespace, name);

  if (state.status === 'loading') return <Progress />;
  if (state.status === 'error') return <ResponseErrorPanel error={state.error} />;
  const d = state.details;

  const componentLink = d.component
    ? entityRoute({ namespace: 'default', kind: 'component', name: d.component })
    : null;

  const status: Record<string, string> = {
    Environment: d.namespace,
    Database: d.spec.dbName ?? '—',
    Size: d.spec.size ?? '—',
    ...(d.engine
      ? {
          Engine: [d.engine.engine, d.engine.version].filter(Boolean).join(' ') || '—',
          'Instance class': d.engine.instanceClass ?? '—',
          Storage: d.engine.storageGb !== null ? `${d.engine.storageGb} GB` : '—',
          'AWS status': d.engine.status ?? '—',
          'Availability zone': d.engine.availabilityZone ?? '—',
          'Multi-AZ': yesNo(d.engine.multiAz),
          Encrypted: yesNo(d.engine.encrypted),
        }
      : {}),
    Created: d.createdAt ? new Date(d.createdAt).toLocaleString() : '—',
  };

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <InfoCard
          title={d.name}
          subheader={
            <>
              database · {d.namespace}
              {componentLink && (
                <>
                  {' · used by '}
                  <Link to={componentLink}>{d.component}</Link>
                </>
              )}
            </>
          }
          action={
            <Box pt={2} pr={2}>
              <HeaderStatus d={d} />
            </Box>
          }
        >
          {d.problem && (
            <Box mb={2}>
              <StatusWarning>{d.problem}</StatusWarning>
            </Box>
          )}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="overline" color="textSecondary">
                Status
              </Typography>
              <StructuredMetadataTable dense metadata={status} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="overline" color="textSecondary">
                Connection
              </Typography>
              {d.connection.length === 0 && (
                <Typography variant="body2" color="textSecondary">
                  No connection details published yet.
                </Typography>
              )}
              {d.connection.map(c => (
                <Box key={c.name} mb={1}>
                  <Typography variant="body2" component="div">
                    {c.ready ? <StatusOK>Published</StatusOK> : <StatusPending>Not published yet</StatusPending>}
                  </Typography>
                  <Typography variant="body2" component="div">
                    Stored in {c.provider === 'AWSSecretsManager' ? 'AWS Secrets Manager' : c.provider ?? '—'} at{' '}
                    <code>{c.key ?? '—'}</code>
                  </Typography>
                </Box>
              ))}
              <Box mt={1}>
                {d.boundBy.length === 0 && (
                  <Typography variant="body2" color="textSecondary">
                    No Release binds this database yet.
                  </Typography>
                )}
                {d.boundBy.map(b => (
                  <Typography key={b.release} variant="body2" component="div">
                    Bound by Release <b>{b.release}</b> ({b.environment}) — mounted at{' '}
                    <code>{b.mountPath}</code>
                  </Typography>
                ))}
              </Box>
              {d.endpoint && (
                <Box mt={2}>
                  <Typography variant="overline" color="textSecondary">
                    Endpoint (owner only)
                  </Typography>
                  <Typography variant="body2" component="div">
                    <code>
                      {d.endpoint.address ?? '—'}
                      {d.endpoint.port ? `:${d.endpoint.port}` : ''}
                    </code>
                  </Typography>
                  {d.endpoint.consoleUrl && (
                    <Link to={d.endpoint.consoleUrl} target="_blank" rel="noopener noreferrer">
                      Open in AWS console ↗
                    </Link>
                  )}
                </Box>
              )}
            </Grid>
          </Grid>
        </InfoCard>
      </Grid>
      <Grid item xs={12}>
        <Table
          title="Provisioned resources (Crossplane)"
          options={{ search: false, paging: false, padding: 'dense' }}
          columns={resourceColumns}
          data={d.resources}
        />
      </Grid>
    </Grid>
  );
};
