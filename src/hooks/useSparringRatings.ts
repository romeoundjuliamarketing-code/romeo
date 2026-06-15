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

interface UseSparringRatingsResult {
  averageStars:   number | null;
  ratingCount:    number;
  existingRating: ExistingRating | null;
  submitRating: (
    sparringId:   string,
    ratedUserId:  string,
    stars:        number,
    comment:      string,
  ) => Promise<{ error: string | null }>;
  canRate: (sparringScheduledAt: string) => boolean;
}

// Returns true when now is between scheduledAt and scheduledAt + 7 days
function canRateWindow(sparringScheduledAt: string): boolean {
  const now        = Date.now();
  const scheduled  = new Date(sparringScheduledAt).getTime();
  const windowEnd  = scheduled + 7 * 24 * 60 * 60 * 1000;
  return now >= scheduled && now <= windowEnd;
}

type SparringRatingsSnapshot = { summary: RatingSummary; existingRating: ExistingRating | null };

export function useSparringRatings(
  ratedUserId:        string,
  sparringId:         string,
  refetchTrigger = 0,
): UseSparringRatingsResult {
  const { user } = useAuth();
  // Key includes ratedUserId and sparringId since the data depends on all three
  const cacheKey = user ? `useSparringRatings:${user.id}:${ratedUserId}:${sparringId}` : null;
  const cached = cacheKey ? getCached<SparringRatingsSnapshot>(cacheKey) : undefined;

  const [summary,        setSummary]        = useState<RatingSummary>(() => cached?.summary ?? { averageStars: null, ratingCount: 0 });
  const [existingRating, setExistingRating] = useState<ExistingRating | null>(() => cached?.existingRating ?? null);

  // Load average + own existing rating
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // All ratings for this user (for average)
      const { data: allRatings } = await supabase
        .from('sparring_ratings')
        .select('stars')
        .eq('rated_user_id', ratedUserId);

      // Compute the summary once; reuse it for both state and the cache snapshot.
      const rows = allRatings ?? [];
      const computedSummary: RatingSummary = rows.length === 0
        ? { averageStars: null, ratingCount: 0 }
        : { averageStars: rows.reduce((sum, r) => sum + r.stars, 0) / rows.length, ratingCount: rows.length };

      if (!cancelled) {
        setSummary(computedSummary);
      }

      // Own rating for this sparring
      if (user !== null) {
        const { data: own } = await supabase
          .from('sparring_ratings')
          .select('stars, comment')
          .eq('rated_user_id', ratedUserId)
          .eq('sparring_id',   sparringId)
          .eq('rater_id',      user.id)
          .maybeSingle();

        if (!cancelled) {
          const ownRating = own !== null ? { stars: own.stars, comment: own.comment } : null;
          setExistingRating(ownRating);
          // Cache after both summary and existingRating are known
          if (cacheKey) setCached<SparringRatingsSnapshot>(cacheKey, { summary: computedSummary, existingRating: ownRating });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [ratedUserId, sparringId, user, refetchTrigger]);

  const submitRating = useCallback(
    async (
      sid:         string,
      ruid:        string,
      stars:       number,
      comment:     string,
    ): Promise<{ error: string | null }> => {
      if (user === null) return { error: 'Nicht eingeloggt' };

      const { error } = await supabase.from('sparring_ratings').insert({
        rater_id:      user.id,
        rated_user_id: ruid,
        sparring_id:   sid,
        stars,
        comment,
      });

      return { error: error?.message ?? null };
    },
    [user],
  );

  return {
    averageStars:   summary.averageStars,
    ratingCount:    summary.ratingCount,
    existingRating,
    submitRating,
    canRate:        canRateWindow,
  };
}
