// Initial map viewport for the sparring map. Pure: no location or storage
// access here — the hook (useMapStartRegion) gathers the inputs.
import { haversineKm } from './geoUtils';

export interface MapRegion {
  latitude:       number;
  longitude:      number;
  latitudeDelta:  number;
  longitudeDelta: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface StartRegionInput {
  /** Device position (only when location permission is already granted). */
  user:     GeoPoint | null;
  /** Fallback anchor without a position, e.g. the user's own studio. */
  home:     GeoPoint | null;
  /** Search radius in km (the proximity radius from the settings). */
  radiusKm: number;
  /** Marker positions (open sparrings with coordinates). */
  points:   GeoPoint[];
}

// Germany overview: only used when there is neither a position nor any marker.
export const OVERVIEW_REGION: MapRegion = {
  latitude:       51.2,
  longitude:      10.4,
  latitudeDelta:  9,
  longitudeDelta: 9,
};

const KM_PER_DEG_LAT  = 111;
const MIN_RADIUS_KM   = 5;
const MAX_RADIUS_KM   = 150;
// No hit inside the radius: widen up to the nearest one, but not beyond this.
const MAX_EXPAND_KM   = 250;
// Without an anchor, all markers are framed only if they fit into this span.
const MAX_FIT_SPAN_DEG = 4;
const CLUSTER_KM       = 50;
// Margin so markers do not sit under the header or the bottom controls.
const PADDING_FACTOR   = 1.3;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// Region showing a circle of `radiusKm` around `center`.
export function regionAround(center: GeoPoint, radiusKm: number): MapRegion {
  const latDelta = ((2 * radiusKm) / KM_PER_DEG_LAT) * PADDING_FACTOR;
  const cosLat   = Math.max(0.2, Math.cos((center.lat * Math.PI) / 180));
  return {
    latitude:       center.lat,
    longitude:      center.lng,
    latitudeDelta:  latDelta,
    longitudeDelta: latDelta / cosLat,
  };
}

function regionForBounds(points: GeoPoint[]): MapRegion {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  // At least ~30 km across, so a single marker is not shown at street level.
  const minSpan = (2 * 15) / KM_PER_DEG_LAT;
  return {
    latitude:       (minLat + maxLat) / 2,
    longitude:      (minLng + maxLng) / 2,
    latitudeDelta:  Math.max(minSpan, (maxLat - minLat) * PADDING_FACTOR),
    longitudeDelta: Math.max(minSpan, (maxLng - minLng) * PADDING_FACTOR),
  };
}

// Point with the most neighbours within CLUSTER_KM (first one wins on a tie).
function densestPoint(points: GeoPoint[]): GeoPoint {
  let best = points[0];
  let bestCount = -1;
  for (const p of points) {
    let count = 0;
    for (const q of points) {
      if (haversineKm(p.lat, p.lng, q.lat, q.lng) <= CLUSTER_KM) count += 1;
    }
    if (count > bestCount) {
      best = p;
      bestCount = count;
    }
  }
  return best;
}

export function computeStartRegion(input: StartRegionInput): MapRegion {
  const radiusKm = clamp(input.radiusKm, MIN_RADIUS_KM, MAX_RADIUS_KM);
  const anchor   = input.user ?? input.home;

  if (anchor !== null) {
    if (input.points.length === 0) return regionAround(anchor, radiusKm);
    const nearestKm = Math.min(
      ...input.points.map((p) => haversineKm(anchor.lat, anchor.lng, p.lat, p.lng)),
    );
    if (nearestKm <= radiusKm) return regionAround(anchor, radiusKm);
    // Nothing in the radius: widen just enough to show the nearest hit.
    if (nearestKm <= MAX_EXPAND_KM) return regionAround(anchor, nearestKm + MIN_RADIUS_KM);
    return regionAround(anchor, radiusKm);
  }

  if (input.points.length === 0) return OVERVIEW_REGION;

  const bounds = regionForBounds(input.points);
  if (bounds.latitudeDelta <= MAX_FIT_SPAN_DEG && bounds.longitudeDelta <= MAX_FIT_SPAN_DEG) {
    return bounds;
  }
  return regionAround(densestPoint(input.points), CLUSTER_KM);
}
