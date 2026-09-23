import { joinDeployments } from './joinDeployments';

describe('joinDeployments', () => {
  it('joins a Release and an Argo Application by environment', () => {
    const result = joinDeployments(
      [{ environment: 'management', version: 'latest' }],
      [
        {
          metadata: { labels: { 'platform.taskapp.io/environment': 'management' } },
          status: { sync: { status: 'Synced' }, health: { status: 'Healthy' } },
        },
      ],
    );
    expect(result).toEqual([
      { environment: 'management', version: 'latest', syncStatus: 'Synced', healthStatus: 'Healthy' },
    ]);
  });

  it('returns every environment independently for multiple deployments', () => {
    const result = joinDeployments(
      [
        { environment: 'dev', version: 'latest' },
        { environment: 'prod', version: 'v1.2.3' },
      ],
      [
        {
          metadata: { labels: { 'platform.taskapp.io/environment': 'dev' } },
          status: { sync: { status: 'Synced' }, health: { status: 'Healthy' } },
        },
        {
          metadata: { labels: { 'platform.taskapp.io/environment': 'prod' } },
          status: { sync: { status: 'OutOfSync' }, health: { status: 'Degraded' } },
        },
      ],
    );
    expect(result).toEqual([
      { environment: 'dev', version: 'latest', syncStatus: 'Synced', healthStatus: 'Healthy' },
      { environment: 'prod', version: 'v1.2.3', syncStatus: 'OutOfSync', healthStatus: 'Degraded' },
    ]);
  });

  it('surfaces a Release with no matching Argo Application as Unknown, not dropped', () => {
    const result = joinDeployments(
      [{ environment: 'dev', version: 'latest' }],
      [],
    );
    expect(result).toEqual([
      { environment: 'dev', version: 'latest', syncStatus: 'Unknown', healthStatus: 'Unknown' },
    ]);
  });

  it('surfaces an Argo Application with no matching Release as version: null, not dropped', () => {
    const result = joinDeployments(
      [],
      [
        {
          metadata: { labels: { 'platform.taskapp.io/environment': 'dev' } },
          status: { sync: { status: 'Synced' }, health: { status: 'Healthy' } },
        },
      ],
    );
    expect(result).toEqual([
      { environment: 'dev', version: null, syncStatus: 'Synced', healthStatus: 'Healthy' },
    ]);
  });

  it('treats missing sync/health status as Unknown rather than crashing', () => {
    const result = joinDeployments(
      [{ environment: 'dev', version: 'latest' }],
      [{ metadata: { labels: { 'platform.taskapp.io/environment': 'dev' } } }],
    );
    expect(result).toEqual([
      { environment: 'dev', version: 'latest', syncStatus: 'Unknown', healthStatus: 'Unknown' },
    ]);
  });

  it('ignores an Argo Application with no environment label', () => {
    const result = joinDeployments(
      [{ environment: 'dev', version: 'latest' }],
      [{ metadata: { labels: {} }, status: { sync: { status: 'Synced' }, health: { status: 'Healthy' } } }],
    );
    expect(result).toEqual([
      { environment: 'dev', version: 'latest', syncStatus: 'Unknown', healthStatus: 'Unknown' },
    ]);
  });

  it('sorts by environment', () => {
    const result = joinDeployments(
      [
        { environment: 'prod', version: '1' },
        { environment: 'dev', version: '1' },
      ],
      [],
    );
    expect(result.map(d => d.environment)).toEqual(['dev', 'prod']);
  });
});
