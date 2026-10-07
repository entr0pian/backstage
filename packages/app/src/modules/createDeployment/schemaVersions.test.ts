import { schemaVersionOptions, type SchemaVersion } from './schemaVersions';

const v = (n: number): SchemaVersion => ({
  sha: String(n).repeat(40).slice(0, 40),
  shortSha: String(n).repeat(7),
  message: `migration ${n}`,
  author: 'a',
  createdAt: '',
});

describe('schemaVersionOptions', () => {
  const versions = [v(3), v(2), v(1)]; // newest first

  it('offers only versions newer than the current one', () => {
    expect(schemaVersionOptions(versions, v(2).sha).map(o => [o.version.message, o.label, o.selectable])).toEqual([
      ['migration 3', null, true],
      ['migration 2', 'current', false],
      ['migration 1', 'older', false],
    ]);
  });

  it('offers everything when the environment has no schema yet', () => {
    expect(schemaVersionOptions(versions, null).every(o => o.selectable)).toBe(true);
  });

  it('offers everything listed when the current version is older than the list', () => {
    expect(schemaVersionOptions(versions, '9'.repeat(40)).every(o => o.selectable)).toBe(true);
  });

  it('offers nothing when the newest version is already applied', () => {
    expect(schemaVersionOptions(versions, v(3).sha).some(o => o.selectable)).toBe(false);
  });
});
