import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';

export interface StudioCoach {
  id: string;
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  role: string | null;
}

export function useStudioCoaches(studioId: string): {
  coaches: StudioCoach[];
  loading: boolean;
  addCoach: (userId: string, role: string | null) => Promise<{ error: string | null }>;
  addCoaches: (userIds: string[]) => Promise<{ error: string | null }>;
  updateCoachRole: (userId: string, role: string | null) => Promise<{ error: string | null }>;
  removeCoach: (userId: string) => Promise<{ error: string | null }>;
  refetch: () => void;
} {
  const cacheKey = studioId.trim().length > 0 ? `useStudioCoaches:${studioId}` : null;
  const cached = cacheKey ? getCached<StudioCoach[]>(cacheKey) : undefined;
  const [coaches, setCoaches] = useState<StudioCoach[]>(() => cached ?? []);
  // Only show the blocking spinner when there is no cached data to render.
  const [loading, setLoading] = useState(cached === undefined);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (studioId.trim().length === 0) return;

    let cancelled = false;
    // Stale-while-revalidate: serve cached data instantly, refetch in background.
    const hasCache = cacheKey ? getCached<StudioCoach[]>(cacheKey) !== undefined : false;
    if (!hasCache) setLoading(true);

    void (async () => {
      const { data } = await supabase
        .from('studio_coaches')
        .select(`
          id,
          user_id,
          role,
          profiles:user_id (
            name,
            avatar_url
          )
        `)
        .eq('studio_id', studioId)
        .order('position', { ascending: true })
        .order('added_at', { ascending: true });
      if (cancelled) return;

      const mapped: StudioCoach[] = (data ?? []).map((row) => {
        const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          id: row.id,
          userId: row.user_id,
          role: row.role ?? null,
          name: (p as { name: string | null } | null)?.name ?? null,
          avatarUrl: (p as { avatar_url: string | null } | null)?.avatar_url ?? null,
        };
      });
      setCoaches(mapped);
      if (cacheKey) setCached<StudioCoach[]>(cacheKey, mapped);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [studioId, trigger, cacheKey]);

  const addCoach = useCallback(
    async (userId: string, role: string | null): Promise<{ error: string | null }> => {
      const { error } = await supabase
        .from('studio_coaches')
        .insert({ studio_id: studioId, user_id: userId, role });
      if (error !== null) return { error: error.message };
      refetch();
      return { error: null };
    },
    [studioId, refetch],
  );

  const addCoaches = useCallback(
    async (userIds: string[]): Promise<{ error: string | null }> => {
      if (userIds.length === 0) return { error: null };
      const { error } = await supabase
        .from('studio_coaches')
        .insert(userIds.map((id) => ({ studio_id: studioId, user_id: id, role: null })));
      if (error !== null) return { error: error.message };
      refetch();
      return { error: null };
    },
    [studioId, refetch],
  );

  const updateCoachRole = useCallback(
    async (userId: string, role: string | null): Promise<{ error: string | null }> => {
      const { error } = await supabase
        .from('studio_coaches')
        .update({ role })
        .eq('studio_id', studioId)
        .eq('user_id', userId);
      if (error !== null) return { error: error.message };
      refetch();
      return { error: null };
    },
    [studioId, refetch],
  );

  const removeCoach = useCallback(
    async (userId: string): Promise<{ error: string | null }> => {
      const { error } = await supabase
        .from('studio_coaches')
        .delete()
        .eq('studio_id', studioId)
        .eq('user_id', userId);
      if (error !== null) return { error: error.message };
      refetch();
      return { error: null };
    },
    [studioId, refetch],
  );

  return { coaches, loading, addCoach, addCoaches, updateCoachRole, removeCoach, refetch };
}
