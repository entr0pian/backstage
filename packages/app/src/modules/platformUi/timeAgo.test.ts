import { shortVersion, timeAgo } from './index';

describe('timeAgo', () => {
  const now = new Date('2026-09-24T12:00:00Z').getTime();
  it('formats relative times', () => {
    expect(timeAgo('2026-09-24T12:00:00Z', now)).toBe('just now');
    expect(timeAgo('2026-09-24T11:48:00Z', now)).toBe('12m ago');
    expect(timeAgo('2026-09-24T09:00:00Z', now)).toBe('3h ago');
    expect(timeAgo('2026-09-20T12:00:00Z', now)).toBe('4d ago');
  });
  it('returns null for missing or invalid input', () => {
    expect(timeAgo(null, now)).toBeNull();
    expect(timeAgo('not a date', now)).toBeNull();
  });
});

describe('shortVersion', () => {
  it('shortens only full git SHAs', () => {
    expect(shortVersion('6f9fe922f304962cedf1faf400f2f11660e068ee')).toBe('6f9fe92');
    expect(shortVersion('v1.2.3')).toBe('v1.2.3');
    expect(shortVersion('latest')).toBe('latest');
  });
});
