import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Ended sparrings of the user that still await "Hat euer Sparring
// stattgefunden?". Light: two small queries for the last days, then the
// server decides per candidate (get_sparring_trust_state.can_feedback) for at
// most MAX_CHECKED of them. Returns the first one that is due.
export interface FeedbackDue {
  id: string;
  title: string;
}

const MAX_CHECKED = 3;
// 72 h answer window + the longest planned duration (300 min) + margin.
const LOOKBACK_MS = (72 + 6) * 3_600_000;

export function useFeedbackDue(userId: string | null, refetchTrigger = 0): FeedbackDue | null {
  const [due, setDue] = useState<FeedbackDue | null>(null);

  useEffect(() => {
    if (userId === null) {
      setDue(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const now = Date.now();
      const since = new Date(now - LOOKBACK_MS).toISOString();
      const nowIso = new Date(now).toISOString();
      const [own, signups] = await Promise.all([
        supabase.from('open_sparrings').select('id').eq('created_by', userId)
          .gte('scheduled_at', since).lte('scheduled_at', nowIso),
        supabase.from('sparring_signups').select('sparring_id')
          .eq('user_id', userId).in('status', ['pending', 'confirmed', 'attended']),
      ]);
      if (cancelled || own.error !== null || signups.error !== null) return;
      const ids = [...new Set([
        ...(own.data ?? []).map((r) => r.id),
        ...(signups.data ?? []).map((r) => r.sparring_id),
      ])];
      if (ids.length === 0) {
        setDue(null);
        return;
      }
      const { data: rows, error } = await supabase
        .from('open_sparrings')
        .select('id, title, scheduled_at, duration_min, is_active')
        .in('id', ids)
        .eq('is_active', true)
        .gte('scheduled_at', since)
        .lte('scheduled_at', nowIso)
        .order('scheduled_at', { ascending: false })
        .limit(MAX_CHECKED * 2);
      if (cancelled || error !== null) return;
      const ended = (rows ?? [])
        .filter((r) => Date.parse(r.scheduled_at) + r.duration_min * 60_000 <= now)
        .slice(0, MAX_CHECKED);
      for (const r of ended) {
        const { data } = await supabase.rpc('get_sparring_trust_state', { p_sparring_id: r.id });
        if (cancelled) return;
        if (data !== null && data.can_feedback === true && data.feedback_answer == null && data.cancelled !== true) {
          setDue({ id: r.id, title: r.title });
          return;
        }
      }
      setDue(null);
    })();
    return () => { cancelled = true; };
  }, [userId, refetchTrigger]);

  return due;
}
