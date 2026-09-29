import { serviceOverviewUrl } from './grafana';
import {
  formatLatency,
  formatPercent,
  formatRate,
  healthReason,
  metricsHealth,
  type ObservabilitySummary,
} from './summary';

const base: ObservabilitySummary = {
  component: 'payments',
  environment: 'management',
  requestRate: 1,
  errorRatePercent: 0,
  p95LatencySeconds: 0.01,
  cpuUtilizationPercent: 10,
  memoryUtilizationPercent: 10,
  replicas: { available: 1, desired: 1 },
  restarts1h: 0,
  unavailable: [],
  generatedAt: '2026-09-29T12:00:00Z',
  rateWindow: '2m',
  series: {
    stepSeconds: 30,
    points: {
      requestRate: [],
      errorRatePercent: [],
      p95LatencySeconds: [],
      cpuUtilizationPercent: [],
      memoryUtilizationPercent: [],
    },
  },
};

describe('metricsHealth', () => {
  it('is derived from replicas and error rate only', () => {
    expect(metricsHealth(base)).toBe('healthy');
    expect(metricsHealth({ ...base, errorRatePercent: null })).toBe('healthy');
    expect(metricsHealth({ ...base, errorRatePercent: 5 })).toBe('degraded');
    expect(metricsHealth({ ...base, replicas: { available: 0, desired: 1 } })).toBe('degraded');
    expect(metricsHealth({ ...base, replicas: { available: 0, desired: 0 } })).toBe('scaled-to-zero');
    expect(metricsHealth({ ...base, replicas: null })).toBe('no-data');
  });
});

describe('healthReason', () => {
  it('says why the status is what it is', () => {
    expect(healthReason(base)).toBe('1 of 1 replicas available, 0% 5xx over 2m.');
    expect(healthReason({ ...base, errorRatePercent: null })).toBe('1 of 1 replicas available, no traffic in the last 2m.');
    expect(healthReason({ ...base, replicas: null })).toBe('No platform Deployment found in this environment.');
    expect(healthReason({ ...base, replicas: { available: 0, desired: 0 } })).toBe('The Deployment is scaled to 0 replicas.');
  });
});

describe('formatters', () => {
  it('render null as no data and keep 0 as 0', () => {
    expect(formatRate(null)).toBe('—');
    expect(formatRate(0)).toBe('0 req/s');
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(0)).toBe('0%');
    expect(formatLatency(null)).toBe('—');
    expect(formatLatency(0.042)).toBe('42 ms');
    expect(formatLatency(0.00475)).toBe('4.8 ms');
    expect(formatLatency(1.5)).toBe('1.5 s');
  });
});

describe('serviceOverviewUrl', () => {
  it('URL-encodes component and environment', () => {
    expect(serviceOverviewUrl('https://grafana.gerodimos.dev', 'a&b', 'x y')).toBe(
      'https://grafana.gerodimos.dev/d/platform-service-overview?var-component=a%26b&var-environment=x+y',
    );
  });

  it('is null without a Grafana URL', () => {
    expect(serviceOverviewUrl(undefined, 'payments', 'management')).toBeNull();
  });
});
