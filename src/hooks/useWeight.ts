import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';
import type { WeightLog } from '../types/database.types';

// Returns the ISO date string of the Monday of the given date
export function mondayOfWeek(d = new Date()): string {
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = (day + 6) % 7;  // days since Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  return monday.toISOString().split('T')[0];
}

export interface WeightEntry {
  weekStart: string;
  weightKg: number;
}

type WeightSnapshot = { history: WeightEntry[] };

export function useWeight(refetchTrigger = 0): {
  history: WeightEntry[];
  currentWeight: number | null;
  isNewWeek: boolean;
  loading: boolean;
  logWeight: (kg: number) => Promise<{ error: string | null }>;
} {
  const { user } = useAuth();
  const cacheKey = user ? `useWeight:${user.id}` : null;
  const cached = cacheKey ? getCached<WeightSnapshot>(cacheKey) : undefined;
  const [history, setHistory] = useState<WeightEntry[]>(() => cached?.history ?? []);
  const [loading, setLoading] = useState(cached === undefined);

  useEffect(() => {
    if (user === null) {
      setLoading(false);
      return;
    }
    void fetchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, refetchTrigger]);

  async function fetchHistory(): Promise<void> {
    const { data, error } = await supabase
      .from('weight_logs')
      .select('week_start, weight_kg')
      .eq('user_id', user!.id)
      .order('week_start', { ascending: true });

    if (error !== null) {
      reportNetworkError(error);
    } else {
      reportNetworkSuccess();
    }
    const entries = (data ?? []).map((row: Pick<WeightLog, 'week_start' | 'weight_kg'>) => ({
      weekStart: row.week_start,
      weightKg: Number(row.weight_kg),
    }));
    setHistory(entries);
    if (error === null && cacheKey) setCached<WeightSnapshot>(cacheKey, { history: entries });
    setLoading(false);
  }

  async function logWeight(kg: number): Promise<{ error: string | null }> {
    if (user === null) return { error: 'Nicht eingeloggt' };
    const week = mondayOfWeek();
    const { error } = await supabase
      .from('weight_logs')
      .upsert(
        { user_id: user.id, week_start: week, weight_kg: kg },
        { onConflict: 'user_id,week_start' },
      );
    if (error !== null) return { error: error.message };
    await fetchHistory();
    return { error: null };
  }

  const thisWeek = mondayOfWeek();
  const latestEntry = history.length > 0 ? history[history.length - 1] : null;
  const currentWeight = latestEntry?.weightKg ?? null;
  const isNewWeek = latestEntry === null || latestEntry.weekStart !== thisWeek;

  return { history, currentWeight, isNewWeek, loading, logWeight };
}

// Fetches the latest weight for a list of user IDs (for team display)
export async function fetchTeamWeights(
  userIds: string[],
): Promise<Record<string, number>> {
  if (userIds.length === 0) return {};
  const thisWeek = mondayOfWeek();
  const twoWeeksAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  })();

  const { data } = await supabase
    .from('weight_logs')
    .select('user_id, week_start, weight_kg')
    .in('user_id', userIds)
    .gte('week_start', twoWeeksAgo)
    .lte('week_start', thisWeek)
    .order('week_start', { ascending: false });

  // Keep only the most recent entry per user
  const result: Record<string, number> = {};
  for (const row of (data ?? []) as Pick<WeightLog, 'user_id' | 'week_start' | 'weight_kg'>[]) {
    if (result[row.user_id] === undefined) {
      result[row.user_id] = Number(row.weight_kg);
    }
  }
  return result;
}
