import {
  getEventList,
  getLeaderboard,
  getUserData,
  normalizeRankings,
  parseScanResult,
  submitScan,
} from '../api';
import { CACHE_KEYS, invalidateAttendanceCaches, safeJsonParse } from '../storageHelper';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('API read requests', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
    jest.useRealTimers();
  });

  it('shares overlapping reads but allows a new request after completion', async () => {
    let resolve;
    fetchMock.mockReturnValueOnce(new Promise((done) => (resolve = done)));
    const first = getEventList();
    const second = getEventList();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve({ ok: true, json: async () => ['Event A'] });
    expect(await Promise.all([first, second])).toEqual([['Event A'], ['Event A']]);

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ['Event B'] });
    expect(await getEventList()).toEqual(['Event B']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not share private history across different credentials', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    await Promise.all([getUserData('Ana', 'first'), getUserData('Ana', 'second')]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('releases failed requests so a retry can succeed', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(getEventList()).rejects.toThrow('offline');
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] });
    await expect(getEventList()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects backend errors rather than returning cacheable empty results', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ error: 'Unavailable' }) });
    await expect(getEventList()).rejects.toThrow('Invalid event list response');
    await expect(getLeaderboard('Ukupno')).rejects.toThrow('Invalid leaderboard response');
  });

  it('times out stalled response bodies and allows a subsequent retry', async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => new Promise(() => {}) });
    const failure = expect(getEventList()).rejects.toThrow('Request timed out');
    await jest.advanceTimersByTimeAsync(20000);
    await failure;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] });
    await expect(getEventList()).resolves.toEqual([]);
  });

  it('starts a new read after a confirmed scan even if an older read is pending', async () => {
    let resolveOld;
    let resolveNew;
    fetchMock.mockReturnValueOnce(new Promise((done) => (resolveOld = done)));
    const old = getUserData('Ana', 'secret');
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => 'Check-in Success' });
    await submitScan('Ana', 'secret', 'Event A');
    fetchMock.mockReturnValueOnce(new Promise((done) => (resolveNew = done)));
    const fresh = getUserData('Ana', 'secret');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    resolveOld({ ok: true, json: async () => [] });
    await old;
    const sharedFresh = getUserData('Ana', 'secret');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    resolveNew({ ok: true, json: async () => [{ event: 'Event A' }] });
    expect(await Promise.all([fresh, sharedFresh])).toEqual([
      [{ event: 'Event A' }],
      [{ event: 'Event A' }],
    ]);
  });
});

it('rejects backend errors instead of caching them as empty history', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ error: 'Access denied' }),
  });
  try {
    await expect(getUserData('Ana', 'secret')).rejects.toThrow('Invalid history response');
  } finally {
    fetchMock.mockRestore();
  }
});

describe('attendance cache invalidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify({ value: ['Ukupno', 'Event A'], expiry: Date.now() + 60000 })
    );
  });

  it('preserves known locations while clearing history and affected rankings', async () => {
    await invalidateAttendanceCaches('Ana', 'Event A');
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      CACHE_KEYS.history('Ana'),
      CACHE_KEYS.leaderboard('Ukupno'),
      CACHE_KEYS.leaderboard('Event A'),
    ]);
  });

  it('also refreshes locations after scanning a new location', async () => {
    await invalidateAttendanceCaches('Ana', 'Event B');
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(
      expect.arrayContaining([CACHE_KEYS.eventList])
    );
  });
});

describe('api normalization', () => {
  it('normalizes leaderboard payloads defensively', () => {
    expect(
      normalizeRankings({
        userRanking: [{ name: 'Ana', total: '2', totalMs: '3000', timeStr: '3s' }],
        locationRanking: [{ name: 'HOUSE', total: null, totalMs: undefined, timeStr: 10 }],
      })
    ).toEqual({
      userRanking: [{ name: 'Ana', total: 2, totalMs: 3000, timeStr: '3s' }],
      locationRanking: [{ name: 'HOUSE', total: 0, totalMs: 0, timeStr: '10' }],
    });
  });

  it('returns empty rankings for error payloads', () => {
    expect(normalizeRankings({ error: 'nope' })).toEqual({
      userRanking: [],
      locationRanking: [],
    });
  });
});

describe('scan response parsing', () => {
  it('distinguishes check-in and checkout confirmations', () => {
    expect(parseScanResult('Check-in Success')).toEqual({
      status: 'checkin',
      message: 'Check-in Success',
    });
    expect(parseScanResult('Checkout Updated')).toEqual({
      status: 'checkout',
      message: 'Checkout Updated',
    });
  });

  it('treats server errors and empty responses as rejected scans', () => {
    expect(parseScanResult('Error: User not verified')).toEqual({
      status: 'rejected',
      message: 'Error: User not verified',
    });
    expect(parseScanResult('Error: Checkout failed')).toEqual({
      status: 'rejected',
      message: 'Error: Checkout failed',
    });
    expect(parseScanResult('   ')).toEqual({
      status: 'rejected',
      message: 'Server nije potvrdio skeniranje.',
    });
  });
});

describe('safeJsonParse', () => {
  it('returns fallback for malformed json', () => {
    expect(safeJsonParse('{bad', { ok: false })).toEqual({ ok: false });
  });

  it('parses valid json', () => {
    expect(safeJsonParse('{"ok":true}', { ok: false })).toEqual({ ok: true });
  });
});
