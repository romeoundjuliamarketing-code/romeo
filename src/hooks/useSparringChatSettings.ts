import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export interface UseSparringChatSettings {
  mediaEnabled:  boolean;
  loading:       boolean;
  toggleMedia:   () => Promise<void>;
}

export function useSparringChatSettings(
  sparringId:  string,
  isOrganizer: boolean,
): UseSparringChatSettings {
  const { user } = useAuth();
  const [mediaEnabled, setMediaEnabled] = useState(false);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('sparring_chat_settings')
        .select('media_enabled')
        .eq('sparring_id', sparringId)
        .maybeSingle();
      if (!cancelled) {
        setMediaEnabled(data?.media_enabled ?? false);
        setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [sparringId]);

  const toggleMedia = useCallback(async () => {
    if (!isOrganizer || user === null) return;
    const next = !mediaEnabled;
    const { error } = await supabase
      .from('sparring_chat_settings')
      .update({ media_enabled: next })
      .eq('sparring_id', sparringId);
    if (error === null) {
      setMediaEnabled(next);
    }
  }, [isOrganizer, mediaEnabled, sparringId, user]);

  return { mediaEnabled, loading, toggleMedia };
}
