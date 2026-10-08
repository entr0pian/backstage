import type { ReactNode } from 'react';
import Box from '@material-ui/core/Box';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import {
  StatusError,
  StatusOK,
  StatusPending,
  StatusRunning,
  StatusWarning,
} from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useDatabaseDetails } from '../databases/useDatabaseDetails';
import { useSchemaStatus } from '../deployments/useSchemaStatus';
import { availabilityFact, bindingFact, schemaFact, type HealthFact, type HealthTone } from './databaseHealth';

const STATUS: Record<HealthTone, (props: { children?: ReactNode }) => JSX.Element> = {
  ok: StatusOK,
  running: StatusRunning,
  pending: StatusPending,
  warning: StatusWarning,
  error: StatusError,
  neutral: StatusPending,
};

const Fact = ({ fact, compact }: { fact: HealthFact; compact: boolean }) => {
  const Status = STATUS[fact.tone];
  const status = <Status>{fact.label}</Status>;
  if (compact) {
    return fact.detail ? (
      <Tooltip title={fact.detail}>
        <span>{status}</span>
      </Tooltip>
    ) : (
      status
    );
  }
  return (
    <Box display="flex" alignItems="baseline" style={{ gap: 6 }}>
      {status}
      {fact.detail && (
        <Typography variant="caption" color="textSecondary">
          {fact.detail}
        </Typography>
      )}
    </Box>
  );
};

// A platform Database's availability, schema and binding in one
// environment (see databaseHealth.ts). `compact` is the Overview card's
// one-line form: labels only, details as tooltips. The full form (the
// Dependencies tab) puts each detail next to its label, wrapping only when
// the row is too narrow, and adds the engine and size underneath.
export const DatabaseHealth = ({
  namespace,
  name,
  environment,
  onlyDatabase,
  compact = false,
}: {
  namespace: string;
  name: string;
  environment: string;
  onlyDatabase: boolean;
  compact?: boolean;
}) => {
  const { entity } = useEntity();
  const state = useDatabaseDetails(namespace, name);
  const schema = useSchemaStatus(entity.metadata.name, environment);

  if (state.status === 'loading') {
    return (
      <Typography variant="caption" color="textSecondary">
        checking…
      </Typography>
    );
  }
  if (state.status === 'error') {
    return <StatusPending>Status unavailable</StatusPending>;
  }
  const d = state.details;
  const facts = [availabilityFact(d), schemaFact(schema, name, onlyDatabase), bindingFact(d, environment)].filter(
    (f): f is HealthFact => f !== null,
  );
  const engine = [d.engine && [d.engine.engine, d.engine.version].filter(Boolean).join(' '), d.spec.size]
    .filter(Boolean)
    .join(' · ');

  const row = (
    <Box display="flex" flexWrap="wrap" alignItems="center" style={{ columnGap: compact ? 12 : 24, rowGap: 4 }}>
      {facts.map(fact => (
        <Fact key={fact.label} fact={fact} compact={compact} />
      ))}
    </Box>
  );
  if (compact || !engine) {
    return row;
  }
  return (
    <Box>
      {row}
      <Typography variant="caption" color="textSecondary">
        {engine}
      </Typography>
    </Box>
  );
};
