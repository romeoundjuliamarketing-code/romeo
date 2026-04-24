import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import type { TeamAnnouncement } from '../types/database.types';

interface UseAnnouncementResult {
  announcement: TeamAnnouncement | null;
  loading: boolean;
  postAnnouncement: (message: string, expiresAt: string | null) => Promise<{ error: string | null }>;
  deleteAnnouncement: () => Promise<{ error: string | null }>;
}

export function useAnnouncement(refetchTrigger?: number): UseAnnouncementResult {
  const [announcement, setAnnouncement] = useState<TeamAnnouncement | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnnouncement = useCallback(async () => {
    setLoading(true);

    // Resolve the user's studio_id first
    const { data: { user } } = await supabase.auth.getUser();
    if (user === null) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from('profiles')
      .select('studio_id')
      .eq('id', user.id)
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
    } else {
      reportNetworkSuccess();
    }
    setAnnouncement(data ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchAnnouncement(); }, [fetchAnnouncement, refetchTrigger]);

  const postAnnouncement = useCallback(async (message: string, expiresAt: string | null): Promise<{ error: string | null }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user === null) return { error: 'Nicht eingeloggt' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('studio_id, is_coach')
      .eq('id', user.id)
      .single();

    if (profile === null || profile.studio_id === null) return { error: 'Kein Team beigetreten' };
    if (!profile.is_coach) return { error: 'Nur Trainer können Ankündigungen posten' };

    const { error } = await supabase.from('team_announcements').insert({
      studio_id:  profile.studio_id,
      coach_id:   user.id,
      message:    message.trim(),
      expires_at: expiresAt,
    });

    if (error !== null) return { error: error.message };
    void fetchAnnouncement();
    return { error: null };
  }, [fetchAnnouncement]);

  const deleteAnnouncement = useCallback(async (): Promise<{ error: string | null }> => {
    if (announcement === null) return { error: null };

    const { error } = await supabase
      .from('team_announcements')
      .delete()
      .eq('id', announcement.id);

    if (error !== null) return { error: error.message };
    setAnnouncement(null);
    return { error: null };
  }, [announcement]);

  return { announcement, loading, postAnnouncement, deleteAnnouncement };
}
