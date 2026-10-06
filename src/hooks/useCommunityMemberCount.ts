import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';

// Registered Sparr members for the Home greeting line. One aggregate number
// from the get_community_member_count RPC (see its migration for exactly what
// is counted) — no account rows reach the client. Fetched at most every 6 h per
// app session; no polling. Anything but a positive number means "unavailable"
// (e.g. RPC not deployed yet, offline): Home then hides the line, never shows 0.

const CACHE_KEY = 'useCommunityMemberCount';
const REFRESH_MS = 6 * 60 * 60 * 1000;
let lastFetchAt = 0;

export function useCommunityMemberCount(enabled: boolean): number | null {
  const [count, setCount] = useState<number | null>(() => getCached<number>(CACHE_KEY) ?? null);

  useEffect(() => {
    if (!enabled) return;
    if (Date.now() - lastFetchAt < REFRESH_MS) return;
    lastFetchAt = Date.now();
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc('get_community_member_count');
      if (cancelled) return;
      if (error !== null || typeof data !== 'number' || data <= 0) {
        // Allow a retry on the next Home visit instead of waiting 6 h.
        lastFetchAt = 0;
        return;
      }
      setCached<number>(CACHE_KEY, data);
      setCount(data);
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  return count;
}
