import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// The client is created lazily (not at module scope) so that `next build`
// succeeds even when NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
// are not set in the build environment. It only throws once something
// actually tries to talk to Supabase at request time.
let cachedClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing Supabase env vars');

  cachedClient = createClient(url, anon, {
    auth: { persistSession: false },
  });
  return cachedClient;
}

export interface PublicSparring {
  id: string;
  title: string;
  discipline: string;
  scheduled_at: string;
  duration_min: number;
  max_slots: number;
  slots_left: number;
  area_label: string;
  host_name: string | null;
  host_avatar_url: string | null;
}

export async function fetchPublicSparring(id: string): Promise<PublicSparring | null> {
  // By-id SECURITY DEFINER RPC (not a queryable view) so the public surface
  // can't be bulk-enumerated with the anon key. Returns the curated JSON object,
  // or null when the id is unknown / inactive / verified_only.
  const { data, error } = await getSupabaseClient()
    .rpc('get_public_sparring', { p_id: id });
  if (error || !data) return null;
  return data as PublicSparring;
}
