import {
  buildCombinedRanking,
  calculateTotalTime,
  getMilestone,
  msToTimeStr,
} from '../attendanceUtils';

describe('attendance utilities', () => {
  it('formats elapsed visit time', () => {
    expect(calculateTotalTime('2026-01-01T10:00:00Z', '2026-01-01T11:01:01Z')).toBe('1h 1m 1s');
    expect(calculateTotalTime('2026-01-01T10:00:00Z', null)).toBe('Aktivna Sesija');
    expect(calculateTotalTime('2026-01-01T11:00:00Z', '2026-01-01T10:00:00Z')).toBe('0s');
  });

  it('calculates milestone progress', () => {
    const milestones = [
      { limit: 1, label: 'Start', img: 'a', sub: '' },
      { limit: 10, label: 'Next', img: 'b', sub: '' },
    ];

    expect(getMilestone(5, milestones)).toEqual({
      current: milestones[0],
      next: milestones[1],
      progress: 0.5,
    });
  });

  it('combines user and host location rankings', () => {
    const combined = buildCombinedRanking(
      {
        userRanking: [
          { name: 'Ana', total: 2, totalMs: 2000, timeStr: '0h 0m 2s' },
          { name: 'Bob', total: 1, totalMs: 1000, timeStr: '0h 0m 1s' },
        ],
        locationRanking: [{ name: 'HOUSE', total: 3, totalMs: 3000, timeStr: '0h 0m 3s' }],
      },
      [{ user: 'Ana', location: 'HOUSE' }]
    );

    expect(combined[0]).toMatchObject({
      name: 'Ana',
      location: 'HOUSE',
      total: 5,
      totalMs: 5000,
      timeStr: msToTimeStr(5000),
    });
    expect(combined[1]).toMatchObject({ name: 'Bob', location: null });
  });
});
