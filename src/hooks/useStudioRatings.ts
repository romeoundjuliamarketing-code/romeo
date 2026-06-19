import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';

interface RatingSummary {
  averageStars: number | null;
  ratingCount:  number;
}

interface ExistingRating {
  stars:   number;
  comment: string;
}

interface UseStudioRatingsResult {
  averageStars:   number | null;
  ratingCount:    number;
  existingRating: ExistingRating | null;
  submitRating: (
    studioId: string,
    stars:    number,
    comment:  string,
  ) => Promise<{ error: string | null }>;
}

type StudioRatingsSnapshot = { summary: RatingSummary; existingRating: ExistingRating | null };

export function useStudioRatings(
  studioId:       string,
  refetchTrigger = 0,
): UseStudioRatingsResult {
  const { user } = useAuth();
  const cacheKey = user ? `useStudioRatings:${user.id}:${studioId}` : null;
  const cached = cacheKey ? getCached<StudioRatingsSnapshot>(cacheKey) : undefined;

  const [summary,        setSummary]        = useState<RatingSummary>(() => cached?.summary ?? { averageStars: null, ratingCount: 0 });
  const [existingRating, setExistingRating] = useState<ExistingRating | null>(() => cached?.existingRating ?? null);

  // Load average + own existing rating
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // All ratings for this studio (for the average)
      const { data: allRatings } = await supabase
        .from('studio_ratings')
        .select('stars')
        .eq('studio_id', studioId);

      const rows = allRatings ?? [];
      const computedSummary: RatingSummary = rows.length === 0
        ? { averageStars: null, ratingCount: 0 }
        : { averageStars: rows.reduce((sum, r) => sum + r.stars, 0) / rows.length, ratingCount: rows.length };

      if (!cancelled) {
        setSummary(computedSummary);
      }

      // Own rating for this studio
      if (user !== null) {
        const { data: own } = await supabase
          .from('studio_ratings')
          .select('stars, comment')
          .eq('studio_id', studioId)
          .eq('rater_id',  user.id)
          .maybeSingle();

        if (!cancelled) {
          const ownRating = own !== null ? { stars: own.stars, comment: own.comment } : null;
          setExistingRating(ownRating);
          if (cacheKey) setCached<StudioRatingsSnapshot>(cacheKey, { summary: computedSummary, existingRating: ownRating });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [studioId, user, refetchTrigger]);

  const submitRating = useCallback(
    async (
      sid:     string,
      stars:   number,
      comment: string,
    ): Promise<{ error: string | null }> => {
      if (user === null) return { error: 'Nicht eingeloggt' };

      // Upsert on (rater_id, studio_id) so re-rating updates the existing row
      const { error } = await supabase.from('studio_ratings').upsert(
        {
          rater_id:   user.id,
          studio_id:  sid,
          stars,
          comment,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'rater_id,studio_id' },
      );

      return { error: error?.message ?? null };
    },
    [user],
  );

  return {
    averageStars:   summary.averageStars,
    ratingCount:    summary.ratingCount,
    existingRating,
    submitRating,
  };
}
