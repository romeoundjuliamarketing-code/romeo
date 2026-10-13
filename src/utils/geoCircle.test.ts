import { circlePolygon, circleRing } from './geoCircle';
import { haversineKm } from './geoUtils';

const BREMEN = { lat: 53.08, lng: 8.80 };

describe('circleRing', () => {
  it('puts every point at the radius from the center', () => {
    for (const [lng, lat] of circleRing(BREMEN, 150)) {
      expect(haversineKm(BREMEN.lat, BREMEN.lng, lat, lng)).toBeCloseTo(150, 0);
    }
  });

  it('is closed and has steps + 1 points', () => {
    const ring = circleRing(BREMEN, 300, 32);
    expect(ring).toHaveLength(33);
    expect(ring[32]).toEqual(ring[0]);
  });

  it('starts due north of the center', () => {
    const [lng, lat] = circleRing(BREMEN, 100)[0];
    expect(lng).toBeCloseTo(BREMEN.lng, 6);
    expect(lat).toBeGreaterThan(BREMEN.lat);
  });
});

describe('circlePolygon', () => {
  it('wraps the ring in a GeoJSON polygon feature', () => {
    const f = circlePolygon(BREMEN, 150);
    expect(f.type).toBe('Feature');
    expect(f.geometry.type).toBe('Polygon');
    expect(f.geometry.coordinates).toHaveLength(1);
  });
});
