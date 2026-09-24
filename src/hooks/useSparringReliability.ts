import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';

export interface SparringReliability {
  attended: number;
  committed: number;
  loading: boolean;
}

type ReliabilitySnapshot = { attended: number; committed: number };

const EMPTY: ReliabilitySnapshot = { attended: 0, committed: 0 };

// Reads the objective reliability quote via the get_reliability RPC — the
// only place the underlying status sets are defined (see CLAUDE.md /
// sparring-verbindlichkeit spec 6.7). Never recompute attended/committed
// from raw sparring_signups statuses in the client.
export function useSparringReliability(
  userId: string | null,
  refetchTrigger = 0,
): SparringReliability {
  const cacheKey = userId !== null ? `useSparringReliability:${userId}` : null;
  const cached = cacheKey ? getCached<ReliabilitySnapshot>(cacheKey) : undefined;

  const [snapshot, setSnapshot] = useState<ReliabilitySnapshot>(() => cached ?? EMPTY);
  const [loading, setLoading] = useState(cached === undefined);

  useEffect(() => {
    if (userId === null) {
      setSnapshot(EMPTY);
      setLoading(false);
      return;
    }

    let cancelled = false;

    // Keep showing cached data while revalidating — don't flash a spinner.
    if (cacheKey && getCached<ReliabilitySnapshot>(cacheKey) === undefined) {
      setLoading(true);
    }

    void (async () => {
      const { data, error } = await supabase.rpc('get_reliability', { p_user_id: userId });

      if (cancelled) return;

      if (error !== null) {
        reportNetworkError(error);
        setLoading(false);
        return;
      }

      const row = (data ?? [])[0] ?? EMPTY;
      const result: ReliabilitySnapshot = { attended: row.attended, committed: row.committed };

      reportNetworkSuccess();
      setSnapshot(result);
      if (cacheKey) setCached<ReliabilitySnapshot>(cacheKey, result);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [userId, refetchTrigger, cacheKey]);

  return { attended: snapshot.attended, committed: snapshot.committed, loading };
}
