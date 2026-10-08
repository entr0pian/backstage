import { act, renderHook } from '@testing-library/react';
import { nextPollMs, useDatabaseDetails, type DatabaseDetails } from './useDatabaseDetails';

const fetchMock = jest.fn();

jest.mock('@backstage/core-plugin-api', () => {
  const discovery = { getBaseUrl: async () => 'http://backend/api/platform' };
  const fetchApi = { fetch: (...args: unknown[]) => fetchMock(...args) };
  return {
    discoveryApiRef: { id: 'discovery' },
    fetchApiRef: { id: 'fetch' },
    useApi: (ref: { id: string }) => (ref.id === 'discovery' ? discovery : fetchApi),
  };
});

const details = (ready: boolean | null) => ({ name: 'payments-db', namespace: 'dev', ready }) as DatabaseDetails;
const ok = (body: unknown) => ({ ok: true, json: async () => body });

// Lets the hook's awaited fetch and JSON parse settle.
const flush = () => act(async () => {});

describe('nextPollMs', () => {
  it('polls often until the database is ready', () => {
    expect(nextPollMs(null)).toBe(10_000);
    expect(nextPollMs(details(false))).toBe(10_000);
    expect(nextPollMs(details(true))).toBe(60_000);
  });
});

describe('useDatabaseDetails', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('picks up a database turning ready without a reload', async () => {
    fetchMock.mockResolvedValueOnce(ok(details(false))).mockResolvedValueOnce(ok(details(true)));
    const { result } = renderHook(() => useDatabaseDetails('dev', 'payments-db'));
    await flush();
    expect(result.current).toMatchObject({ status: 'done', details: { ready: false } });

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    await flush();
    expect(result.current).toMatchObject({ status: 'done', details: { ready: true } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the last answer when a refresh fails', async () => {
    fetchMock.mockResolvedValueOnce(ok(details(false))).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useDatabaseDetails('dev', 'payments-db'));
    await flush();
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    await flush();
    expect(result.current).toMatchObject({ status: 'done', details: { ready: false } });
  });

  it('shows the error when the first load fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });
    const { result } = renderHook(() => useDatabaseDetails('dev', 'payments-db'));
    await flush();
    expect(result.current.status).toBe('error');
  });
});
