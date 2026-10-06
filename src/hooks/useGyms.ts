import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import i18n from '../i18n';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { gymErrorMessage, gymSearchTokens, rankSimilarGyms, significantGymWords } from '../utils/gymSearch';

// Lean gym function on top of the existing studios table (no parallel gym
// system). A gym is a shared reference point: profiles point at it via
// home_gym_id (self-declaration), sparrings via gym_id (location).

export interface Gym {
  id:            string;
  name:          string;
  city:          string;
  address:       string | null;
  avatar_url:    string | null;
  banner_url:    string | null;
  owner_user_id: string | null;
  lat:           number | null;
  lng:           number | null;
  description:   string | null;
  disciplines:   string[];
  website_url:   string | null;
}

export type LoadStatus = 'loading' | 'ready' | 'error';

const GYM_FIELDS = 'id, name, city, address, avatar_url, banner_url, owner_user_id, lat, lng';

type GymRow = Partial<Gym> & Pick<Gym, 'id' | 'name'>;

// Rows from list queries carry only GYM_FIELDS; the gym page reads all
// columns (website_url only exists once 20261002190000 is applied).
export function toGym(row: GymRow): Gym {
  return {
    id:            row.id,
    name:          row.name,
    city:          row.city ?? '',
    address:       row.address ?? null,
    avatar_url:    row.avatar_url ?? null,
    banner_url:    row.banner_url ?? null,
    owner_user_id: row.owner_user_id ?? null,
    lat:           row.lat ?? null,
    lng:           row.lng ?? null,
    description:   row.description ?? null,
    disciplines:   Array.isArray(row.disciplines) ? row.disciplines : [],
    website_url:   row.website_url ?? null,
  };
}

// ─── Single gym ──────────────────────────────────────────────────────────────

export function useGym(gymId: string | null, refetchTrigger = 0): {
  gym:     Gym | null;
  status:  LoadStatus;
  refetch: () => void;
} {
  const cacheKey = gymId !== null ? `useGym:${gymId}` : null;
  const cached = cacheKey !== null ? getCached<Gym>(cacheKey) : undefined;
  const [gym, setGym] = useState<Gym | null>(() => cached ?? null);
  const [status, setStatus] = useState<LoadStatus>(() => (gymId === null || cached !== undefined ? 'ready' : 'loading'));
  const [version, setVersion] = useState(0);
  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (gymId === null || cacheKey === null) {
      setGym(null);
      setStatus('ready');
      return;
    }
    let cancelled = false;
    const hit = getCached<Gym>(cacheKey);
    if (hit !== undefined) {
      setGym(hit);
      setStatus('ready');
    } else {
      setStatus('loading');
    }
    void (async () => {
      const { data, error } = await supabase.from('studios').select('*').eq('id', gymId).maybeSingle();
      if (cancelled) return;
      if (error !== null) {
        reportNetworkError(error);
        if (hit === undefined) setStatus('error');
        return;
      }
      reportNetworkSuccess();
      const next = data !== null ? toGym(data as GymRow) : null;
      setGym(next);
      if (next !== null) setCached<Gym>(cacheKey, next);
      setStatus('ready');
    })();
    return () => { cancelled = true; };
  }, [gymId, cacheKey, refetchTrigger, version]);

  return { gym, status, refetch };
}

// After an edit: the next useGym mount shows the saved state immediately.
export function cacheGym(gym: Gym): void {
  setCached<Gym>(`useGym:${gym.id}`, gym);
}

// ─── Search (debounced, stale answers dropped) ───────────────────────────────

export async function searchGyms(query: string, limit = 20): Promise<{ data: Gym[]; error: string | null }> {
  const tokens = gymSearchTokens(query);
  let req = supabase.from('studios').select(GYM_FIELDS).order('name').order('city').limit(limit);
  // Every token must match name or city: "Phoenix Berlin" finds Phoenix in Berlin.
  for (const t of tokens) req = req.or(`name.ilike.%${t}%,city.ilike.%${t}%`);
  const { data, error } = await req;
  if (error !== null) return { data: [], error: error.message };
  return { data: ((data ?? []) as GymRow[]).map(toGym), error: null };
}

export function useGymSearch(query: string, enabled: boolean): {
  results: Gym[];
  status:  LoadStatus | 'idle';
  retry:   () => void;
} {
  const [results, setResults] = useState<Gym[]>([]);
  const [status, setStatus] = useState<LoadStatus | 'idle'>('idle');
  const [attempt, setAttempt] = useState(0);
  const requestId = useRef(0);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    if (!enabled) return;
    const tokens = gymSearchTokens(query);
    if (tokens.length === 0) {
      requestId.current += 1;
      setResults([]);
      setStatus('idle');
      return;
    }
    const id = ++requestId.current;
    setStatus('loading');
    const timer = setTimeout(() => {
      void searchGyms(query).then(({ data, error }) => {
        // A newer keystroke has started its own request — drop this answer.
        if (id !== requestId.current) return;
        if (error !== null) {
          setStatus('error');
          return;
        }
        setResults(data);
        setStatus('ready');
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, enabled, attempt]);

  return { results, status, retry };
}

// Existing entries that could be the gym the user is about to add.
export async function findSimilarGyms(name: string, city: string): Promise<Gym[]> {
  const words = significantGymWords(name).slice(0, 3);
  const whole = gymSearchTokens(name).join(' ');
  const terms = [...words, ...(whole.length >= 2 ? [whole] : [])];
  if (terms.length === 0) return [];
  const filter = terms.map((t) => `name.ilike.%${t}%`).join(',');
  const { data, error } = await supabase.from('studios').select(GYM_FIELDS).or(filter).limit(30);
  if (error !== null) return [];
  return rankSimilarGyms(((data ?? []) as GymRow[]).map(toGym), name, city).slice(0, 5);
}

export async function createGym(name: string, city: string, address: string): Promise<{
  gym: Gym | null; created: boolean; error: string | null;
}> {
  const { data, error } = await supabase.rpc('create_gym', {
    p_name:    name.trim(),
    p_city:    city.trim(),
    p_address: address.trim().length > 0 ? address.trim() : null,
  });
  if (error !== null) return { gym: null, created: false, error: gymErrorMessage(error.message) };
  const row = (data ?? [])[0];
  if (row === undefined) return { gym: null, created: false, error: gymErrorMessage('') };
  return {
    gym:     toGym({ id: row.id, name: row.name, city: row.city, address: row.address }),
    created: row.created,
    error:   null,
  };
}

// Stored for review, never applied to the shared entry directly.
export async function suggestGymCorrection(input: {
  gymId:   string;
  name:    string | null;
  city:    string | null;
  address: string | null;
  note:    string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('gym_correction_requests').insert({
    studio_id:        input.gymId,
    proposed_name:    input.name,
    proposed_city:    input.city,
    proposed_address: input.address,
    note:             input.note,
  });
  return { error: error !== null ? i18n.t('gym.correction.sendFailed') : null };
}

// ─── Fighters who name this gym ───────────────────────────────────────────────

export interface GymFighter {
  id:          string;
  name:        string | null;
  nickname:    string | null;
  avatar_url:  string | null;
  disciplines: string[];
}

const FIGHTER_PAGE = 20;

// Profiles that publicly name this gym (home_gym_id) — profiles are readable
// for signed-in users anyway, nothing beyond that becomes visible here.
// `pageSize` keeps the gym page preview small; the full list pages by 20.
export function useGymFighters(gymId: string, refetchTrigger = 0, pageSize = FIGHTER_PAGE): {
  fighters: GymFighter[];
  /** Exact number of fighters naming this gym (same rows as the list); null until known. */
  total:    number | null;
  status:   LoadStatus;
  hasMore:  boolean;
  loadingMore: boolean;
  loadMore: () => void;
  retry:    () => void;
} {
  const [fighters, setFighters] = useState<GymFighter[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  // The first page also carries the exact count (same request, no extra round trip).
  const fetchPage = useCallback(async (from: number) => supabase
    .from('profiles')
    .select('id, name, nickname, avatar_url, disciplines', from === 0 ? { count: 'exact' } : undefined)
    .eq('home_gym_id', gymId)
    .not('name', 'is', null)
    .order('name')
    .order('id')
    .range(from, from + pageSize), [gymId, pageSize]);

  useEffect(() => {
    let cancelled = false;
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    void fetchPage(0).then(({ data, error, count }) => {
      if (cancelled) return;
      if (error !== null) { setStatus('error'); return; }
      const rows = (data ?? []) as GymFighter[];
      setTotal(count ?? null);
      setHasMore(rows.length > pageSize);
      setFighters(rows.slice(0, pageSize));
      setStatus('ready');
    });
    return () => { cancelled = true; };
  }, [fetchPage, refetchTrigger, attempt]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    void fetchPage(fighters.length).then(({ data, error }) => {
      setLoadingMore(false);
      if (error !== null) return;
      const rows = (data ?? []) as GymFighter[];
      setHasMore(rows.length > pageSize);
      setFighters((prev) => {
        const seen = new Set(prev.map((f) => f.id));
        return [...prev, ...rows.slice(0, pageSize).filter((r) => !seen.has(r.id))];
      });
    });
  }, [fetchPage, fighters.length, hasMore, loadingMore, pageSize]);

  return { fighters, total, status, hasMore, loadingMore, loadMore, retry };
}

// ─── Upcoming sparrings at this gym ───────────────────────────────────────────

export interface GymSparring {
  id:           string;
  title:        string;
  discipline:   string;
  scheduled_at: string;
  address:      string;
  access_note:  string | null;
  created_by:   string;
  max_slots:    number;
  /** max_slots minus held slots (pending + confirmed, same rule as the map). */
  free_slots:   number | null;
  organizer:    { name: string | null } | null;
}

type GymSparringRow = Omit<GymSparring, 'free_slots'>;

// Published, upcoming sparrings at this gym — only those explicitly linked via
// gym_id, never by name or distance. Row-level security decides what the
// viewer may see (same rules as the map); nothing extra is exposed.
export function useGymSparrings(gymId: string, refetchTrigger = 0): {
  sparrings: GymSparring[];
  status:    LoadStatus;
  retry:     () => void;
} {
  const [sparrings, setSparrings] = useState<GymSparring[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    let cancelled = false;
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    void (async () => {
      const { data, error } = await supabase
        .from('open_sparrings')
        .select('id, title, discipline, scheduled_at, address, access_note, created_by, max_slots, organizer:profiles!created_by(name)')
        .eq('gym_id', gymId)
        .eq('is_active', true)
        .gt('scheduled_at', new Date().toISOString())
        .order('scheduled_at')
        .limit(10);
      if (cancelled) return;
      if (error !== null) { setStatus('error'); return; }
      const rows = (data ?? []) as unknown as GymSparringRow[];
      const held: Record<string, number> = {};
      if (rows.length > 0) {
        const { data: slots, error: slotsError } = await supabase
          .from('sparring_signups')
          .select('sparring_id')
          .in('sparring_id', rows.map((r) => r.id))
          .in('status', ['pending', 'confirmed']);
        if (cancelled) return;
        // Without counts the list still shows; free slots are just left out.
        if (slotsError === null) for (const s of slots ?? []) held[s.sparring_id] = (held[s.sparring_id] ?? 0) + 1;
        else for (const r of rows) held[r.id] = Number.NaN;
      }
      setSparrings(rows.map((r) => {
        const taken = held[r.id] ?? 0;
        return { ...r, free_slots: Number.isNaN(taken) ? null : Math.max(0, r.max_slots - taken) };
      }));
      setStatus('ready');
    })();
    return () => { cancelled = true; };
  }, [gymId, refetchTrigger, attempt]);

  return { sparrings, status, retry };
}
