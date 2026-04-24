import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { FightRecord, FightRecordInsert } from '../types/database.types';

export type { FightRecord };

type FightInsert = Omit<FightRecordInsert, 'user_id'>;

interface UseFightRecordResult {
  fights:      FightRecord[];
  loading:     boolean;
  addFight:    (data: FightInsert) => Promise<{ error: string | null }>;
  deleteFight: (id: string)        => Promise<{ error: string | null }>;
}

export function useFightRecord(refetchTrigger = 0): UseFightRecordResult {
  const { user } = useAuth();
  const [fights,  setFights]  = useState<FightRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === null) { setFights([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    void supabase
      .from('fight_records')
      .select('*')
      .eq('user_id', user.id)
      .order('fight_date',  { ascending: false, nullsFirst: false })
      .order('created_at',  { ascending: false })
      .then(({ data }) => {
        if (!cancelled) { setFights(data ?? []); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [user, refetchTrigger]);

  const addFight = useCallback(async (data: FightInsert): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'Nicht eingeloggt' };
    const { error } = await supabase
      .from('fight_records')
      .insert({ ...data, user_id: user.id });
    return { error: error?.message ?? null };
  }, [user]);

  const deleteFight = useCallback(async (id: string): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'Nicht eingeloggt' };
    const { error } = await supabase
      .from('fight_records')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  return { fights, loading, addFight, deleteFight };
}
