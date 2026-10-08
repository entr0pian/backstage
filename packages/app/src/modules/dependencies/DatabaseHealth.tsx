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

export type DatabaseHealthState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'done';
      availability: HealthFact;
      // null: nothing to say about this database's schema (see schemaFact).
      schema: HealthFact | null;
      binding: HealthFact;
      // e.g. "postgres 16.13 · small"
      engine: string;
    };

// A platform Database's availability, schema and binding in one environment
// (see databaseHealth.ts), live: both reads poll. Shared by the Overview
// card's table and the Dependencies tab.
export function useDatabaseHealth(
  namespace: string,
  name: string,
  environment: string,
  onlyDatabase: boolean,
): DatabaseHealthState {
  const { entity } = useEntity();
  const state = useDatabaseDetails(namespace, name);
  const schema = useSchemaStatus(entity.metadata.name, environment);
  if (state.status !== 'done') {
    return { status: state.status };
  }
  const d = state.details;
  return {
    status: 'done',
    availability: availabilityFact(d),
    schema: schemaFact(schema, name, onlyDatabase),
    binding: bindingFact(d, environment),
    engine: [d.engine && [d.engine.engine, d.engine.version].filter(Boolean).join(' '), d.spec.size]
      .filter(Boolean)
      .join(' · '),
  };
}

// One fact. `compact` (a table cell) shows the label with its detail as a
// tooltip; otherwise the detail follows the label.
export const HealthFactStatus = ({ fact, compact = false }: { fact: HealthFact; compact?: boolean }) => {
  const Status = STATUS[fact.tone];
  const status = <Status>{compact ? fact.short ?? fact.label : fact.label}</Status>;
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

// The Dependencies tab's form: the three facts in a row, each with its
// detail, wrapping only when the row is too narrow; engine and size
// underneath.
export const DatabaseHealth = ({
  namespace,
  name,
  environment,
  onlyDatabase,
}: {
  namespace: string;
  name: string;
  environment: string;
  onlyDatabase: boolean;
}) => {
  const health = useDatabaseHealth(namespace, name, environment, onlyDatabase);

  if (health.status === 'loading') {
    return (
      <Typography variant="caption" color="textSecondary">
        checking…
      </Typography>
    );
  }
  if (health.status === 'error') {
    return <StatusPending>Status unavailable</StatusPending>;
  }
  const facts = [health.availability, health.schema, health.binding].filter((f): f is HealthFact => f !== null);
  return (
    <Box>
      <Box display="flex" flexWrap="wrap" alignItems="center" style={{ columnGap: 24, rowGap: 4 }}>
        {facts.map(fact => (
          <HealthFactStatus key={fact.label} fact={fact} />
        ))}
      </Box>
      {health.engine && (
        <Typography variant="caption" color="textSecondary">
          {health.engine}
        </Typography>
      )}
    </Box>
  );
};
