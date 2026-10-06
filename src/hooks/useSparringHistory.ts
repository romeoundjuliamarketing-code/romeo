import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import { isHistoryVisible } from '../utils/sparringHistory';
import type { HistoryRole } from '../utils/sparringHistory';

// The own sparring meetings for the profile: slots taken (status exactly as
// the server recorded it) plus sparrings the user organizes. Newest first, a
// short preview; "Mehr anzeigen" raises the limit and reloads.

export interface HistoryEntry {
  sparringId:  string;
  role:        HistoryRole;
  status:      string | null;
  title:       string;
  scheduledAt: string;
  place:       string;
}

interface SparringRow {
  id:           string;
  title:        string;
  scheduled_at: string;
  address:      string;
  is_active:    boolean;
  gym:          { name: string; city: string } | null;
}

const FIELDS = 'id, title, scheduled_at, address, is_active, gym:studios!gym_id(name, city)';

function placeOf(row: SparringRow): string {
  if (row.gym !== null) return row.gym.name;
  // First address part ("Straße 1, 12345 Stadt" → "Straße 1") keeps the row short.
  return row.address.split(',')[0]?.trim() ?? row.address;
}

export const HISTORY_PREVIEW = 4;
const HISTORY_STEP = 20;

export function useSparringHistory(userId: string | null, refetchTrigger = 0): {
  entries:  HistoryEntry[];
  status:   'loading' | 'ready' | 'error';
  hasMore:  boolean;
  showMore: () => void;
  retry:    () => void;
} {
  const cacheKey = userId !== null ? `useSparringHistory:${userId}` : null;
  const cached = cacheKey !== null ? getCached<HistoryEntry[]>(cacheKey) : undefined;
  const [entries, setEntries] = useState<HistoryEntry[]>(() => cached ?? []);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(() => (cached !== undefined ? 'ready' : 'loading'));
  const [limit, setLimit] = useState(HISTORY_PREVIEW);
  const [hasMore, setHasMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const showMore = useCallback(() => setLimit((l) => l + HISTORY_STEP), []);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    if (userId === null || cacheKey === null) {
      setEntries([]);
      setStatus('ready');
      return;
    }
    let cancelled = false;
    void (async () => {
      // One extra row per source tells whether more exist.
      const [signups, organized] = await Promise.all([
        supabase
          .from('sparring_signups')
          .select(`status, sparring:open_sparrings!sparring_id(${FIELDS})`)
          .eq('user_id', userId)
          .not('status', 'in', '(cancelled,expired)')
          .order('signed_up_at', { ascending: false })
          .limit(limit + 1),
        supabase
          .from('open_sparrings')
          .select(FIELDS)
          .eq('created_by', userId)
          .eq('is_active', true)
          .order('scheduled_at', { ascending: false })
          .limit(limit + 1),
      ]);
      if (cancelled) return;
      if (signups.error !== null || organized.error !== null) {
        setStatus((s) => (s === 'ready' ? s : 'error'));
        return;
      }
      const list: HistoryEntry[] = [];
      for (const s of (signups.data ?? []) as unknown as { status: string; sparring: SparringRow | null }[]) {
        // Deactivated sparrings are not readable (RLS) and arrive as null.
        if (s.sparring === null) continue;
        const e = { sparringId: s.sparring.id, role: 'participant' as const, status: s.status, title: s.sparring.title, scheduledAt: s.sparring.scheduled_at, place: placeOf(s.sparring) };
        if (isHistoryVisible(e)) list.push(e);
      }
      const seen = new Set(list.map((e) => e.sparringId));
      for (const row of (organized.data ?? []) as unknown as SparringRow[]) {
        if (seen.has(row.id)) continue;
        list.push({ sparringId: row.id, role: 'organizer', status: null, title: row.title, scheduledAt: row.scheduled_at, place: placeOf(row) });
      }
      list.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
      const more = list.length > limit
        || (signups.data ?? []).length > limit
        || (organized.data ?? []).length > limit;
      const page = list.slice(0, limit);
      setHasMore(more);
      setEntries(page);
      if (limit === HISTORY_PREVIEW) setCached<HistoryEntry[]>(cacheKey, page);
      setStatus('ready');
    })();
    return () => { cancelled = true; };
  }, [userId, cacheKey, limit, refetchTrigger, attempt]);

  return { entries, status, hasMore, showMore, retry };
}
