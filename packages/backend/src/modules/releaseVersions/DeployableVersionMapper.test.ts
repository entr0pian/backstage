import { mapWorkflowRuns, parseProjectSlug } from './DeployableVersionMapper';

const SHA_A = 'ff5987e8395c2fc8f52f3cd078416830244b5019';
const SHA_B = '3a91c02d4e5f60718293a4b5c6d7e8f901234567';

describe('parseProjectSlug', () => {
  it('splits owner/repo', () => {
    expect(parseProjectSlug('entr0pian/payments')).toEqual({ owner: 'entr0pian', repo: 'payments' });
  });

  it('rejects a missing or malformed slug', () => {
    expect(parseProjectSlug(undefined)).toBeUndefined();
    expect(parseProjectSlug('payments')).toBeUndefined();
    expect(parseProjectSlug('a/b/c')).toBeUndefined();
  });
});

describe('mapWorkflowRuns', () => {
  it('maps a run to its full SHA, short SHA, first message line, author and time', () => {
    expect(
      mapWorkflowRuns([
        {
          head_sha: SHA_A,
          created_at: '2026-09-26T10:00:00Z',
          head_commit: { message: 'Add health endpoint\n\nLonger body', author: { name: 'Alice' } },
        },
      ]),
    ).toEqual([
      {
        sha: SHA_A,
        shortSha: 'ff5987e',
        message: 'Add health endpoint',
        author: 'Alice',
        createdAt: '2026-09-26T10:00:00Z',
      },
    ]);
  });

  it('keeps only the newest run per commit, preserving newest-first order', () => {
    const versions = mapWorkflowRuns([
      { head_sha: SHA_B, created_at: '2026-09-26T12:00:00Z' },
      { head_sha: SHA_A, created_at: '2026-09-26T11:00:00Z' },
      { head_sha: SHA_B, created_at: '2026-09-26T09:00:00Z' },
    ]);
    expect(versions.map(v => [v.sha, v.createdAt])).toEqual([
      [SHA_B, '2026-09-26T12:00:00Z'],
      [SHA_A, '2026-09-26T11:00:00Z'],
    ]);
  });

  it('falls back to the run actor when the commit has no author, and skips runs without a SHA', () => {
    const versions = mapWorkflowRuns([
      { head_sha: SHA_A, head_commit: null, actor: { login: 'bob' } },
      { created_at: '2026-09-26T09:00:00Z' },
    ]);
    expect(versions).toHaveLength(1);
    expect(versions[0].author).toBe('bob');
    expect(versions[0].message).toBe('');
  });
});
