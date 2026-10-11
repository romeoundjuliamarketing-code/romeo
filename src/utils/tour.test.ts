import {
  missingProfileItems, visibleHoles, pickTourSparring, resumeStation, tourStationAt, unionRect,
} from './tour';

const now = new Date('2026-10-11T10:00:00Z');
const s = (id: string, over: Partial<{ scheduled_at: string; is_active: boolean; max_slots: number; signup_count: number }> = {}) => ({
  id, scheduled_at: '2026-10-12T18:00:00Z', is_active: true, max_slots: 4, signup_count: 1, ...over,
});

describe('pickTourSparring', () => {
  it('takes the first upcoming, active sparring with a free slot', () => {
    const list = [
      s('past', { scheduled_at: '2026-10-10T18:00:00Z' }),
      s('full', { signup_count: 4 }),
      s('off', { is_active: false }),
      s('ok'),
      s('later'),
    ];
    expect(pickTourSparring(list, now)?.id).toBe('ok');
  });

  it('returns null without a fitting one', () => {
    expect(pickTourSparring([s('full', { signup_count: 4 })], now)).toBeNull();
    expect(pickTourSparring([], now)).toBeNull();
  });
});

describe('stations', () => {
  it('clamps indexes', () => {
    expect(tourStationAt(0)).toBe('profile');
    expect(tourStationAt(3)).toBe('detail');
    expect(tourStationAt(9)).toBe('detail');
  });

  it('resumes before the detail station', () => {
    expect(resumeStation(null)).toBe(0);
    expect(resumeStation(1)).toBe(1);
    expect(resumeStation(3)).toBe(2);
  });
});

describe('unionRect', () => {
  it('spans all rects', () => {
    expect(unionRect([{ x: 10, y: 10, width: 10, height: 10 }, { x: 0, y: 50, width: 5, height: 5 }]))
      .toEqual({ x: 0, y: 10, width: 20, height: 45 });
    expect(unionRect([])).toBeNull();
  });
});

describe('missingProfileItems', () => {
  it('lists only what is missing', () => {
    expect(missingProfileItems({ avatar_url: null, disciplines: [] })).toEqual(['photo', 'disciplines']);
    expect(missingProfileItems({ avatar_url: 'a.jpg', disciplines: ['Boxen'] })).toEqual([]);
    expect(missingProfileItems(null)).toEqual([]);
  });
});

describe('visibleHoles', () => {
  const r = (y: number, height: number) => ({ x: 16, y, width: 300, height });
  const region = { top: 100, bottom: 500 };

  it('cuts elements to the free area between progress row and coach group', () => {
    expect(visibleHoles([r(0, 300), r(450, 200)], region)).toEqual([r(100, 200), r(450, 50)]);
  });

  it('drops elements hidden behind the coach group', () => {
    expect(visibleHoles([r(600, 60)], region)).toEqual([]);
  });
});
