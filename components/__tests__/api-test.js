import { normalizeRankings } from '../api';
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

describe('safeJsonParse', () => {
  it('returns fallback for malformed json', () => {
    expect(safeJsonParse('{bad', { ok: false })).toEqual({ ok: false });
  });

  it('parses valid json', () => {
    expect(safeJsonParse('{"ok":true}', { ok: false })).toEqual({ ok: true });
  });
});
