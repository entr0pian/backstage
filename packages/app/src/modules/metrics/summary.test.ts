import { serviceOverviewUrl } from './grafana';
import {
  formatLatency,
  formatPercent,
  formatRate,
  formatReplicas,
} from './summary';


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
    expect(formatReplicas({ available: 1, desired: 2 })).toBe('1 / 2 ready');
    expect(formatReplicas(null)).toBe('—');
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
