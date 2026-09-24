import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';
import type { SparringSignupStatus } from '../types/database.types';

export interface SparringWithMeta {
  id: string;
  studio_id: string | null;
  created_by: string;
  title: string;
  discipline: string;
  address: string;
  lat: number | null;
  lng: number | null;
  scheduled_at: string;
  duration_min: number;
  max_slots: number;
  notes: string | null;
  is_active: boolean;
  is_featured: boolean;
  is_at_studio: boolean;
  verified_only: boolean;
  created_at: string;
  studio_name: string;
  studio_city: string;
  // Slot holders only (pending + confirmed) — never cancelled/expired/waitlisted.
  signup_count: number;
  // Confirmed only — used for the "N Teilnehmer haben bereits bestätigt" social proof.
  confirmed_count: number;
  // True when the current user holds a slot (pending or confirmed).
  is_signed_up: boolean;
  // The current user's own signup row status, whatever it is (or null if never signed up).
  my_status: SparringSignupStatus | null;
}

type OpenSparringRow = {
  id: string;
  studio_id: string | null;
  created_by: string;
  title: string;
  discipline: string;
  address: string;
  lat: number | null;
  lng: number | null;
  scheduled_at: string;
  duration_min: number;
  max_slots: number;
  notes: string | null;
  is_active: boolean;
  is_featured: boolean | null;
  is_at_studio: boolean | null;
  verified_only: boolean | null;
  created_at: string;
};

type StudioJoin = { name: string; city: string } | null;

interface RowMeta {
  studio: StudioJoin;
  isBoosted: boolean;
  signupCount: number;
  confirmedCount: number;
  myStatus: SparringSignupStatus | null;
}

// Central row → SparringWithMeta mapping, shared by the list query and the
// single-sparring lookup (fetchSparringById) so both stay in sync.
function mapSparringRow(row: OpenSparringRow, meta: RowMeta): SparringWithMeta {
  const isSignedUp = meta.myStatus === 'pending' || meta.myStatus === 'confirmed';
  return {
    id: row.id,
    studio_id: row.studio_id,
    created_by: row.created_by,
    title: row.title,
    discipline: row.discipline,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    scheduled_at: row.scheduled_at,
    duration_min: row.duration_min,
    max_slots: row.max_slots,
    notes: row.notes,
    is_active: row.is_active,
    is_featured: (row.is_featured ?? false) || meta.isBoosted,
    is_at_studio: row.is_at_studio ?? false,
    verified_only: row.verified_only ?? false,
    created_at: row.created_at,
    studio_name: meta.studio?.name ?? 'Privat',
    studio_city: meta.studio?.city ?? '',
    signup_count: meta.signupCount,
    confirmed_count: meta.confirmedCount,
    is_signed_up: isSignedUp,
    my_status: meta.myStatus,
  };
}

// Fetches a single sparring by id, including ones that already started (the
// list query below excludes those). Used for deep links / push taps that land
// on a sparring no longer in the upcoming list, and for the organizer's
// post-start attendance view.
export async function fetchSparringById(id: string, userId: string): Promise<SparringWithMeta | null> {
  const now = new Date().toISOString();

  const { data: row, error } = await supabase
    .from('open_sparrings')
    .select('*, studios!studio_id(name, city)')
    .eq('id', id)
    .maybeSingle();

  if (error !== null || row === null) return null;

  const [{ data: slotRows }, { data: myRow }, { data: boost }] = await Promise.all([
    supabase
      .from('sparring_signups')
      .select('status')
      .eq('sparring_id', id)
      .in('status', ['pending', 'confirmed']),
    supabase
      .from('sparring_signups')
      .select('status')
      .eq('sparring_id', id)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('map_boosts')
      .select('sparring_id')
      .eq('sparring_id', id)
      .eq('is_active', true)
      .gt('expires_at', now)
      .maybeSingle(),
  ]);

  const signupCount    = (slotRows ?? []).length;
  const confirmedCount = (slotRows ?? []).filter((r) => r.status === 'confirmed').length;

  return mapSparringRow(row as OpenSparringRow, {
    studio: row.studios as StudioJoin,
    isBoosted: boost !== null,
    signupCount,
    confirmedCount,
    myStatus: (myRow?.status as SparringSignupStatus | undefined) ?? null,
  });
}

type OpenSparringsSnapshot = { sparrings: SparringWithMeta[] };

export function useOpenSparrings(refetchTrigger = 0): {
  sparrings: SparringWithMeta[];
  loading: boolean;
  refetch: () => void;
} {
  const { user } = useAuth();
  const cacheKey = user ? `useOpenSparrings:${user.id}` : null;
  const cached = cacheKey ? getCached<OpenSparringsSnapshot>(cacheKey) : undefined;
  const [sparrings, setSparrings] = useState<SparringWithMeta[]>(() => cached?.sparrings ?? []);
  const [loading, setLoading] = useState(cached === undefined);
  const [localTrigger, setLocalTrigger] = useState(0);

  const refetch = useCallback(() => setLocalTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null) return;

    void (async () => {
      const now = new Date().toISOString();

      const { data: rows, error } = await supabase
        .from('open_sparrings')
        .select('*, studios!studio_id(name, city)')
        .eq('is_active', true)
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true });

      if (error !== null) {
        reportNetworkError(error);
        setLoading(false);
        return;
      }

      const sparringIds = (rows ?? []).map((r) => r.id);

      const [{ data: mySignups }, { data: slotSignups }, { data: activeBoosts }] = await Promise.all([
        // Own status for every sparring, any status — drives my_status/CTA.
        supabase.from('sparring_signups').select('sparring_id, status').eq('user_id', user.id),
        // Only slot holders count towards signup_count/confirmed_count — spec 16.9.
        sparringIds.length > 0
          ? supabase
              .from('sparring_signups')
              .select('sparring_id, status')
              .in('sparring_id', sparringIds)
              .in('status', ['pending', 'confirmed'])
          : Promise.resolve({ data: [] as Array<{ sparring_id: string; status: SparringSignupStatus }>, error: null }),
        sparringIds.length > 0
          ? supabase
              .from('map_boosts')
              .select('sparring_id')
              .eq('is_active', true)
              .gt('expires_at', now)
              .in('sparring_id', sparringIds)
          : Promise.resolve({ data: [] as Array<{ sparring_id: string }>, error: null }),
      ]);

      const myStatusMap: Record<string, SparringSignupStatus> = {};
      for (const s of mySignups ?? []) {
        myStatusMap[s.sparring_id] = s.status;
      }
      const boostedIds = new Set((activeBoosts ?? []).map((b) => b.sparring_id));
      const signupCountMap: Record<string, number> = {};
      const confirmedCountMap: Record<string, number> = {};
      for (const s of slotSignups ?? []) {
        signupCountMap[s.sparring_id] = (signupCountMap[s.sparring_id] ?? 0) + 1;
        if (s.status === 'confirmed') {
          confirmedCountMap[s.sparring_id] = (confirmedCountMap[s.sparring_id] ?? 0) + 1;
        }
      }

      const result: SparringWithMeta[] = (rows ?? []).map((r) => mapSparringRow(r as OpenSparringRow, {
        studio: r.studios as StudioJoin,
        isBoosted: boostedIds.has(r.id),
        signupCount: signupCountMap[r.id] ?? 0,
        confirmedCount: confirmedCountMap[r.id] ?? 0,
        myStatus: myStatusMap[r.id] ?? null,
      }));

      reportNetworkSuccess();
      setSparrings(result);
      if (cacheKey) setCached<OpenSparringsSnapshot>(cacheKey, { sparrings: result });
      setLoading(false);
    })();
  }, [user, refetchTrigger, localTrigger]);

  return { sparrings, loading, refetch };
}
