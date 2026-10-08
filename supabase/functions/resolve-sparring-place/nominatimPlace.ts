// Pure normalisation of Nominatim (OpenStreetMap) search results into sparring
// places. Shared by the Edge Function and its Jest test
// (src/utils/nominatimPlace.test.ts). No Deno / React Native imports here.

export interface NominatimAddress {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  square?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
  country?: string;
}

export interface NominatimResult {
  osm_type?: string;
  osm_id?: number | string;
  lat?: string;
  lon?: string;
  category?: string;
  type?: string;
  name?: string;
  address?: NominatimAddress;
}

export interface NormalizedPlace {
  osm_type: 'node' | 'way' | 'relation';
  osm_id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  // 'address' = plain street address without a named venue; otherwise the OSM
  // category:type (e.g. 'leisure:sports_centre').
  category: string;
}

// OSM tags that describe places where training plausibly happens. Used only to
// rank results, never as proof that a gym exists or allows training.
const SPORT_TAGS: ReadonlySet<string> = new Set([
  'leisure:sports_centre', 'leisure:fitness_centre', 'leisure:sports_hall',
  'leisure:pitch', 'leisure:park', 'leisure:stadium', 'leisure:dojo',
  'amenity:dojo', 'amenity:community_centre', 'building:sports_hall', 'club:sport',
]);

const OSM_TYPES: ReadonlySet<string> = new Set(['node', 'way', 'relation']);

function clean(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

// Full address = street + house number + locality. Without these the target is
// not concrete enough (spec: no pin-only or vague places).
export function normalizePlace(r: NominatimResult): NormalizedPlace | null {
  const osmType = clean(r.osm_type);
  const osmId = typeof r.osm_id === 'string' ? Number(r.osm_id) : r.osm_id;
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  if (!OSM_TYPES.has(osmType) || osmId === undefined || !Number.isSafeInteger(osmId)) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const a = r.address ?? {};
  const street = clean(a.road) || clean(a.pedestrian) || clean(a.square);
  const houseNumber = clean(a.house_number);
  const locality = clean(a.city) || clean(a.town) || clean(a.village) || clean(a.municipality);
  if (street === '' || houseNumber === '' || locality === '') return null;

  const postcode = clean(a.postcode);
  const country = clean(a.country);
  const streetLine = `${street} ${houseNumber}`;
  const address = [streetLine, [postcode, locality].filter((p) => p !== '').join(' '), country]
    .filter((p) => p !== '')
    .join(', ')
    .slice(0, 300);

  const poiName = clean(r.name);
  const isPoi = poiName !== '' && poiName !== streetLine && poiName !== houseNumber;
  return {
    osm_type: osmType as NormalizedPlace['osm_type'],
    osm_id: osmId,
    name: (isPoi ? poiName : streetLine).slice(0, 120),
    address,
    lat,
    lng,
    category: isPoi ? `${clean(r.category)}:${clean(r.type)}` : 'address',
  };
}

// Named sport venues first, then other named venues, then plain addresses;
// stable within each group. Duplicates (same OSM object) removed.
export function rankPlaces(places: NormalizedPlace[]): NormalizedPlace[] {
  const seen = new Set<string>();
  const unique = places.filter((p) => {
    const key = `${p.osm_type}/${p.osm_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const rank = (p: NormalizedPlace): number =>
    SPORT_TAGS.has(p.category) ? 0 : p.category === 'address' ? 2 : 1;
  return unique
    .map((p, i) => ({ p, i }))
    .sort((x, y) => rank(x.p) - rank(y.p) || x.i - y.i)
    .map(({ p }) => p);
}

// Search bias around the user's chosen search area (only affects ranking of the
// search, never the binding distance check).
export function viewboxAround(lat: number, lng: number, deltaDeg = 1): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const left = Math.max(-180, lng - deltaDeg);
  const right = Math.min(180, lng + deltaDeg);
  const top = Math.min(90, lat + deltaDeg);
  const bottom = Math.max(-90, lat - deltaDeg);
  return `${left},${top},${right},${bottom}`;
}

export function validQuery(q: unknown): string | null {
  if (typeof q !== 'string') return null;
  const t = q.replace(/\s+/g, ' ').trim();
  return t.length >= 3 && t.length <= 160 ? t : null;
}
