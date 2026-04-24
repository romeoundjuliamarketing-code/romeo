import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';

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

export function useStudio(refetchTrigger = 0): {
  currentStudio: Studio | null;
  loading: boolean;
  joinStudio: (studioId: string) => Promise<void>;
  searchStudios: (query: string) => Promise<Studio[]>;
  createStudio: (name: string, city: string) => Promise<Studio | null>;
} {
  const { user } = useAuth();
  const [currentStudio, setCurrentStudio] = useState<Studio | null>(null);
  const [loading, setLoading] = useState(true);

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
        setCurrentStudio(row?.studios ?? null);
        setLoading(false);
      });
  }, [user, refetchTrigger]);

  const joinStudio = useCallback(async (studioId: string): Promise<void> => {
    if (user === null) return;

    // Check if profile row already exists, then insert or update explicitly
    // (avoids RLS edge-cases with upsert)
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (existing !== null) {
      await supabase
        .from('profiles')
        .update({ studio_id: studioId })
        .eq('id', user.id);
    } else {
      await supabase
        .from('profiles')
        .insert({ id: user.id, studio_id: studioId });
    }

    const { data } = await supabase
      .from('studios')
      .select('id, name, city')
      .eq('id', studioId)
      .single();
    if (data !== null) {
      setCurrentStudio(data as Studio);
    }
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
    await joinStudio(studio.id);
    return studio;
  }, [joinStudio]);

  return { currentStudio, loading, joinStudio, searchStudios, createStudio };
}
