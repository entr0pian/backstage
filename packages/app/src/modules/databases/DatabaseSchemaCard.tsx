import Box from '@material-ui/core/Box';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import TableChartOutlinedIcon from '@material-ui/icons/TableChartOutlined';
import { InfoCard, LinkButton, Progress } from '@backstage/core-components';
import type { SchemaStatus } from '../deployments/useSchemaStatus';
import { HealthFactStatus } from '../dependencies/DatabaseHealth';
import { applySchemaHref } from '../platformActions/applySchemaHref';
import { schemaChecks } from './schemaChecks';

const useStyles = makeStyles(theme => ({
  states: {
    display: 'block',
    marginTop: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
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
  check: { width: '45%' },
}));

// The Database page's schema card: every check a schema version passes on
// its way into this database (schemaChecks.ts), with what each can show, and
// for owners the way to apply a newer one.
export const DatabaseSchemaCard = ({
  component,
  environment,
  database,
  schema,
  canApply,
}: {
  component: string;
  environment: string;
  database: string;
  schema: SchemaStatus | null;
  canApply: boolean;
}) => {
  const classes = useStyles();
  const checks = schema ? schemaChecks(schema, database) : null;

  return (
    <InfoCard
      title="Database schema"
      subheader="Migrations from the service's repository, released separately from its code"
      action={
        canApply ? (
          <Box pt={2} pr={2}>
            <LinkButton
              to={applySchemaHref(component, environment)}
              color="primary"
              variant="outlined"
              size="small"
              startIcon={<TableChartOutlinedIcon />}
            >
              Apply database schema
            </LinkButton>
          </Box>
        ) : undefined
      }
    >
      {!schema && <Progress />}
      {schema && !checks && (
        <Typography variant="body2" color="textSecondary">
          This environment's schema is applied to {schema.requested?.database}, not this database.
        </Typography>
      )}
      {checks && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell className={classes.check}>Check</TableCell>
              <TableCell>State</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {checks.map(check => (
              <TableRow key={check.key}>
                <TableCell className={classes.check}>
                  <Typography variant="body2">
                    <b>{check.title}</b>
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {check.description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <HealthFactStatus fact={check.fact} />
                  {check.message && <pre className={classes.message}>{check.message}</pre>}
                  <Typography variant="caption" className={classes.states}>
                    Can be: {check.states.join(' · ')}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </InfoCard>
  );
};
