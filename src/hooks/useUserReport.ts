import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { ReportReason } from '../types/database.types';

interface UseUserReportResult {
  submitReport: (
    reportedUserId: string,
    sparringId:     string,
    reason:         ReportReason,
    details?:       string,
  ) => Promise<{ error: string | null }>;
}

export function useUserReport(): UseUserReportResult {
  const { user } = useAuth();

  const submitReport = useCallback(
    async (
      reportedUserId: string,
      sparringId:     string,
      reason:         ReportReason,
      details?:       string,
    ): Promise<{ error: string | null }> => {
      if (user === null) return { error: 'Nicht eingeloggt' };

      // Insert into user_reports
      const { error: insertError } = await supabase.from('user_reports').insert({
        reporter_id:      user.id,
        reported_user_id: reportedUserId,
        sparring_id:      sparringId,
        reason,
        details:          details ?? null,
      });

      if (insertError !== null) return { error: insertError.message };

      // Notify admin via Edge Function (fire-and-forget; errors don't block the user)
      void supabase.functions.invoke('notify-report', {
        body: {
          reportedUserId,
          reporterUserId: user.id,
          sparringId,
          reason,
          details:   details ?? null,
          timestamp: new Date().toISOString(),
        },
      });

      return { error: null };
    },
    [user],
  );

  return { submitReport };
}
