// Each environment gets its own colour, used for its card's accent bar and
// badge on every per-environment tab (Deployments, Dependencies, Metrics),
// so "dev" looks the same wherever it appears. Known names are fixed; any
// other environment picks a stable colour from its name.
export interface EnvironmentAccent {
  from: string;
  to: string;
}

const KNOWN: Record<string, EnvironmentAccent> = {
  management: { from: '#6366f1', to: '#8b5cf6' },
  dev: { from: '#06b6d4', to: '#3b82f6' },
  development: { from: '#06b6d4', to: '#3b82f6' },
  staging: { from: '#f59e0b', to: '#f97316' },
  prod: { from: '#f43f5e', to: '#ec4899' },
  production: { from: '#f43f5e', to: '#ec4899' },
};

const OTHERS: EnvironmentAccent[] = [
  { from: '#10b981', to: '#14b8a6' },
  { from: '#a855f7', to: '#d946ef' },
  { from: '#84cc16', to: '#22c55e' },
  { from: '#0ea5e9', to: '#6366f1' },
];

export function environmentAccent(environment: string): EnvironmentAccent {
  const known = KNOWN[environment.toLowerCase()];
  if (known) {
    return known;
  }
  const hash = [...environment].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return OTHERS[hash % OTHERS.length];
}

export const accentGradient = ({ from, to }: EnvironmentAccent, angle = 135) =>
  `linear-gradient(${angle}deg, ${from}, ${to})`;
