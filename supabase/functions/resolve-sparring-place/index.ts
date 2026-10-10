// supabase/functions/resolve-sparring-place/index.ts
// Server-side place search for new sparrings. The app sends a search text; this
// function asks Photon (OpenStreetMap data; Nominatim's public instance blocks
// the Supabase Edge network with 403), keeps only results with a complete
// address (street, house number, locality), stores them in sparring_places
// (service role) and returns their ids. publish_sparring only accepts such a
// place id and takes the target coordinates from the stored row, so the client
// can never supply arbitrary target coordinates.
//
// Body: { query: string, near?: { lat: number, lng: number }, lang?: 'de' | 'en' }
//   near = the search area the user is looking at (search bias only).
// Pin mode: { pin: { lat: number, lng: number }, lang?: 'de' | 'en' }
//   A point tapped on the map (e.g. a meadow). Photon reverse only describes
//   it (nearest street, locality); the stored target is the pin itself. Stored
//   as osm_type 'pin', category 'address' (publish requires a place label). The
//   distance limit in publish_sparring applies unchanged.
// Response: { places: Array<{ id, name, address, lat, lng, category }> }
// Errors:   401 unauthenticated, 400 bad query, 429 quota, 502 upstream.
//
// Photon fair use: identifying User-Agent, low volume (per-user quota via
// consume_place_search_quota, 30 per 10 min), no bulk geocoding.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  normalizePin, normalizePlace, photonToNominatim, rankPlaces, validQuery,
  type NominatimResult, type NormalizedPlace, type PhotonFeature,
} from './nominatimPlace.ts';

const PHOTON_URL = 'https://photon.komoot.io/api/';
const PHOTON_REVERSE_URL = 'https://photon.komoot.io/reverse';
const USER_AGENT = 'Sparr/1.0 (https://sparrapp.com)';

interface Body {
  query?: unknown;
  near?: { lat?: unknown; lng?: unknown };
  pin?: { lat?: unknown; lng?: unknown };
  lang?: unknown;
}

const PLACE_COLUMNS = 'id, osm_type, osm_id, name, address, lat, lng, category';

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (authHeader === null) return json({ error: 'unauthenticated' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError !== null || user === null) return json({ error: 'unauthenticated' }, 401);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const isPin = body.pin !== undefined && body.pin !== null;
  const pinLat = Number(body.pin?.lat);
  const pinLng = Number(body.pin?.lng);
  const query = isPin ? null : validQuery(body.query);
  if (isPin) {
    if (!Number.isFinite(pinLat) || !Number.isFinite(pinLng) || Math.abs(pinLat) > 90 || Math.abs(pinLng) > 180) {
      return json({ error: 'bad_query' }, 400);
    }
  } else if (query === null) {
    return json({ error: 'bad_query' }, 400);
  }

  // Quota is checked as the user (auth.uid() inside the RPC).
  const { data: allowed, error: quotaError } = await userClient.rpc('consume_place_search_quota');
  if (quotaError !== null) {
    console.error('quota_failed', JSON.stringify(quotaError));
    return json({ error: 'upstream' }, 502);
  }
  if (allowed !== true) return json({ error: 'quota' }, 429);
  const lang = body.lang === 'en' ? 'en' : 'de';
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  if (isPin) {
    const reverseParams = new URLSearchParams({
      lat: String(pinLat),
      lon: String(pinLng),
      limit: '1',
      lang,
    });
    let reverse: NominatimResult | null;
    try {
      const res = await fetch(`${PHOTON_REVERSE_URL}?${reverseParams.toString()}`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!res.ok) {
        console.error('photon_reverse_not_ok', res.status, (await res.text()).slice(0, 300));
        return json({ error: 'upstream' }, 502);
      }
      const fc = (await res.json()) as { features?: PhotonFeature[] };
      const first = Array.isArray(fc.features) ? fc.features[0] : undefined;
      // The nearest feature's own name (e.g. a shop next to the meadow) would
      // mislabel the pin; only its street and locality describe the spot.
      reverse = first !== undefined ? { ...photonToNominatim(first), name: undefined } : null;
    } catch (e) {
      console.error('photon_reverse_failed', String(e));
      return json({ error: 'upstream' }, 502);
    }
    const pin = reverse !== null ? normalizePin(pinLat, pinLng, reverse) : null;
    if (pin === null) return json({ places: [] });
    const { data: row, error: pinError } = await admin
      .from('sparring_places')
      .upsert({ ...pin, updated_at: new Date().toISOString() }, { onConflict: 'osm_type,osm_id' })
      .select(PLACE_COLUMNS)
      .single();
    if (pinError !== null || row === null) {
      console.error('pin_upsert_failed', JSON.stringify(pinError));
      return json({ error: 'upstream' }, 502);
    }
    return json({
      places: [{ id: row.id, name: row.name, address: row.address, lat: row.lat, lng: row.lng, category: row.category }],
    });
  }

  const params = new URLSearchParams({
    q: query ?? '',
    limit: '8',
    lang,
  });
  // Location bias only (Photon ranks nearby results higher, nothing is cut off).
  const nearLat = Number(body.near?.lat);
  const nearLng = Number(body.near?.lng);
  if (Number.isFinite(nearLat) && Number.isFinite(nearLng) && Math.abs(nearLat) <= 90 && Math.abs(nearLng) <= 180) {
    params.set('lat', String(nearLat));
    params.set('lon', String(nearLng));
  }

  let results: NominatimResult[];
  try {
    const res = await fetch(`${PHOTON_URL}?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) {
      console.error('photon_not_ok', res.status, (await res.text()).slice(0, 300));
      return json({ error: 'upstream' }, 502);
    }
    const fc = (await res.json()) as { features?: PhotonFeature[] };
    results = (Array.isArray(fc.features) ? fc.features : []).map(photonToNominatim);
  } catch (e) {
    console.error('photon_fetch_failed', String(e));
    return json({ error: 'upstream' }, 502);
  }

  const places: NormalizedPlace[] = rankPlaces(
    (Array.isArray(results) ? results : [])
      .map(normalizePlace)
      .filter((p): p is NormalizedPlace => p !== null),
  );
  if (places.length === 0) return json({ places: [] });

  const { data: rows, error: upsertError } = await admin
    .from('sparring_places')
    .upsert(
      places.map((p) => ({ ...p, updated_at: new Date().toISOString() })),
      { onConflict: 'osm_type,osm_id' },
    )
    .select(PLACE_COLUMNS);
  if (upsertError !== null || rows === null) {
    console.error('upsert_failed', JSON.stringify(upsertError));
    return json({ error: 'upstream' }, 502);
  }

  // Keep the ranking order.
  const byKey = new Map(rows.map((r) => [`${r.osm_type}/${r.osm_id}`, r]));
  const out = places
    .map((p) => byKey.get(`${p.osm_type}/${p.osm_id}`))
    .filter((r) => r !== undefined)
    .map((r) => ({ id: r.id, name: r.name, address: r.address, lat: r.lat, lng: r.lng, category: r.category }));
  return json({ places: out });
});
