import { calculatePoints, POINTS_PER_30MIN } from './points';

describe('calculatePoints', () => {
  it('returns exact points for a full 30-min unit', () => {
    expect(calculatePoints(30, 35)).toBe(35);
  });

  it('scales correctly for 60 minutes', () => {
    expect(calculatePoints(60, 35)).toBe(70);
  });

  it('scales correctly for 90 minutes', () => {
    expect(calculatePoints(90, 30)).toBe(90);
  });

  it('rounds fractional results', () => {
    // 45 min at 35 pts/30min = 52.5 → 53
    expect(calculatePoints(45, 35)).toBe(53);
  });

  it('returns 0 for 0 duration', () => {
    expect(calculatePoints(0, 35)).toBe(0);
  });
});

describe('POINTS_PER_30MIN', () => {
  it('has a value for every defined training type', () => {
    const types = ['K1', 'Boxen', 'BJJ', 'MMA', 'Joggen', 'Sauna'];
    types.forEach((t) => {
      expect(POINTS_PER_30MIN[t]).toBeGreaterThan(0);
    });
  });
});
