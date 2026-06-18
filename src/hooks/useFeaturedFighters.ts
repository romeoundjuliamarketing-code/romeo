import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';

export interface FeaturedFighter {
  id: string;
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  weightClass: string | null;
  discipline: string | null;
}

export function useFeaturedFighters(studioId: string): {
  fighters: FeaturedFighter[];
  loading: boolean;
  addFighter: (userId: string) => Promise<{ error: string | null }>;
  addFighters: (userIds: string[]) => Promise<{ error: string | null }>;
  removeFighter: (userId: string) => Promise<{ error: string | null }>;
  refetch: () => void;
} {
  const cacheKey = studioId.trim().length > 0 ? `useFeaturedFighters:${studioId}` : null;
  const cached = cacheKey ? getCached<FeaturedFighter[]>(cacheKey) : undefined;
  const [fighters, setFighters] = useState<FeaturedFighter[]>(() => cached ?? []);
  // Only show the blocking spinner when there is no cached data to render.
  const [loading, setLoading] = useState(cached === undefined);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (studioId.trim().length === 0) return;

    let cancelled = false;
    // Stale-while-revalidate: serve cached data instantly, refetch in background.
    const hasCache = cacheKey ? getCached<FeaturedFighter[]>(cacheKey) !== undefined : false;
    if (!hasCache) setLoading(true);

    void (async () => {
      const { data } = await supabase
        .from('studio_featured_fighters')
        .select(`
          id,
          user_id,
          profiles:user_id (
            name,
            avatar_url,
            weight_class
          )
        `)
        .eq('studio_id', studioId)
        .order('added_at', { ascending: true });
      if (cancelled) return;

      const mapped: FeaturedFighter[] = (data ?? []).map((row) => {
        const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          id: row.id,
          userId: row.user_id,
          name: (p as { name: string | null } | null)?.name ?? null,
          avatarUrl: (p as { avatar_url: string | null } | null)?.avatar_url ?? null,
          weightClass: (p as { weight_class: string | null } | null)?.weight_class ?? null,
          discipline: null,
        };
      });
      setFighters(mapped);
      if (cacheKey) setCached<FeaturedFighter[]>(cacheKey, mapped);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [studioId, trigger, cacheKey]);

  const addFighter = useCallback(async (userId: string): Promise<{ error: string | null }> => {
    const { error } = await supabase
      .from('studio_featured_fighters')
      .insert({ studio_id: studioId, user_id: userId });
    if (error !== null) return { error: error.message };
    refetch();
    return { error: null };
  }, [studioId, refetch]);

  const addFighters = useCallback(async (userIds: string[]): Promise<{ error: string | null }> => {
    if (userIds.length === 0) return { error: null };
    const { error } = await supabase
      .from('studio_featured_fighters')
      .insert(userIds.map((id) => ({ studio_id: studioId, user_id: id })));
    if (error !== null) return { error: error.message };
    refetch();
    return { error: null };
  }, [studioId, refetch]);

  const removeFighter = useCallback(async (userId: string): Promise<{ error: string | null }> => {
    const { error } = await supabase
      .from('studio_featured_fighters')
      .delete()
      .eq('studio_id', studioId)
      .eq('user_id', userId);
    if (error !== null) return { error: error.message };
    refetch();
    return { error: null };
  }, [studioId, refetch]);

  return { fighters, loading, addFighter, addFighters, removeFighter, refetch };
}
