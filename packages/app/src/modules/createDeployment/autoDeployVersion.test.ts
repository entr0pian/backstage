import { autoDeployVersion } from './autoDeployVersion';

describe('autoDeployVersion', () => {
  it('keeps the committed version', () => {
    const sha = '9f48bf49efe8dec2d6c7cd83f85815f6f9223aec';
    expect(autoDeployVersion(sha)).toBe(sha);
  });

  it('writes none before the first build, or if what is committed is not a commit', () => {
    expect(autoDeployVersion(null)).toBeUndefined();
    expect(autoDeployVersion('1.0.0')).toBeUndefined();
  });
});
