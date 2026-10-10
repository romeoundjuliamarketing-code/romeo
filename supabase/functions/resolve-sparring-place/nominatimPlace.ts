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

// Photon (photon.komoot.io, OSM data) GeoJSON feature. Nominatim's public
// instance blocks the Supabase Edge network (403), so searches go to Photon and
// are mapped into the Nominatim shape; normalisation and stored OSM ids stay
// the same (Photon returns the same OSM objects).
export interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    osm_key?: string;
    osm_value?: string;
    type?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    postcode?: string;
    city?: string;
    country?: string;
  };
}

const PHOTON_OSM_TYPES: Readonly<Record<string, string>> = { N: 'node', W: 'way', R: 'relation' };

export function photonToNominatim(f: PhotonFeature): NominatimResult {
  const p = f.properties ?? {};
  const coords = f.geometry?.coordinates;
  // A street feature carries the street as its name and has no street field.
  const road = p.street ?? (p.type === 'street' ? p.name : undefined);
  return {
    osm_type: PHOTON_OSM_TYPES[p.osm_type ?? ''] ?? p.osm_type,
    osm_id: p.osm_id,
    lat: coords !== undefined ? String(coords[1]) : undefined,
    lon: coords !== undefined ? String(coords[0]) : undefined,
    category: p.osm_key,
    type: p.osm_value,
    name: p.name,
    address: {
      road,
      house_number: p.housenumber,
      postcode: p.postcode,
      city: p.city,
      country: p.country,
    },
  };
}

export interface NormalizedPlace {
  // 'pin' = point tapped on the map (osm_id = pinKey of the rounded position).
  osm_type: 'node' | 'way' | 'relation' | 'pin';
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

// Map pins are rounded to 5 decimals (about 1 m). The key packs both rounded
// values into one non-negative safe integer, so the same spot reuses one row.
const PIN_SCALE = 1e5;

function roundPin(v: number): number {
  return Math.round(v * PIN_SCALE) / PIN_SCALE;
}

export function pinKey(lat: number, lng: number): number {
  const latInt = Math.round(lat * PIN_SCALE) + 90 * PIN_SCALE;
  const lngInt = Math.round(lng * PIN_SCALE) + 180 * PIN_SCALE;
  return latInt * (360 * PIN_SCALE + 1) + lngInt;
}

// A map pin (e.g. a meadow) for a Nominatim reverse result. The target is the
// tapped position itself; the reverse result only describes it. A locality is
// required, so pins outside any settlement (sea, wilderness) are refused.
// Category 'address' makes publish_sparring require a place label.
export function normalizePin(lat: number, lng: number, r: NominatimResult): NormalizedPlace | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const a = r.address ?? {};
  const street = clean(a.road) || clean(a.pedestrian) || clean(a.square);
  const locality = clean(a.city) || clean(a.town) || clean(a.village) || clean(a.municipality);
  if (locality === '') return null;

  const address = [street, [clean(a.postcode), locality].filter((p) => p !== '').join(' '), clean(a.country)]
    .filter((p) => p !== '')
    .join(', ')
    .slice(0, 300);
  if (address.length < 5) return null;

  return {
    osm_type: 'pin',
    osm_id: pinKey(lat, lng),
    name: (clean(r.name) || street || locality).slice(0, 120),
    address,
    lat: roundPin(lat),
    lng: roundPin(lng),
    category: 'address',
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
