import { commitUrl, missingShas, whatChanged, type DeployableVersion } from './whatChanged';

const REPO = 'https://github.com/entr0pian/payments';
const W = 'e692041c498a0d4ee4efad2563667d87af3d1fbc';
const X = 'dd9fc0e4a089f9d8c87140e7dc1f0dc9f4047a5e';

const versions: DeployableVersion[] = [
  { sha: X, shortSha: 'dd9fc0e', message: 'Run three replicas', author: 'entr0pian', createdAt: '2026-10-02T11:48:06Z' },
  { sha: W, shortSha: 'e692041', message: 'initial scaffold: golang-service@0.9.0', author: 'entr0pian', createdAt: '2026-10-02T11:14:35Z' },
];

const prev = (version: string) => ({ revision: 1, version, current: 0, ready: 0 });

describe('whatChanged', () => {
  it('describes the target and the version it replaced, with a compare link', () => {
    const c = whatChanged({ targetVersion: X, previous: prev(W) }, versions, REPO)!;
    expect(c.target).toEqual({
      sha: X,
      shortSha: 'dd9fc0e',
      url: `${REPO}/commit/${X}`,
      message: 'Run three replicas',
      author: 'entr0pian',
      createdAt: '2026-10-02T11:48:06Z',
    });
    expect(c.previous).toMatchObject({ shortSha: 'e692041', message: 'initial scaffold: golang-service@0.9.0' });
    expect(c.configurationOnly).toBe(false);
    expect(c.compareUrl).toBe(`${REPO}/compare/${W}...${X}`);
  });

  it('treats a first deployment as having nothing to compare', () => {
    const c = whatChanged({ targetVersion: X, previous: null }, versions, REPO)!;
    expect(c.previous).toBeNull();
    expect(c.compareUrl).toBeNull();
  });

  it('marks a same-version rollout as a configuration change', () => {
    const c = whatChanged({ targetVersion: X, previous: prev(X) }, versions, REPO)!;
    expect(c).toMatchObject({ configurationOnly: true, previous: null, compareUrl: null });
  });

  it('still links a commit that is older than the versions list', () => {
    const old = 'a'.repeat(40);
    const c = whatChanged({ targetVersion: X, previous: prev(old) }, versions, REPO)!;
    expect(c.previous).toMatchObject({ shortSha: 'aaaaaaa', url: `${REPO}/commit/${old}`, message: null });
    expect(c.compareUrl).toBe(`${REPO}/compare/${old}...${X}`);
  });

  it('shows a non-SHA version as-is, without links', () => {
    const c = whatChanged({ targetVersion: 'latest', previous: prev(W) }, versions, REPO)!;
    expect(c.target).toMatchObject({ shortSha: 'latest', url: null });
    expect(c.compareUrl).toBeNull();
  });

  it('works without a repository, just without links', () => {
    const c = whatChanged({ targetVersion: X, previous: prev(W) }, versions, null)!;
    expect(c.target.url).toBeNull();
    expect(c.compareUrl).toBeNull();
    expect(c.target.message).toBe('Run three replicas');
  });

  it('has nothing to say without a Release', () => {
    expect(whatChanged({ targetVersion: null, previous: null }, versions, REPO)).toBeNull();
  });
});

describe('missingShas', () => {
  it('lists unknown full SHAs once, ignoring known ones and non-SHAs', () => {
    const new1 = 'b'.repeat(40);
    expect(missingShas([X, new1, new1, null, 'latest', W], versions)).toEqual([new1]);
    expect(missingShas([X, W], versions)).toEqual([]);
  });
});

describe('commitUrl', () => {
  it('links a full SHA to its commit, and nothing else', () => {
    expect(commitUrl(REPO, X)).toBe(`${REPO}/commit/${X}`);
    expect(commitUrl(REPO, 'latest')).toBeNull();
    expect(commitUrl(null, X)).toBeNull();
    expect(commitUrl(REPO, null)).toBeNull();
  });
});
