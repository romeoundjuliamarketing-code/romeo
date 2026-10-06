import { computeStartRegion, regionAround, OVERVIEW_REGION } from './mapStartRegion';

const BREMEN  = { lat: 53.08, lng: 8.80 };
const HAMBURG = { lat: 53.55, lng: 9.99 };
const MUNICH  = { lat: 48.14, lng: 11.58 };
const COLOGNE = { lat: 50.94, lng: 6.96 };

describe('regionAround', () => {
  it('spans roughly twice the radius plus padding', () => {
    const r = regionAround(BREMEN, 30);
    expect(r.latitude).toBe(BREMEN.lat);
    expect(r.latitudeDelta).toBeGreaterThan(60 / 111);
    expect(r.latitudeDelta).toBeLessThan(1);
    // Longitude degrees are shorter in the north, so the delta is wider.
    expect(r.longitudeDelta).toBeGreaterThan(r.latitudeDelta);
  });
});

describe('computeStartRegion', () => {
  it('centers on the user with the search radius when hits are nearby', () => {
    const r = computeStartRegion({ user: BREMEN, home: null, radiusKm: 30, points: [{ lat: 53.1, lng: 8.85 }] });
    expect(r).toEqual(regionAround(BREMEN, 30));
  });

  it('keeps the search radius when there are no markers at all', () => {
    const r = computeStartRegion({ user: BREMEN, home: null, radiusKm: 30, points: [] });
    expect(r).toEqual(regionAround(BREMEN, 30));
  });

  it('widens to the nearest hit when the radius is empty', () => {
    const r = computeStartRegion({ user: BREMEN, home: null, radiusKm: 30, points: [HAMBURG, MUNICH] });
    const plain = regionAround(BREMEN, 30);
    expect(r.latitude).toBe(BREMEN.lat);
    expect(r.latitudeDelta).toBeGreaterThan(plain.latitudeDelta);
    // Hamburg (~95 km) must fit: half the delta covers the distance.
    expect((r.latitudeDelta / 2) * 111).toBeGreaterThan(95);
    // ...but it does not zoom out to Munich.
    expect(r.latitudeDelta).toBeLessThan(4);
  });

  it('stays on the radius when the nearest hit is very far away', () => {
    const r = computeStartRegion({ user: BREMEN, home: null, radiusKm: 30, points: [MUNICH] });
    expect(r).toEqual(regionAround(BREMEN, 30));
  });

  it('uses the home studio when no position is available', () => {
    const r = computeStartRegion({ user: null, home: COLOGNE, radiusKm: 30, points: [] });
    expect(r).toEqual(regionAround(COLOGNE, 30));
  });

  it('prefers the user position over the home studio', () => {
    const r = computeStartRegion({ user: BREMEN, home: COLOGNE, radiusKm: 30, points: [] });
    expect(r.latitude).toBe(BREMEN.lat);
  });

  it('clamps unusual radius values', () => {
    expect(computeStartRegion({ user: BREMEN, home: null, radiusKm: 0, points: [] }))
      .toEqual(regionAround(BREMEN, 5));
    expect(computeStartRegion({ user: BREMEN, home: null, radiusKm: 5000, points: [] }))
      .toEqual(regionAround(BREMEN, 150));
  });

  it('frames all markers without an anchor when they are close together', () => {
    const r = computeStartRegion({ user: null, home: null, radiusKm: 30, points: [BREMEN, HAMBURG] });
    expect(r.latitude).toBeCloseTo((BREMEN.lat + HAMBURG.lat) / 2);
    expect(r.latitudeDelta).toBeLessThan(2);
  });

  it('focuses the densest cluster when markers are spread across the country', () => {
    const r = computeStartRegion({
      user: null, home: null, radiusKm: 30,
      points: [MUNICH, { lat: 48.15, lng: 11.6 }, { lat: 48.1, lng: 11.5 }, HAMBURG],
    });
    expect(r.latitude).toBeCloseTo(48.14, 1);
    expect(r.latitudeDelta).toBeLessThan(2);
  });

  it('falls back to the overview without position and markers', () => {
    expect(computeStartRegion({ user: null, home: null, radiusKm: 30, points: [] })).toEqual(OVERVIEW_REGION);
  });
});
