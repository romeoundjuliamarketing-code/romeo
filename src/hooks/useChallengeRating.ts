import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';

interface UseChallengeRatingResult {
  ratedIds: Set<string>;
  submit:   (challengeId: string, clarity: 1 | 2 | 3) => void;
  loading:  boolean;
}

type ChallengeRatingSnapshot = { ids: string[] };

// Tracks which sparring challenge cards the user has already rated for clarity,
// so the rating row is shown at most once per card. Load is fire-and-forget and
// cached: a failed load simply means the question may be asked again, which is
// harmless (see spec "Kein Netz beim Laden").
export function useChallengeRating(): UseChallengeRatingResult {
  const { user } = useAuth();
  const cacheKey = user ? `useChallengeRating:${user.id}` : null;
  const cached = cacheKey ? getCached<ChallengeRatingSnapshot>(cacheKey) : undefined;

  const [ratedIds, setRatedIds] = useState<Set<string>>(() => new Set(cached?.ids ?? []));
  const [loading,  setLoading]  = useState(cached === undefined);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (user === null) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('challenge_ratings')
        .select('challenge_id')
        .eq('user_id', user.id);

      if (cancelled) return;

      if (error !== null) {
        reportNetworkError(error);
        setLoading(false);
        return;
      }

      reportNetworkSuccess();
      const ids = (data ?? []).map((row) => row.challenge_id);
      setRatedIds(new Set(ids));
      if (cacheKey) setCached<ChallengeRatingSnapshot>(cacheKey, { ids });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user, cacheKey]);

  const submit = useCallback(
    (challengeId: string, clarity: 1 | 2 | 3): void => {
      if (user === null) return;

      // Optimistic: the question disappears immediately.
      setRatedIds((prev) => {
        const next = new Set(prev);
        next.add(challengeId);
        if (cacheKey) setCached<ChallengeRatingSnapshot>(cacheKey, { ids: Array.from(next) });
        return next;
      });

      void (async () => {
        const { error } = await supabase.from('challenge_ratings').upsert(
          {
            user_id:      user.id,
            challenge_id: challengeId,
            clarity,
            updated_at:   new Date().toISOString(),
          },
          { onConflict: 'user_id,challenge_id' },
        );

        if (error !== null) {
          reportNetworkError(error);
          // Roll back so the card is asked again next time.
          setRatedIds((prev) => {
            const next = new Set(prev);
            next.delete(challengeId);
            if (cacheKey) setCached<ChallengeRatingSnapshot>(cacheKey, { ids: Array.from(next) });
            return next;
          });
          return;
        }

        reportNetworkSuccess();
      })();
    },
    [user, cacheKey],
  );

  return { ratedIds, submit, loading };
}
