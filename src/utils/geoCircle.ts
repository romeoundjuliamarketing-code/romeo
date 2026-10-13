// Circle on the map as a closed polygon ring, for map libraries without a native
// circle shape (MapLibre). Pure: no map access.
import type { GeoPoint } from './mapStartRegion';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

// Ring of [lng, lat] points (GeoJSON order) `radiusKm` around `center` on the
// sphere; the first point is repeated at the end to close the ring.
export function circleRing(center: GeoPoint, radiusKm: number, steps = 96): Array<[number, number]> {
  const lat1 = toRad(center.lat);
  const lng1 = toRad(center.lng);
  const d = radiusKm / EARTH_RADIUS_KM;
  const ring: Array<[number, number]> = [];
  for (let i = 0; i < steps; i++) {
    const bearing = (2 * Math.PI * i) / steps;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing));
    const lng2 = lng1 + Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
    ring.push([toDeg(lng2), toDeg(lat2)]);
  }
  ring.push(ring[0]);
  return ring;
}

// GeoJSON polygon feature for the circle.
export function circlePolygon(center: GeoPoint, radiusKm: number): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [circleRing(center, radiusKm)] },
  };
}
