import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';
import type { TeamAnnouncement } from '../types/database.types';
import { serverErrorText } from '../utils/serverErrorText';

type AnnouncementSnapshot = { announcement: TeamAnnouncement | null };

interface UseAnnouncementResult {
  announcement: TeamAnnouncement | null;
  loading: boolean;
  deleteAnnouncement: () => Promise<{ error: string | null }>;
}

export function useAnnouncement(refetchTrigger?: number): UseAnnouncementResult {
  const { user } = useAuth();
  const cacheKey = user ? `useAnnouncement:${user.id}` : null;
  const cached = cacheKey ? getCached<AnnouncementSnapshot>(cacheKey) : undefined;
  const [announcement, setAnnouncement] = useState<TeamAnnouncement | null>(() => cached?.announcement ?? null);
  const [loading, setLoading] = useState(cached === undefined);

  const fetchAnnouncement = useCallback(async () => {
    // Resolve the user's studio_id first
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser === null) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from('profiles')
      .select('studio_id')
      .eq('id', authUser.id)
      .single();

    if (profile === null || profile.studio_id === null) {
      setAnnouncement(null);
      setLoading(false);
      return;
    }

    const now = new Date().toISOString();
    const { data, error: fetchError } = await supabase
      .from('team_announcements')
      .select('*')
      .eq('studio_id', profile.studio_id)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError !== null) {
      reportNetworkError(fetchError);
      setAnnouncement(null);
      setLoading(false);
      return;
    }
    reportNetworkSuccess();
    const item = data ?? null;
    setAnnouncement(item);
    if (cacheKey) setCached<AnnouncementSnapshot>(cacheKey, { announcement: item });
    setLoading(false);
  }, [cacheKey]);

  useEffect(() => { void fetchAnnouncement(); }, [fetchAnnouncement, refetchTrigger]);

  const deleteAnnouncement = useCallback(async (): Promise<{ error: string | null }> => {
    if (announcement === null) return { error: null };

    const { error } = await supabase
      .from('team_announcements')
      .delete()
      .eq('id', announcement.id);

    if (error !== null) return { error: serverErrorText(error.message) };
    setAnnouncement(null);
    return { error: null };
  }, [announcement]);

  return { announcement, loading, deleteAnnouncement };
}
