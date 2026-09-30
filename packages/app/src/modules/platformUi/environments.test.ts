import { compareEnvironments } from './environments';

describe('compareEnvironments', () => {
  it('follows the configured order, unknown environments last by name', () => {
    const sorted = ['staging', 'dev', 'prod', 'management', 'alpha'].sort(
      compareEnvironments(['management', 'dev', 'prod']),
    );
    expect(sorted).toEqual(['management', 'dev', 'prod', 'alpha', 'staging']);
  });

  it('falls back to alphabetical with no configured order', () => {
    expect(['prod', 'dev'].sort(compareEnvironments([]))).toEqual(['dev', 'prod']);
  });
});
