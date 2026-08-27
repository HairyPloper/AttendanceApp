import { normalizeRankings, parseScanResult } from '../api';
import { safeJsonParse } from '../storageHelper';

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
