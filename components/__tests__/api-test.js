import { getUserData, normalizeRankings, parseScanResult } from '../api';
import { CACHE_KEYS, invalidateAttendanceCaches, safeJsonParse } from '../storageHelper';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
