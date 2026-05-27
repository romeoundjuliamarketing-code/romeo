import { haversineKm } from './geoUtils';

describe('haversineKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineKm(48.137, 11.575, 48.137, 11.575)).toBeCloseTo(0, 5);
  });

  it('Munich to Berlin is approximately 504 km', () => {
    const dist = haversineKm(48.137, 11.575, 52.520, 13.405);
    expect(dist).toBeGreaterThan(500);
    expect(dist).toBeLessThan(510);
  });

  it('1 degree latitude is approximately 111 km', () => {
    const dist = haversineKm(0, 0, 1, 0);
    expect(dist).toBeGreaterThan(110);
    expect(dist).toBeLessThan(112);
  });

  it('is symmetrical — A to B equals B to A', () => {
    const ab = haversineKm(48.137, 11.575, 52.520, 13.405);
    const ba = haversineKm(52.520, 13.405, 48.137, 11.575);
    expect(ab).toBeCloseTo(ba, 10);
  });
});
