import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useStudioTrainer(): {
  appoint: (userId: string) => Promise<{ error: string | null }>;
  remove: (userId: string) => Promise<{ error: string | null }>;
  loading: boolean;
} {
  const [loading, setLoading] = useState(false);

  const appoint = useCallback(async (userId: string) => {
    setLoading(true);
    const { error } = await supabase.rpc('appoint_studio_trainer', { p_user_id: userId });
    setLoading(false);
    return { error: error?.message ?? null };
  }, []);

  const remove = useCallback(async (userId: string) => {
    setLoading(true);
    const { error } = await supabase.rpc('remove_studio_trainer', { p_user_id: userId });
    setLoading(false);
    return { error: error?.message ?? null };
  }, []);

  return { appoint, remove, loading };
}
