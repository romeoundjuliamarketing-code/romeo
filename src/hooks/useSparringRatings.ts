import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

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

export function useSparringRatings(
  ratedUserId:        string,
  sparringId:         string,
  refetchTrigger = 0,
): UseSparringRatingsResult {
  const { user } = useAuth();

  const [summary,        setSummary]        = useState<RatingSummary>({ averageStars: null, ratingCount: 0 });
  const [existingRating, setExistingRating] = useState<ExistingRating | null>(null);

  // Load average + own existing rating
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // All ratings for this user (for average)
      const { data: allRatings } = await supabase
        .from('sparring_ratings')
        .select('stars')
        .eq('rated_user_id', ratedUserId);

      if (!cancelled) {
        const rows = allRatings ?? [];
        if (rows.length === 0) {
          setSummary({ averageStars: null, ratingCount: 0 });
        } else {
          const total = rows.reduce((sum, r) => sum + r.stars, 0);
          setSummary({ averageStars: total / rows.length, ratingCount: rows.length });
        }
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
          setExistingRating(own !== null ? { stars: own.stars, comment: own.comment } : null);
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
