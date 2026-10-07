// Pure: what the deployment card's Database schema section says.
import type { SchemaStatus } from './useSchemaStatus';

export type SchemaTone = 'ok' | 'running' | 'pending' | 'error';

export interface SchemaView {
  tone: SchemaTone;
  // "Applied", "Migrating", ...
  status: string;
  // e.g. "Up to 20261009093000 · from 3f9c2e1"
  detail: string | null;
  // Reason a guest sees; owners also get `message`.
  reason: string | null;
  message: string | null;
  // Set when the deployed code expects a newer migration than the database has.
  warning: string | null;
}

const short = (sha: string | null | undefined) => (sha ? sha.slice(0, 7) : null);

// Why a DatabaseSchema isn't published yet, in words (schema-operator reasons).
const WAITING: Record<string, string> = {
  ArtifactNotFound: "waiting for this commit's schema package (its schema workflow may still be running, or failed)",
  DatabaseNotFound: 'waiting for a Database in this environment',
  ExportMissing: 'waiting for the Database to publish its connection details',
  ExportNotReady: 'waiting for the Database to publish its connection details',
  DatabaseAmbiguous: 'the component has several Databases here: the DatabaseSchema needs a databaseRef',
  ComponentNotFound: 'waiting for the Component',
  ComponentRepositoryNotReady: "waiting for the Component's repository",
};

// null: nothing to show (no schema released for this environment).
export function schemaView(s: SchemaStatus | null): SchemaView | null {
  if (!s || (!s.requested && !s.applied)) {
    return null;
  }
  const { requested, applied, code } = s;
  const warning =
    code?.ahead && code.newestMigration
      ? `The deployed version (${short(code.version)}) ships migrations up to ${code.newestMigration}, ` +
        `but the database has ${applied?.lastAppliedVersion ? `only up to ${applied.lastAppliedVersion}` : 'none applied'}. ` +
        'Apply its schema to this environment.'
      : null;

  // Asked for, but schema-operator hasn't published it yet.
  if (requested && requested.published !== true && requested.version !== applied?.commit) {
    return {
      tone: requested.published === false && requested.reason !== 'ArtifactNotFound' && !WAITING[requested.reason ?? '']
        ? 'error'
        : 'pending',
      status: 'Waiting',
      detail: `${short(requested.version)} requested`,
      reason: WAITING[requested.reason ?? ''] ?? requested.reason,
      message: requested.message ?? null,
      warning,
    };
  }
  if (!applied) {
    return {
      tone: 'pending',
      status: 'Pending',
      detail: requested ? `${short(requested.version)} requested` : null,
      reason: 'waiting for Argo CD to deploy the schema package',
      message: null,
      warning,
    };
  }

  const upTo = applied.lastAppliedVersion ? `Up to ${applied.lastAppliedVersion}` : 'No migrations applied';
  const from = applied.commit ? ` · from ${short(applied.commit)}` : '';
  switch (applied.phase) {
    case 'Applied':
      return { tone: 'ok', status: 'Applied', detail: `${upTo}${from}`, reason: null, message: null, warning };
    case 'Failed':
      return {
        tone: 'error',
        status: 'Failed',
        detail: `${upTo} · ${short(applied.commit) ?? 'this version'} failed`,
        reason: applied.reason,
        message: applied.message ?? null,
        warning,
      };
    case 'Migrating':
      return {
        tone: 'running',
        status: 'Migrating',
        detail: `Applying ${short(applied.commit) ?? 'new migrations'} · ${upTo.toLowerCase()} so far`,
        reason: applied.reason === 'GettingDevDB' ? 'starting a throwaway database to check the migrations' : null,
        message: null,
        warning,
      };
    default:
      return {
        tone: 'pending',
        status: 'Pending',
        detail: applied.commit ? `${short(applied.commit)} deployed, not checked yet` : null,
        reason: null,
        message: null,
        warning,
      };
  }
}
