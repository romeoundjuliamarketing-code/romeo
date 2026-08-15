import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import type { ClarityValue, SparringChallenge } from '../data/sparringChallenges';

// How often a played card is put up for rating. The counter runs per session.
const PROMPT_EVERY_N_CARDS = 4;

interface UseChallengeRatingResult {
  ratedIds:      Set<string>;
  submit:        (challengeId: string, clarity: ClarityValue) => void;
  // Card the user should be asked about right now, or null.
  promptCard:    SparringChallenge | null;
  // Report a card the user just put aside; may raise a prompt for it.
  notePlayed:    (challenge: SparringChallenge | null) => void;
  dismissPrompt: () => void;
}

// Owns everything about clarity ratings: which cards the user already rated, when to
// ask again, and the write itself. Keeping the cadence here rather than in the screen
// means the whole policy lives next to the data it depends on.
export function useChallengeRating(): UseChallengeRatingResult {
  const { user } = useAuth();
  const cacheKey = user ? `useChallengeRating:${user.id}` : null;
  // queryCache survives app launches, so a value written by an older build can still
  // be sitting under this key in a different shape — read it defensively.
  const cachedRaw = cacheKey ? getCached<unknown>(cacheKey) : undefined;
  const cached = Array.isArray(cachedRaw) ? (cachedRaw as string[]) : undefined;

  const [ratedIds, setRatedIds] = useState<Set<string>>(() => new Set(cached ?? []));
  const [promptCard, setPromptCard] = useState<SparringChallenge | null>(null);
  const playedCount = useRef(0);

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

  const notePlayed = useCallback((challenge: SparringChallenge | null): void => {
    // Counts every draw, including the very first one that replaces nothing — the
    // cadence is "every 4th draw", not "every 4th card with a predecessor".
    playedCount.current += 1;
    if (challenge === null) return;
    if (playedCount.current % PROMPT_EVERY_N_CARDS !== 0) return;
    if (ratedIds.has(challenge.id)) return;
    setPromptCard(challenge);
  }, [ratedIds]);

  const dismissPrompt = useCallback((): void => setPromptCard(null), []);

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

  return { ratedIds, submit, promptCard, notePlayed, dismissPrompt };
}
