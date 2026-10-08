import type { SchemaStatus } from '../deployments/useSchemaStatus';
import { WAITING } from '../deployments/schemaView';
import type { HealthFact } from '../dependencies/databaseHealth';

// The Database page's schema checks: every stage a schema version goes
// through on its way into this database, each with its current state and
// the states it can be in. Pure, so the wording is tested.

export interface SchemaCheck {
  key: 'package' | 'requested' | 'applied' | 'latest' | 'code';
  title: string;
  // What the check means, in one sentence.
  description: string;
  // Every state this check can show, in order of the happy path.
  states: string[];
  fact: HealthFact;
  // Atlas's error (the failing SQL and the database's answer): owners only,
  // the backend leaves it out for guests.
  message?: string | null;
}

const short = (sha: string) => sha.slice(0, 7);

// null: the environment's schema targets another of the component's
// databases, so none of these apply here.
export function schemaChecks(s: SchemaStatus, database: string): SchemaCheck[] | null {
  const { requested, applied, code, latest } = s;
  if (requested?.database && requested.database !== database) {
    return null;
  }

  const pkg: HealthFact = latest
    ? { label: 'Published', tone: 'ok', detail: `${short(latest.version)} is the newest version` }
    : { label: 'None yet', tone: 'neutral', detail: 'No green schema workflow run on main' };

  let req: HealthFact;
  if (!requested) {
    req = { label: 'Not requested', tone: 'neutral', detail: 'No DatabaseSchema for this environment yet' };
  } else if (requested.published === true) {
    req = { label: 'Resolved', tone: 'ok', detail: `${short(requested.version)} requested` };
  } else if (requested.published === false) {
    const known = WAITING[requested.reason ?? ''];
    req = {
      label: 'Waiting',
      tone: known || requested.reason === 'ArtifactNotFound' ? 'pending' : 'error',
      detail: known ?? requested.reason ?? undefined,
    };
  } else {
    req = { label: 'Pending', tone: 'pending', detail: `${short(requested.version)} requested` };
  }

  let app: HealthFact;
  const upTo = applied?.lastAppliedVersion ? `up to ${applied.lastAppliedVersion}` : 'no migrations applied';
  if (!applied) {
    app = requested
      ? { label: 'Pending', tone: 'pending', detail: 'Waiting for Argo CD to deploy the schema package' }
      : { label: 'Nothing applied', tone: 'neutral' };
  } else if (applied.phase === 'Applied') {
    app = {
      label: 'Applied',
      tone: 'ok',
      detail: applied.commit ? `${upTo} · from ${short(applied.commit)}` : upTo,
    };
  } else if (applied.phase === 'Failed') {
    app = {
      label: 'Failed',
      tone: 'error',
      detail: `${applied.commit ? short(applied.commit) : 'This version'} failed (${applied.reason ?? 'unknown reason'}); the database stays ${upTo}`,
    };
  } else if (applied.phase === 'Migrating') {
    app = {
      label: 'Migrating',
      tone: 'running',
      detail:
        applied.reason === 'GettingDevDB'
          ? 'Checking the migrations on a throwaway database first'
          : `Applying ${applied.commit ? short(applied.commit) : 'new migrations'}, ${upTo} so far`,
    };
  } else {
    app = { label: 'Pending', tone: 'pending', detail: 'Deployed, not checked yet' };
  }

  let up: HealthFact;
  if (!latest) {
    up = { label: 'Unknown', tone: 'neutral', detail: 'No published version to compare with' };
  } else if (!applied?.commit || applied.phase !== 'Applied') {
    up = { label: 'Not yet', tone: 'pending', detail: `${short(latest.version)} is the newest version` };
  } else if (applied.commit === latest.version) {
    up = { label: 'Latest', tone: 'ok', detail: `${short(latest.version)} applied` };
  } else {
    up = {
      label: 'Behind',
      tone: 'warning',
      detail: `${short(applied.commit)} applied, ${short(latest.version)} is published`,
    };
  }

  let match: HealthFact;
  if (!code) {
    match = { label: 'Not checked', tone: 'neutral', detail: 'No version of the code deploys here with this database' };
  } else if (code.ahead) {
    match = {
      label: 'Code ahead',
      tone: 'warning',
      detail: `${short(code.version)} ships migrations up to ${code.newestMigration}, the database has ${
        applied?.lastAppliedVersion ? `up to ${applied.lastAppliedVersion}` : 'none'
      }`,
    };
  } else {
    match = { label: 'Compatible', tone: 'ok', detail: `${short(code.version)} needs nothing newer` };
  }

  return [
    {
      key: 'package',
      title: 'Validated and packaged',
      description: "The service's schema workflow checks migrations/ and atlas.sum, then publishes a package per commit.",
      states: ['Published', 'None yet'],
      fact: pkg,
    },
    {
      key: 'requested',
      title: 'Requested here',
      description: 'A DatabaseSchema in Git names the version; schema-operator finds its package and this database.',
      states: ['Resolved', 'Pending', 'Waiting', 'Not requested'],
      fact: req,
      message: requested?.published === false ? requested.message : undefined,
    },
    {
      key: 'applied',
      title: 'Checked and applied',
      description: 'Atlas replays the migrations on a throwaway Postgres, then applies the new ones to this database.',
      states: ['Applied', 'Migrating', 'Pending', 'Failed', 'Nothing applied'],
      fact: app,
      message: applied?.phase === 'Failed' ? applied.message : undefined,
    },
    {
      key: 'latest',
      title: 'Up to date',
      description: 'The applied version is the newest one the service has published.',
      states: ['Latest', 'Behind', 'Not yet', 'Unknown'],
      fact: up,
    },
    {
      key: 'code',
      title: 'Matches the code',
      description: "The code this environment runs ships no migration the database doesn't have.",
      states: ['Compatible', 'Code ahead', 'Not checked'],
      fact: match,
    },
  ];
}
