import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import type { FightRecord, FightRecordInsert } from '../types/database.types';

export type { FightRecord };

type FightInsert = Omit<FightRecordInsert, 'user_id'>;

interface UseFightRecordResult {
  fights:      FightRecord[];
  loading:     boolean;
  addFight:    (data: FightInsert) => Promise<{ error: string | null }>;
  deleteFight: (id: string)        => Promise<{ error: string | null }>;
}

type FightRecordSnapshot = { fights: FightRecord[] };

// Mirrors the query ordering: fight_date desc (nulls last), then created_at desc.
function compareFights(a: FightRecord, b: FightRecord): number {
  const da = a.fight_date ?? '';
  const db = b.fight_date ?? '';
  if (da !== db) return da < db ? 1 : -1;
  const ca = a.created_at ?? '';
  const cb = b.created_at ?? '';
  if (ca !== cb) return ca < cb ? 1 : -1;
  return 0;
}

export function useFightRecord(refetchTrigger = 0): UseFightRecordResult {
  const { user } = useAuth();
  const cacheKey = user ? `useFightRecord:${user.id}` : null;
  const cached = cacheKey ? getCached<FightRecordSnapshot>(cacheKey) : undefined;
  const [fights,  setFights]  = useState<FightRecord[]>(() => cached?.fights ?? []);
  const [loading, setLoading] = useState(cached === undefined);

  useEffect(() => {
    if (user === null) { setFights([]); setLoading(false); return; }
    let cancelled = false;
    void supabase
      .from('fight_records')
      .select('*')
      .eq('user_id', user.id)
      .order('fight_date',  { ascending: false, nullsFirst: false })
      .order('created_at',  { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          const rows = data ?? [];
          setFights(rows);
          if (cacheKey) setCached<FightRecordSnapshot>(cacheKey, { fights: rows });
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [user, refetchTrigger, cacheKey]);

  const addFight = useCallback(async (data: FightInsert): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'Nicht eingeloggt' };
    // Return the inserted row so we can patch local state without a full refetch.
    const { data: inserted, error } = await supabase
      .from('fight_records')
      .insert({ ...data, user_id: user.id })
      .select('*')
      .single();
    if (error !== null || inserted === null) return { error: error?.message ?? 'Speichern fehlgeschlagen' };
    setFights((prev) => {
      const next = [...prev, inserted].sort(compareFights);
      if (cacheKey) setCached<FightRecordSnapshot>(cacheKey, { fights: next });
      return next;
    });
    return { error: null };
  }, [user, cacheKey]);

  const deleteFight = useCallback(async (id: string): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'Nicht eingeloggt' };
    // Optimistically remove; restore on failure.
    let removed: FightRecord[] = [];
    setFights((prev) => {
      removed = prev;
      const next = prev.filter((f) => f.id !== id);
      if (cacheKey) setCached<FightRecordSnapshot>(cacheKey, { fights: next });
      return next;
    });
    const { error } = await supabase
      .from('fight_records')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error !== null) {
      setFights(removed);
      if (cacheKey) setCached<FightRecordSnapshot>(cacheKey, { fights: removed });
      return { error: error.message };
    }
    return { error: null };
  }, [user, cacheKey]);

  return { fights, loading, addFight, deleteFight };
}
