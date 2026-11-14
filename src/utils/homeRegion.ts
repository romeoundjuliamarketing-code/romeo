import { DACH_REGIONS, type RegionPolygons } from '../data/dachRegions';

// Home region (country + ISO 3166-2 state/canton) for the internal community
// statistic. Derived fully OFFLINE from bundled boundaries: the coordinate never
// leaves the device for this, only the resulting codes are stored.

export type HomeCountry = 'DE' | 'AT' | 'CH';

export interface HomeRegion {
  country: HomeCountry;
  region:  string;
}

// Same whitelist as public.home_region_valid on the server.
export const HOME_REGIONS: Readonly<Record<HomeCountry, readonly string[]>> = {
  DE: ['DE-BW', 'DE-BY', 'DE-BE', 'DE-BB', 'DE-HB', 'DE-HH', 'DE-HE', 'DE-MV',
    'DE-NI', 'DE-NW', 'DE-RP', 'DE-SL', 'DE-SN', 'DE-ST', 'DE-SH', 'DE-TH'],
  AT: ['AT-1', 'AT-2', 'AT-3', 'AT-4', 'AT-5', 'AT-6', 'AT-7', 'AT-8', 'AT-9'],
  CH: ['CH-AG', 'CH-AI', 'CH-AR', 'CH-BE', 'CH-BL', 'CH-BS', 'CH-FR', 'CH-GE',
    'CH-GL', 'CH-GR', 'CH-JU', 'CH-LU', 'CH-NE', 'CH-NW', 'CH-OW', 'CH-SG',
    'CH-SH', 'CH-SO', 'CH-SZ', 'CH-TG', 'CH-TI', 'CH-UR', 'CH-VD', 'CH-VS',
    'CH-ZG', 'CH-ZH'],
};

export const HOME_COUNTRIES: readonly HomeCountry[] = ['DE', 'AT', 'CH'];

export function isHomeCountry(value: unknown): value is HomeCountry {
  return value === 'DE' || value === 'AT' || value === 'CH';
}

export function isValidHomeRegion(country: unknown, region: unknown): boolean {
  return isHomeCountry(country) && typeof region === 'string' && HOME_REGIONS[country].includes(region);
}

// Points just outside the simplified outline (coast, border rivers) still count
// for the nearest region up to this distance.
const SNAP_KM = 3;
const KM_PER_DEG_LAT = 111.32;

interface Indexed {
  code:  string;
  polys: RegionPolygons;
  // Bounding box in 1/1000 degree: minLng, minLat, maxLng, maxLat.
  box:   [number, number, number, number];
}

let index: Indexed[] | null = null;

function getIndex(): Indexed[] {
  if (index !== null) return index;
  index = DACH_REGIONS.map(([code, polys]) => {
    const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const poly of polys) {
      const outer = poly[0];
      for (let i = 0; i < outer.length; i += 2) {
        box[0] = Math.min(box[0], outer[i]);
        box[1] = Math.min(box[1], outer[i + 1]);
        box[2] = Math.max(box[2], outer[i]);
        box[3] = Math.max(box[3], outer[i + 1]);
      }
    }
    return { code, polys, box };
  });
  return index;
}

// Ray casting on a flat [x, y, x, y, ...] ring.
function inRing(ring: number[], x: number, y: number): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygons(polys: RegionPolygons, x: number, y: number): boolean {
  for (const rings of polys) {
    if (!inRing(rings[0], x, y)) continue;
    let inHole = false;
    for (let h = 1; h < rings.length; h += 1) {
      if (inRing(rings[h], x, y)) { inHole = true; break; }
    }
    if (!inHole) return true;
  }
  return false;
}

// Squared distance in km² from (x, y) to the outline, local flat projection.
function distSqKm(polys: RegionPolygons, x: number, y: number, kx: number, ky: number): number {
  let best = Infinity;
  for (const rings of polys) {
    for (const ring of rings) {
      const n = ring.length;
      for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
        const ax = (ring[j] - x) * kx, ay = (ring[j + 1] - y) * ky;
        const bx = (ring[i] - x) * kx, by = (ring[i + 1] - y) * ky;
        const dx = bx - ax, dy = by - ay;
        const len = dx * dx + dy * dy;
        const t = len === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len));
        const px = ax + t * dx, py = ay + t * dy;
        best = Math.min(best, px * px + py * py);
      }
    }
  }
  return best;
}

function toResult(code: string): HomeRegion {
  return { country: code.slice(0, 2) as HomeCountry, region: code };
}

/**
 * State/canton for a point in Germany, Austria or Switzerland, or 'outside'
 * for everything else (other countries, sea, invalid input).
 */
export function regionForPoint(lat: number, lng: number): HomeRegion | 'outside' {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'outside';
  const x = lng * 1000, y = lat * 1000;
  const regions = getIndex();

  for (const r of regions) {
    if (x < r.box[0] || x > r.box[2] || y < r.box[1] || y > r.box[3]) continue;
    if (inPolygons(r.polys, x, y)) return toResult(r.code);
  }

  // Not inside any outline: snap to the nearest region within SNAP_KM.
  const ky = KM_PER_DEG_LAT / 1000;
  const kx = (KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)) / 1000;
  const padX = SNAP_KM / kx, padY = SNAP_KM / ky;
  let bestCode: string | null = null;
  let bestDist = SNAP_KM * SNAP_KM;
  for (const r of regions) {
    if (x < r.box[0] - padX || x > r.box[2] + padX || y < r.box[1] - padY || y > r.box[3] + padY) continue;
    const d = distSqKm(r.polys, x, y, kx, ky);
    if (d <= bestDist) { bestDist = d; bestCode = r.code; }
  }
  return bestCode !== null ? toResult(bestCode) : 'outside';
}
