import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Divider from '@material-ui/core/Divider';
import Drawer from '@material-ui/core/Drawer';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import CloseIcon from '@material-ui/icons/Close';
import {
  Link,
  Progress,
  ResponseErrorPanel,
  StatusError,
  StatusOK,
  StatusPending,
  StatusWarning,
} from '@backstage/core-components';
import { useRouteRef } from '@backstage/core-plugin-api';
import { entityRouteRef } from '@backstage/plugin-catalog-react';
import type { ReactNode } from 'react';
import { argoApplicationUrl, type Deployment } from './joinDeployments';
import { useEnvironmentDetails, type EnvironmentDetails } from './useEnvironmentDetails';
import { shortVersion } from '../platformUi';

function age(since: string | null): string {
  if (!since) return '—';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

function time(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}


const Section = ({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) => (
  <Box mt={3}>
    <Box display="flex" justifyContent="space-between" alignItems="baseline">
      <Typography variant="overline" color="textSecondary">
        {title}
      </Typography>
      {aside}
    </Box>
    <Divider />
    <Box mt={1}>{children}</Box>
  </Box>
);

const Line = ({ children }: { children: ReactNode }) => (
  <Typography variant="body2" component="div" style={{ marginBottom: 4 }}>
    {children}
  </Typography>
);

const Muted = ({ children }: { children: ReactNode }) => (
  <Typography variant="body2" color="textSecondary" component="span">
    {children}
  </Typography>
);

// Status icon + its text on one line (a bare <StatusOK /> renders the
// icon as its own block, pushing the text to the next line).
const Ok = ({ ok, children }: { ok: boolean; children: ReactNode }) =>
  ok ? <StatusOK>{children}</StatusOK> : <StatusError>{children}</StatusError>;

const PodStatusIcon = ({ ready, failing }: { ready: boolean; failing: boolean }) => {
  if (ready) return <StatusOK />;
  if (failing) return <StatusError />;
  return <StatusPending />;
};

// The Database page for a binding's provider. Entity names are
// "<namespace>-<crName>" — the Platform Entity Provider's
// databaseEntityName() in the backend; keep the two in step.
const useDatabaseLink = () => {
  const entityRoute = useRouteRef(entityRouteRef);
  return (ref: { namespace: string; name: string }) =>
    entityRoute({ namespace: 'default', kind: 'resource', name: `${ref.namespace}-${ref.name}` });
};

const WorkloadSection = ({
  details,
  onViewLogs,
  logsAllowed,
}: {
  details: EnvironmentDetails;
  onViewLogs: (podName?: string) => void;
  logsAllowed: boolean;
}) => {
  const { workload, release } = details;
  const allReady = workload.desiredReplicas > 0 && workload.readyReplicas === workload.desiredReplicas;
  return (
    <Section
      title="Workload"
      aside={
        allReady ? (
          <StatusOK>
            {workload.readyReplicas}/{workload.desiredReplicas} ready
          </StatusOK>
        ) : (
          <StatusWarning>
            {workload.readyReplicas}/{workload.desiredReplicas} ready
          </StatusWarning>
        )
      }
    >
      {workload.pods.length === 0 && (
        <Line>
          <Muted>
            No pods found for this environment. They are found by their
            platform.taskapp.io labels — a chart older than golang-service 0.6.0 won't have them.
          </Muted>
        </Line>
      )}
      {workload.pods.map(pod => (
        <Box key={`${pod.namespace}/${pod.name}`} mb={1}>
          <Box display="flex" alignItems="center" style={{ gap: 12 }}>
            <PodStatusIcon ready={pod.ready} failing={pod.problem !== null} />
            <Typography variant="body2" style={{ fontFamily: 'monospace' }}>
              {pod.name}
            </Typography>
            <Muted>
              {pod.phase} · {pod.ready ? 'ready' : 'not ready'} · {pod.restarts} restart
              {pod.restarts === 1 ? '' : 's'} · age {age(pod.createdAt)}
            </Muted>
            {logsAllowed && (
              <Button size="small" color="primary" onClick={() => onViewLogs(pod.name)}>
                Logs
              </Button>
            )}
          </Box>
          {pod.problem && (
            <Box ml={4}>
              <StatusError>
                {pod.problem.reason}
                {pod.problem.exitCode !== undefined ? ` (exit code ${pod.problem.exitCode})` : ''}
              </StatusError>
            </Box>
          )}
        </Box>
      ))}
      {workload.runningImageTags.length > 0 && (
        <Line>
          <Muted>Image </Muted>
          {workload.runningImageTags.map(shortVersion).join(', ')}{' '}
          {workload.imageMatchesRelease === true && <StatusOK>matches Release</StatusOK>}
          {workload.imageMatchesRelease === false && release && (
            <StatusWarning>
              Release asks for {shortVersion(release.version)} — rollout in progress or drift
            </StatusWarning>
          )}
        </Line>
      )}
    </Section>
  );
};

const NetworkingSection = ({ details }: { details: EnvironmentDetails }) => (
  <Section title="Networking">
    {details.networking.services.length === 0 && (
      <Line>
        <Muted>No Service found for this environment.</Muted>
      </Line>
    )}
    {details.networking.services.map(svc => (
      <Line key={`${svc.namespace}/${svc.name}`}>
        <Ok ok={svc.readyEndpoints > 0}>
          Service <b>{svc.name}</b> {svc.ports.map(p => `:${p.port}`).join(', ')} →{' '}
          {svc.readyEndpoints} ready endpoint{svc.readyEndpoints === 1 ? '' : 's'}
          {svc.notReadyEndpoints > 0 ? `, ${svc.notReadyEndpoints} not ready` : ''}
        </Ok>
      </Line>
    ))}
    <Line>
      <Muted>No external URL yet — ingress isn't configured for this environment.</Muted>
    </Line>
  </Section>
);

const BindingsSection = ({ details }: { details: EnvironmentDetails }) => {
  const databaseLink = useDatabaseLink();
  return (
    <Section title="Configuration & bindings">
      {details.bindings.length === 0 && (
        <Line>
          <Muted>The Release declares no bindings.</Muted>
        </Line>
      )}
      {details.bindings.map(b => (
        <Box key={b.name} mb={2}>
          <Line>
            <Ok ok={!b.problem}>
              <b>{b.name}</b>
              {b.externalSecret && (
                <>
                  {' '}
                  → {b.externalSecret.name}{' '}
                  <Muted>
                    {b.externalSecret.reason ?? 'no status yet'}
                    {b.externalSecret.refreshTime ? ` · refreshed ${time(b.externalSecret.refreshTime)}` : ''}
                  </Muted>
                </>
              )}
            </Ok>
          </Line>
          <Box ml={4}>
            {b.externalSecret?.remoteKey && (
              <Line>
                <Muted>from Secrets Manager </Muted>
                <code>{b.externalSecret.remoteKey}</code>
              </Line>
            )}
            {b.providerRef && (
              <Line>
                <Muted>provided by {b.providerRef.kind} </Muted>
                {b.providerRef.kind === 'Database' ? (
                  <Link to={databaseLink(b.providerRef)}>{b.providerRef.name}</Link>
                ) : (
                  b.providerRef.name
                )}
              </Line>
            )}
            <Line>
              <Muted>mounted at </Muted>
              <code>{b.mountPath}</code>
            </Line>
            {b.problem && (
              <Line>
                <StatusError>{b.problem}</StatusError>
              </Line>
            )}
            {b.externalSecret?.message && b.externalSecret.ready !== true && (
              <Line>
                <Muted>{b.externalSecret.message}</Muted>
              </Line>
            )}
          </Box>
        </Box>
      ))}
    </Section>
  );
};

const WarningsSection = ({ details }: { details: EnvironmentDetails }) => (
  <Section title="Recent warnings (last hour)">
    {details.warnings.length === 0 && (
      <Line>
        <StatusOK>none</StatusOK>
      </Line>
    )}
    {details.warnings.map(w => (
      <Box key={`${w.reason}/${w.objectKind}/${w.objectName}`} mb={1}>
        <Line>
          <StatusWarning>
            {w.reason} ×{w.count}
          </StatusWarning>{' '}
          <Muted>
            on {w.objectKind} {w.objectName} · last {time(w.lastSeen)}
          </Muted>
        </Line>
        {w.message && (
          <Box ml={4}>
            <Muted>{w.message}</Muted>
          </Box>
        )}
      </Box>
    ))}
    {details.detailLevel === 'summary' && details.warnings.length > 0 && (
      <Line>
        <Muted>Sign in with GitHub to see full event messages.</Muted>
      </Line>
    )}
  </Section>
);

// Level 3 of the Deployments tab (BACKSTAGE_PART9.md Part A): one
// component in one environment, grouped by what it means to a developer —
// is it running, can anything reach it, is it wired correctly, what went
// wrong. Replaces the Argo CD plugin's embedded resource view.
export const DetailsDrawer = ({
  component,
  deployment,
  argocdUiUrl,
  logsAllowed,
  onClose,
  onViewLogs,
}: {
  component: string;
  deployment: Deployment | null;
  argocdUiUrl?: string;
  logsAllowed: boolean;
  onClose: () => void;
  onViewLogs: (environment: string, podName?: string) => void;
}) => {
  const state = useEnvironmentDetails(component, deployment?.environment ?? null);
  const argoUrl = deployment ? argoApplicationUrl(argocdUiUrl, deployment) : null;

  return (
    <Drawer anchor="right" open={deployment !== null} onClose={onClose}>
      <Box width={720} maxWidth="100vw" p={3}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h5">
              {component} · {deployment?.environment}
            </Typography>
            {state.status === 'done' && state.details.release && (
              <Typography variant="body2" color="textSecondary">
                Release {state.details.release.name} → {shortVersion(state.details.release.version)}
                {deployment?.lastDeployed ? ` · deployed ${time(deployment.lastDeployed)}` : ''}
              </Typography>
            )}
          </Box>
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            {deployment?.healthStatus === 'Healthy' ? (
              <StatusOK>Healthy</StatusOK>
            ) : (
              <StatusWarning>{deployment?.healthStatus}</StatusWarning>
            )}
            <IconButton aria-label="Close details" onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {state.status === 'loading' && <Progress />}
        {state.status === 'error' && <ResponseErrorPanel error={state.error} />}
        {state.status === 'done' && deployment && (
          <>
            <WorkloadSection
              details={state.details}
              logsAllowed={logsAllowed}
              onViewLogs={podName => onViewLogs(deployment.environment, podName)}
            />
            <NetworkingSection details={state.details} />
            <BindingsSection details={state.details} />
            <WarningsSection details={state.details} />
          </>
        )}

        <Box mt={3} display="flex" style={{ gap: 8 }}>
          {argoUrl && (
            <Button variant="outlined" color="primary" href={argoUrl} target="_blank" rel="noopener noreferrer">
              Open in Argo CD
            </Button>
          )}
          {deployment && logsAllowed && (
            <Button variant="outlined" color="primary" onClick={() => onViewLogs(deployment.environment)}>
              Logs
            </Button>
          )}
          <Button onClick={state.reload}>Refresh</Button>
        </Box>
      </Box>
    </Drawer>
  );
};
