import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';

export interface Studio {
  id: string;
  name: string;
  city: string;
}

// Shape returned by Supabase join query
interface ProfileRow {
  studio_id: string | null;
  studios: Studio | null;
}

type StudioSnapshot = { currentStudio: Studio | null };

export function useStudio(refetchTrigger = 0): {
  currentStudio: Studio | null;
  loading: boolean;
  requestJoin: (studioId: string) => Promise<{ error: string | null }>;
  leaveStudio: () => Promise<{ error: string | null }>;
  removeMember: (userId: string) => Promise<{ error: string | null }>;
  searchStudios: (query: string) => Promise<Studio[]>;
  createStudio: (name: string, city: string) => Promise<Studio | null>;
} {
  const { user } = useAuth();
  const cacheKey = user ? `useStudio:${user.id}` : null;
  const cached = cacheKey ? getCached<StudioSnapshot>(cacheKey) : undefined;
  const [currentStudio, setCurrentStudio] = useState<Studio | null>(() => cached?.currentStudio ?? null);
  const [loading, setLoading] = useState(cached === undefined);

  useEffect(() => {
    if (user === null) {
      setLoading(false);
      return;
    }
    supabase
      .from('profiles')
      .select('studio_id, studios!studio_id(id, name, city)')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error !== null) {
          reportNetworkError(error);
        } else {
          reportNetworkSuccess();
        }
        const row = data as ProfileRow | null;
        const studio = row?.studios ?? null;
        setCurrentStudio(studio);
        if (error === null && cacheKey) setCached<StudioSnapshot>(cacheKey, { currentStudio: studio });
        setLoading(false);
      });
  }, [user, refetchTrigger, cacheKey]);

  const requestJoin = useCallback(async (studioId: string): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'Nicht angemeldet.' };
    const { error } = await supabase.rpc('request_studio_join', { p_studio_id: studioId });
    if (error !== null) return { error: error.message };
    return { error: null };
  }, [user]);

  const leaveStudio = useCallback(async (): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'Nicht angemeldet.' };
    const { error } = await supabase.rpc('leave_studio');
    if (error !== null) return { error: error.message };
    setCurrentStudio(null);
    if (cacheKey) setCached<StudioSnapshot>(cacheKey, { currentStudio: null });
    return { error: null };
  }, [user, cacheKey]);

  const removeMember = useCallback(async (userId: string): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'Nicht angemeldet.' };
    const { error } = await supabase.rpc('remove_studio_member', { p_user_id: userId });
    if (error !== null) return { error: error.message };
    return { error: null };
  }, [user]);

  const searchStudios = useCallback(async (query: string): Promise<Studio[]> => {
    const trimmed = query.trim();
    const req = supabase.from('studios').select('id, name, city').order('name').limit(30);
    const { data } = trimmed.length === 0
      ? await req
      : await req.or(`name.ilike.%${trimmed}%,city.ilike.%${trimmed}%`);
    return (data ?? []) as Studio[];
  }, []);

  const createStudio = useCallback(async (name: string, city: string): Promise<Studio | null> => {
    const { data, error } = await supabase.rpc('create_studio_with_owner', {
      p_name: name.trim(),
      p_city: city.trim(),
    });
    if (error !== null || data === null || data.length === 0) return null;
    const studio = data[0] as Studio;
    // The RPC already sets profiles.studio_id server-side; update local state.
    setCurrentStudio(studio);
    if (cacheKey) setCached<StudioSnapshot>(cacheKey, { currentStudio: studio });
    return studio;
  }, [cacheKey]);

  return { currentStudio, loading, requestJoin, leaveStudio, removeMember, searchStudios, createStudio };
}
