import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import type { ClarityValue, SparringChallenge } from '../data/sparringChallenges';

interface UseChallengeRatingResult {
  ratedIds:   Set<string>;
  submit:     (challengeId: string, clarity: ClarityValue) => void;
  // First card of the given list the user has not rated yet, or null. Callers ask at
  // most once — the clarity question must never interrupt a running flow.
  pickUnrated: (cards: SparringChallenge[]) => SparringChallenge | null;
}

// Owns everything about clarity ratings: which cards the user already rated and the
// write itself. Where to ask is the caller's decision — a session asks once at the end,
// the quick draw asks inline after a card was marked done.
export function useChallengeRating(): UseChallengeRatingResult {
  const { user } = useAuth();
  const cacheKey = user ? `useChallengeRating:${user.id}` : null;
  // queryCache survives app launches, so a value written by an older build can still
  // be sitting under this key in a different shape — read it defensively.
  const cachedRaw = cacheKey ? getCached<unknown>(cacheKey) : undefined;
  const cached = Array.isArray(cachedRaw) ? (cachedRaw as string[]) : undefined;

  const [ratedIds, setRatedIds] = useState<Set<string>>(() => new Set(cached ?? []));

  // Replaces the set and mirrors it into the query cache. Kept out of the state
  // updater so the cache write cannot run twice for one change.
  const applyRatedIds = useCallback((next: Set<string>): void => {
    setRatedIds(next);
    if (cacheKey) setCached<string[]>(cacheKey, Array.from(next));
  }, [cacheKey]);

  useEffect(() => {
    if (user === null) return;
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from('challenge_ratings')
        .select('challenge_id')
        .eq('user_id', user.id);

      if (cancelled) return;

      if (error !== null) {
        // Harmless: without the list a card may simply be asked about twice.
        reportNetworkError(error);
        return;
      }

      reportNetworkSuccess();
      const ids = (data ?? []).map((row) => row.challenge_id);
      // Keep the existing set when nothing changed — this lands mid-animation and
      // a new Set would re-render the whole deck for nothing.
      setRatedIds((prev) => (
        prev.size === ids.length && ids.every((id) => prev.has(id)) ? prev : new Set(ids)
      ));
      if (cacheKey) setCached<string[]>(cacheKey, ids);
    })();

    return () => { cancelled = true; };
  }, [user, cacheKey]);

  const pickUnrated = useCallback((cards: SparringChallenge[]): SparringChallenge | null => (
    cards.find((card) => !ratedIds.has(card.id)) ?? null
  ), [ratedIds]);

  const submit = useCallback(
    (challengeId: string, clarity: ClarityValue): void => {
      if (user === null) return;

      // Optimistic: the question disappears immediately.
      const optimistic = new Set(ratedIds);
      optimistic.add(challengeId);
      applyRatedIds(optimistic);

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
          // Roll back so the card is asked about again next time.
          const rolledBack = new Set(optimistic);
          rolledBack.delete(challengeId);
          applyRatedIds(rolledBack);
          return;
        }

        reportNetworkSuccess();
      })();
    },
    [user, ratedIds, applyRatedIds],
  );

  return { ratedIds, submit, pickUnrated };
}
