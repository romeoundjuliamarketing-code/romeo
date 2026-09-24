import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { SparringParticipant } from '../types/database.types';

// Loads the participant list (slot holders + waitlist + recorded attendance)
// for one sparring via the get_sparring_participants RPC — the single source
// of truth for status/waitlist position (see supabase/migrations/
// 20260911120100_sparring_commitment_rpcs.sql). Cancelled/expired rows are
// never returned.
export function useSparringParticipants(sparringId: string | null, refreshTrigger = 0): {
  participants: SparringParticipant[];
  loading: boolean;
} {
  const [participants, setParticipants] = useState<SparringParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sparringId === null) {
      setParticipants([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      const { data, error } = await supabase.rpc('get_sparring_participants', { p_sparring_id: sparringId });
      if (cancelled) return;
      if (error !== null) {
        setLoading(false);
        return;
      }
      setParticipants(data ?? []);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [sparringId, refreshTrigger]);

  return { participants, loading };
}
