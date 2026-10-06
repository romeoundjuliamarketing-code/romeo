// Shared search rules for "upcoming sparrings around a search location".
// Home count, map and list all go through these functions, so the three can
// never disagree on what counts as a hit. Pure: no network, no location access.
import { haversineKm } from './geoUtils';
import type { GeoPoint } from './mapStartRegion';
import i18n from '../i18n';
import { parseLanguage } from './language';

export const HOME_RADIUS_KM = 30;
export const RADIUS_OPTIONS_KM = [10, 30, 50, 100] as const;

// Search radius in km, or null for "Überall": no radius cut, the whole DACH area.
export type SearchRadius = number | null;

// Germany, Austria and Switzerland with a small margin. The "Überall" search reads
// this box instead of a circle.
export const DACH_BOX: BoundingBox = { minLat: 45.7, maxLat: 55.2, minLng: 5.8, maxLng: 17.3 };

// A gesture has to show clearly more than the current circle before the radius grows.
// The fitted search view itself is a bit larger than the circle (see regionAround), so
// a small pinch after a search must not already count as zooming out.
const WIDEN_TOLERANCE = 1.5;

export function radiusLabel(radius: SearchRadius): string {
  return radius === null ? i18n.t('sparring.search.everywhere') : `${radius} km`;
}

// Next step for "Umkreis erweitern": the next option, after the largest one
// "Überall". undefined when there is nothing wider.
export function widerRadius(radius: SearchRadius): SearchRadius | undefined {
  if (radius === null) return undefined;
  return RADIUS_OPTIONS_KM.find((km) => km > radius) ?? null;
}

// Radius that matches a map the user zoomed out to. visibleRadiusKm is half of the
// shorter visible side. Zooming out past the circle picks the smallest option that
// covers the view, beyond the largest one "Überall". Zooming in never narrows the
// radius, so hits do not vanish while looking closer.
export function radiusForZoom(current: SearchRadius, visibleRadiusKm: number): SearchRadius {
  if (current === null || visibleRadiusKm <= current * WIDEN_TOLERANCE) return current;
  return RADIUS_OPTIONS_KM.find((km) => km >= visibleRadiusKm) ?? null;
}

// Half of the shorter side of a visible map region, in km.
export function visibleRadiusKm(region: {
  latitude: number; latitudeDelta: number; longitudeDelta: number;
}): number {
  const cosLat = Math.max(0.01, Math.cos((region.latitude * Math.PI) / 180));
  const heightKm = region.latitudeDelta * KM_PER_DEG_LAT;
  const widthKm  = region.longitudeDelta * KM_PER_DEG_LAT * cosLat;
  return Math.min(heightKm, widthKm) / 2;
}

const KM_PER_DEG_LAT = 111.32;

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// Square around the center that fully contains the search circle. Used as the
// server-side pre-filter; the exact cut happens in withinRadius().
export function boundingBox(center: GeoPoint, radiusKm: number): BoundingBox {
  const dLat   = radiusKm / KM_PER_DEG_LAT;
  const cosLat = Math.max(0.01, Math.cos((center.lat * Math.PI) / 180));
  const dLng   = Math.min(180, radiusKm / (KM_PER_DEG_LAT * cosLat));
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}

export interface SearchCandidate {
  id: string;
  lat: number | null;
  lng: number | null;
  scheduled_at: string;
}

export type WithDistance<T> = T & { distance_km: number };

// Exact radius cut (none for "Überall") plus sort: nearest first, earlier start on equal distance,
// id as the last tie-breaker so the order is stable. Rows without coordinates
// or already started are dropped — no distance is ever invented.
export function withinRadius<T extends SearchCandidate>(
  rows: T[],
  center: GeoPoint,
  radiusKm: SearchRadius,
  now: Date = new Date(),
): Array<WithDistance<T>> {
  const nowMs = now.getTime();
  const hits: Array<WithDistance<T>> = [];
  for (const row of rows) {
    if (row.lat === null || row.lng === null) continue;
    if (new Date(row.scheduled_at).getTime() < nowMs) continue;
    const distance = haversineKm(center.lat, center.lng, row.lat, row.lng);
    if (radiusKm !== null && distance > radiusKm) continue;
    hits.push({ ...row, distance_km: distance });
  }
  hits.sort((a, b) => {
    const byDistance = roundKm(a.distance_km) - roundKm(b.distance_km);
    if (byDistance !== 0) return byDistance;
    const byStart = new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
    if (byStart !== 0) return byStart;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return hits;
}

// Distances are shown with one decimal, so "equal distance" means equal as shown.
function roundKm(km: number): number {
  return Math.round(km * 10);
}

// "4,2 km" — straight-line distance, German decimal comma.
export function formatDistanceKm(km: number): string {
  if (km < 10) {
    const text = km.toFixed(1);
    return `${parseLanguage(i18n.language) === 'en' ? text : text.replace('.', ',')} km`;
  }
  return `${Math.round(km)} km`;
}
