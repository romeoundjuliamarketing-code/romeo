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
  comment: string | null;
}

interface UseVenueRatingsResult {
  averageStars:   number | null;
  ratingCount:    number;
  existingRating: ExistingRating | null;
  submitRating: (
    venueId: string,
    stars:   number,
    comment: string,
  ) => Promise<{ error: string | null }>;
}

type VenueRatingsSnapshot = { summary: RatingSummary; existingRating: ExistingRating | null };

export function useVenueRatings(
  venueId:        string,
  refetchTrigger = 0,
): UseVenueRatingsResult {
  const { user } = useAuth();
  const cacheKey = user ? `useVenueRatings:${user.id}:${venueId}` : null;
  const cached = cacheKey ? getCached<VenueRatingsSnapshot>(cacheKey) : undefined;

  const [summary,        setSummary]        = useState<RatingSummary>(() => cached?.summary ?? { averageStars: null, ratingCount: 0 });
  const [existingRating, setExistingRating] = useState<ExistingRating | null>(() => cached?.existingRating ?? null);

  // Load average + own existing rating
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // All ratings for this venue (for the average)
      const { data: allRatings } = await supabase
        .from('venue_ratings')
        .select('stars')
        .eq('venue_id', venueId);

      if (cancelled) return;

      const rows = allRatings ?? [];
      const computedSummary: RatingSummary = rows.length === 0
        ? { averageStars: null, ratingCount: 0 }
        : { averageStars: rows.reduce((sum, r) => sum + r.stars, 0) / rows.length, ratingCount: rows.length };

      setSummary(computedSummary);

      // Own rating for this venue
      if (user !== null) {
        const { data: own } = await supabase
          .from('venue_ratings')
          .select('stars, comment')
          .eq('venue_id', venueId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!cancelled) {
          const ownRating = own !== null ? { stars: own.stars, comment: own.comment } : null;
          setExistingRating(ownRating);
          if (cacheKey) setCached<VenueRatingsSnapshot>(cacheKey, { summary: computedSummary, existingRating: ownRating });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [venueId, user, refetchTrigger, cacheKey]);

  const submitRating = useCallback(
    async (
      vid:     string,
      stars:   number,
      comment: string,
    ): Promise<{ error: string | null }> => {
      if (user === null) return { error: 'Nicht eingeloggt' };

      // Upsert on (user_id, venue_id) so re-rating updates the existing row
      const { error } = await supabase.from('venue_ratings').upsert(
        {
          user_id:  user.id,
          venue_id: vid,
          stars,
          comment,
        },
        { onConflict: 'user_id,venue_id' },
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
