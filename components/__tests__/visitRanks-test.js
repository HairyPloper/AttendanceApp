import { getVisitRank } from '../visitRanks';

describe('visit rank themes', () => {
  it.each([
    [0, 'Stranac', 0],
    [1, 'Srednjoškolac', 1],
    [4, 'Srednjoškolac', 1],
    [5, 'Gaijin', 2],
    [10, 'Street Racer', 3],
    [25, 'Challenger', 4],
    [50, 'Han', 5],
    [100, 'D.K. (Legend)', 6],
    [250, 'D.K. (Legend)', 6],
  ])('maps %i visits to %s', (visits, label, tier) => {
    expect(getVisitRank(visits)).toMatchObject({ label, tier });
  });

  it('keeps invalid totals on the neutral frame', () => {
    expect(getVisitRank(Number.NaN)).toMatchObject({ label: 'Stranac', tier: 0 });
    expect(getVisitRank(-10)).toMatchObject({ label: 'Stranac', tier: 0 });
  });
});
