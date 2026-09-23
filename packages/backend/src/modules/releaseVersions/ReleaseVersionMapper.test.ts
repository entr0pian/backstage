import {
  mapReleaseToVersion,
  releaseVersionsForComponent,
} from './ReleaseVersionMapper';

describe('mapReleaseToVersion', () => {
  it('maps a well-formed Release to an environment/version pair', () => {
    const result = mapReleaseToVersion({
      metadata: { name: 'payments-dev', namespace: 'dev' },
      spec: { componentRef: { name: 'payments' }, environment: 'dev', version: 'latest' },
    });
    expect('error' in result).toBe(false);
    expect(result).toEqual({ environment: 'dev', version: 'latest' });
  });

  it('displays version exactly as configured, never resolving "latest"', () => {
    const result = mapReleaseToVersion({
      metadata: { name: 'payments-prod', namespace: 'prod' },
      spec: { componentRef: { name: 'payments' }, environment: 'prod', version: 'v1.2.3' },
    });
    expect(result).toEqual({ environment: 'prod', version: 'v1.2.3' });
  });

  it('errors when spec.componentRef.name is missing', () => {
    const result = mapReleaseToVersion({
      metadata: { name: 'orphan', namespace: 'dev' },
      spec: { environment: 'dev', version: 'latest' },
    });
    expect('error' in result).toBe(true);
  });

  it('errors when spec.environment is missing', () => {
    const result = mapReleaseToVersion({
      metadata: { name: 'payments-x', namespace: 'dev' },
      spec: { componentRef: { name: 'payments' }, version: 'latest' },
    });
    expect('error' in result).toBe(true);
  });

  it('errors when metadata.name or metadata.namespace is missing', () => {
    expect('error' in mapReleaseToVersion({ metadata: { namespace: 'dev' } })).toBe(true);
    expect('error' in mapReleaseToVersion({ metadata: { name: 'x' } })).toBe(true);
  });

  it('defaults an absent spec.version to an empty string rather than erroring', () => {
    const result = mapReleaseToVersion({
      metadata: { name: 'payments-dev', namespace: 'dev' },
      spec: { componentRef: { name: 'payments' }, environment: 'dev' },
    });
    expect(result).toEqual({ environment: 'dev', version: '' });
  });
});

describe('releaseVersionsForComponent', () => {
  const releases = [
    {
      metadata: { name: 'payments-dev', namespace: 'dev' },
      spec: { componentRef: { name: 'payments' }, environment: 'dev', version: 'latest' },
    },
    {
      metadata: { name: 'payments-prod', namespace: 'prod' },
      spec: { componentRef: { name: 'payments' }, environment: 'prod', version: 'v1.2.3' },
    },
    {
      metadata: { name: 'checkout-dev', namespace: 'dev' },
      spec: { componentRef: { name: 'checkout' }, environment: 'dev', version: 'latest' },
    },
  ];

  it('returns every environment for the requested component, independently', () => {
    const result = releaseVersionsForComponent(releases, 'payments');
    expect(result).toEqual([
      { environment: 'dev', version: 'latest' },
      { environment: 'prod', version: 'v1.2.3' },
    ]);
  });

  it('never returns a Release belonging to a different component', () => {
    const result = releaseVersionsForComponent(releases, 'payments');
    expect(result.some(r => r.environment === 'dev' && r.version !== 'latest')).toBe(false);
    expect(releaseVersionsForComponent(releases, 'checkout')).toEqual([
      { environment: 'dev', version: 'latest' },
    ]);
  });

  it('returns an empty list, not an error, for a component with no Releases', () => {
    expect(releaseVersionsForComponent(releases, 'nonexistent')).toEqual([]);
  });

  it('sorts by environment', () => {
    const unsorted = [
      {
        metadata: { name: 'a', namespace: 'prod' },
        spec: { componentRef: { name: 'x' }, environment: 'prod', version: '1' },
      },
      {
        metadata: { name: 'b', namespace: 'dev' },
        spec: { componentRef: { name: 'x' }, environment: 'dev', version: '1' },
      },
    ];
    const result = releaseVersionsForComponent(unsorted, 'x');
    expect(result.map(r => r.environment)).toEqual(['dev', 'prod']);
  });

  it('drops a malformed Release instead of crashing the whole list', () => {
    const withMalformed = [
      ...releases,
      { metadata: { name: 'broken', namespace: 'dev' }, spec: { componentRef: { name: 'payments' } } },
    ];
    const onError = jest.fn();
    const result = releaseVersionsForComponent(withMalformed, 'payments', onError);
    expect(result).toEqual([
      { environment: 'dev', version: 'latest' },
      { environment: 'prod', version: 'v1.2.3' },
    ]);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
