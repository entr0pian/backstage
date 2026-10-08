import { LatestSchemaVersion } from './LatestSchemaVersion';

const SHA_NEW = 'a'.repeat(40);
const SHA_OLD = 'b'.repeat(40);

describe('LatestSchemaVersion', () => {
  it('returns the newest version and calls GitHub once per TTL', async () => {
    let now = 0;
    const latest = new LatestSchemaVersion({ ttlMs: 60_000, now: () => now });
    const load = jest.fn().mockResolvedValue([
      { sha: SHA_NEW, createdAt: '2026-10-08T10:00:00Z' },
      { sha: SHA_OLD, createdAt: '2026-10-07T10:00:00Z' },
    ]);

    expect(await latest.get('orders', load)).toEqual({ version: SHA_NEW, createdAt: '2026-10-08T10:00:00Z' });
    now = 59_000;
    await latest.get('orders', load);
    expect(load).toHaveBeenCalledTimes(1);
    now = 60_000;
    await latest.get('orders', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('is null with no published schema, an unknown component, or a failing GitHub', async () => {
    const latest = new LatestSchemaVersion();
    expect(await latest.get('a', async () => [])).toBeNull();
    expect(await latest.get('b', async () => null)).toBeNull();
    expect(await latest.get('c', async () => Promise.reject(new Error('503')))).toBeNull();
  });
});
