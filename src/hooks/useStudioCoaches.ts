import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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
  removeCoach: (userId: string) => Promise<{ error: string | null }>;
  refetch: () => void;
} {
  const [coaches, setCoaches] = useState<StudioCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (studioId.trim().length === 0) return;

    void (async () => {
      setLoading(true);
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

      setCoaches(
        (data ?? []).map((row) => {
          const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          return {
            id: row.id,
            userId: row.user_id,
            role: row.role ?? null,
            name: (p as { name: string | null } | null)?.name ?? null,
            avatarUrl: (p as { avatar_url: string | null } | null)?.avatar_url ?? null,
          };
        }),
      );
      setLoading(false);
    })();
  }, [studioId, trigger]);

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

  return { coaches, loading, addCoach, removeCoach, refetch };
}
