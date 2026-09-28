import { isValidScaffoldName, mapScaffoldTags } from './ScaffoldVersionMapper';

describe('isValidScaffoldName', () => {
  it('accepts a scaffold directory name', () => {
    expect(isValidScaffoldName('golang-service')).toBe(true);
  });

  it('rejects anything that could reach outside the tag prefix', () => {
    expect(isValidScaffoldName('')).toBe(false);
    expect(isValidScaffoldName('golang-service/v1')).toBe(false);
    expect(isValidScaffoldName('../x')).toBe(false);
    expect(isValidScaffoldName('Golang')).toBe(false);
  });
});

describe('mapScaffoldTags', () => {
  it('returns the scaffold versions newest first by SemVer, not lexically', () => {
    expect(
      mapScaffoldTags('golang-service', [
        { ref: 'refs/tags/golang-service/v0.9.0' },
        { ref: 'refs/tags/golang-service/v0.10.0' },
        { ref: 'refs/tags/golang-service/v1.0.0' },
        { ref: 'refs/tags/golang-service/v0.9.1' },
      ]),
    ).toEqual(['1.0.0', '0.10.0', '0.9.1', '0.9.0']);
  });

  it("keeps only this scaffold's plain SemVer tags", () => {
    expect(
      mapScaffoldTags('golang-service', [
        { ref: 'refs/tags/golang-service/v0.8.0' },
        { ref: 'refs/tags/golang-service/v0.9.0-rc.1' },
        { ref: 'refs/tags/golang-service-legacy/v5.0.0' },
        { ref: 'refs/tags/nodejs-service/v2.0.0' },
        { ref: 'refs/tags/golang-service/v0.8.0' },
        {},
      ]),
    ).toEqual(['0.8.0']);
  });

  it('returns no versions for a scaffold with no tags', () => {
    expect(mapScaffoldTags('nodejs-service', [])).toEqual([]);
  });
});
