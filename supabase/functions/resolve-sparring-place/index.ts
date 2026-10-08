// supabase/functions/resolve-sparring-place/index.ts
// Server-side place search for new sparrings. The app sends a search text; this
// function asks OpenStreetMap Nominatim, keeps only results with a complete
// address (street, house number, locality), stores them in sparring_places
// (service role) and returns their ids. publish_sparring only accepts such a
// place id and takes the target coordinates from the stored row, so the client
// can never supply arbitrary target coordinates.
//
// Body: { query: string, near?: { lat: number, lng: number }, lang?: 'de' | 'en' }
//   near = the search area the user is looking at (search bias only).
// Response: { places: Array<{ id, name, address, lat, lng, category }> }
// Errors:   401 unauthenticated, 400 bad query, 429 quota, 502 upstream.
//
// Nominatim usage policy: identifying User-Agent, low volume (per-user quota via
// consume_place_search_quota, 30 per 10 min), no bulk geocoding.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  normalizePlace, rankPlaces, validQuery, viewboxAround,
  type NominatimResult, type NormalizedPlace,
} from './nominatimPlace.ts';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'Sparr/1.0 (https://sparrapp.com)';

interface Body {
  query?: unknown;
  near?: { lat?: unknown; lng?: unknown };
  lang?: unknown;
}

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
  const query = validQuery(body.query);
  if (query === null) return json({ error: 'bad_query' }, 400);

  // Quota is checked as the user (auth.uid() inside the RPC).
  const { data: allowed, error: quotaError } = await userClient.rpc('consume_place_search_quota');
  if (quotaError !== null) return json({ error: 'upstream' }, 502);
  if (allowed !== true) return json({ error: 'quota' }, 429);

  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '8',
    'accept-language': body.lang === 'en' ? 'en' : 'de',
  });
  const nearLat = Number(body.near?.lat);
  const nearLng = Number(body.near?.lng);
  const viewbox = viewboxAround(nearLat, nearLng);
  if (viewbox !== null) params.set('viewbox', viewbox);

  let results: NominatimResult[];
  try {
    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return json({ error: 'upstream' }, 502);
    results = (await res.json()) as NominatimResult[];
  } catch {
    return json({ error: 'upstream' }, 502);
  }

  const places: NormalizedPlace[] = rankPlaces(
    (Array.isArray(results) ? results : [])
      .map(normalizePlace)
      .filter((p): p is NormalizedPlace => p !== null),
  );
  if (places.length === 0) return json({ places: [] });

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const { data: rows, error: upsertError } = await admin
    .from('sparring_places')
    .upsert(
      places.map((p) => ({ ...p, updated_at: new Date().toISOString() })),
      { onConflict: 'osm_type,osm_id' },
    )
    .select('id, osm_type, osm_id, name, address, lat, lng, category');
  if (upsertError !== null || rows === null) return json({ error: 'upstream' }, 502);

  // Keep the ranking order.
  const byKey = new Map(rows.map((r) => [`${r.osm_type}/${r.osm_id}`, r]));
  const out = places
    .map((p) => byKey.get(`${p.osm_type}/${p.osm_id}`))
    .filter((r) => r !== undefined)
    .map((r) => ({ id: r.id, name: r.name, address: r.address, lat: r.lat, lng: r.lng, category: r.category }));
  return json({ places: out });
});
