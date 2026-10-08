import type { DatabaseDetails } from '../databases/useDatabaseDetails';
import type { SchemaStatus } from '../deployments/useSchemaStatus';

// The three things worth knowing about a service's database in one
// environment, in words: is it available, does it have the newest schema
// the service has published, and does the service's Release bind it. Pure,
// so the Overview card and the Dependencies tab say exactly the same thing.

export type HealthTone = 'ok' | 'running' | 'pending' | 'warning' | 'error' | 'neutral';

export interface HealthFact {
  label: string;
  // The label under a column that already names the fact (the Overview
  // card's "Schema" column): "Up to date" rather than "Schema up to date".
  short?: string;
  tone: HealthTone;
  // Longer explanation, shown on the Dependencies tab (and as a tooltip on
  // the Overview card).
  detail?: string;
}

const short = (sha: string) => sha.slice(0, 7);

// "Still provisioning: …" / "Waiting for the connection details …" are the
// normal path while a new database comes up; anything else is a failure.
export function availabilityFact(details: Pick<DatabaseDetails, 'ready' | 'problem'>): HealthFact {
  if (details.ready === true) {
    return { label: 'Available', tone: 'ok' };
  }
  if (details.ready === false) {
    const provisioning = !details.problem || /^(Still provisioning|Waiting for the connection details)/.test(details.problem);
    return provisioning
      ? { label: 'Provisioning', tone: 'running', detail: details.problem ?? undefined }
      : { label: 'Not available', tone: 'error', detail: details.problem ?? undefined };
  }
  return { label: 'Status unknown', tone: 'pending' };
}

export function bindingFact(details: Pick<DatabaseDetails, 'boundBy'>, environment: string): HealthFact {
  const binding = details.boundBy.find(b => b.environment === environment);
  return binding
    ? { label: 'Bound', tone: 'ok', detail: `${binding.release} mounts it at ${binding.mountPath}` }
    : { label: 'Not bound', tone: 'neutral', detail: "This environment's Release doesn't bind it yet" };
}

// null: nothing to say about this database's schema (the schema status
// couldn't be read, or the environment's schema targets another database).
// `onlyDatabase`: the service has no other database in this environment, so
// an unresolved schema can only be for this one.
export function schemaFact(schema: SchemaStatus | null, database: string, onlyDatabase: boolean): HealthFact | null {
  if (!schema) {
    return null;
  }
  const { requested, applied, latest } = schema;
  const target = requested?.database ?? null;
  if (target ? target !== database : !onlyDatabase) {
    return null;
  }

  if (!requested && !applied) {
    return latest
      ? {
          label: 'Schema not applied',
          short: 'Not applied',
          tone: 'warning',
          detail: `Schema ${short(latest.version)} is published but not applied here`,
        }
      : { label: 'No schema', short: 'None', tone: 'neutral', detail: 'The service has published no migrations yet' };
  }
  if (applied?.phase === 'Failed') {
    return {
      label: 'Schema failed',
      short: 'Failed',
      tone: 'error',
      detail: applied.commit ? `Applying ${short(applied.commit)} failed` : 'The last migration failed',
    };
  }
  // Asked for a version the database doesn't report as applied yet.
  if (requested && (!applied || applied.phase !== 'Applied' || applied.commit !== requested.version)) {
    if (requested.published === false) {
      return { label: 'Schema waiting', short: 'Waiting', tone: 'pending', detail: requested.reason ?? undefined };
    }
    return { label: 'Schema applying', short: 'Applying', tone: 'running', detail: `Applying ${short(requested.version)}` };
  }
  const commit = applied?.commit ?? null;
  const upTo = applied?.lastAppliedVersion ? `up to ${applied.lastAppliedVersion}` : 'applied';
  if (latest && commit && commit !== latest.version) {
    return {
      label: 'Schema behind latest',
      short: 'Behind latest',
      tone: 'warning',
      detail: `${short(commit)} applied (${upTo}), ${short(latest.version)} is published`,
    };
  }
  return {
    label: latest ? 'Schema up to date' : 'Schema applied',
    short: latest ? 'Up to date' : 'Applied',
    tone: 'ok',
    detail: commit ? `${short(commit)}, ${upTo}` : upTo,
  };
}
