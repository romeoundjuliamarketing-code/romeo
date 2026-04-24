import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import type { Database } from '../types/database.types';

type StudioScheduleInsert = Database['public']['Tables']['studio_schedule']['Insert'];

export interface StudioSessionValues {
  day_of_week:     number;
  training_name:   string;
  start_time:      string;        // "HH:MM"
  duration_min:    number;
  points_per_30min: number;
  training_type:   string;
  coach_name:      string | null;
}

interface UseStudioScheduleEditorResult {
  saving:        boolean;
  addSession:    (studioId: string, entry: StudioSessionValues) => Promise<{ error: string | null }>;
  deleteSession: (id: string) => Promise<{ error: string | null }>;
}

export function useStudioScheduleEditor(): UseStudioScheduleEditorResult {
  const [saving, setSaving] = useState(false);

  const addSession = useCallback(
    async (studioId: string, entry: StudioSessionValues): Promise<{ error: string | null }> => {
      setSaving(true);
      const insert: StudioScheduleInsert = {
        studio_id:       studioId,
        day_of_week:     entry.day_of_week,
        training_name:   entry.training_name,
        start_time:      entry.start_time.length === 5 ? `${entry.start_time}:00` : entry.start_time,
        duration_min:    entry.duration_min,
        points_per_30min: entry.points_per_30min,
        training_type:   entry.training_type,
        coach_name:      entry.coach_name ?? null,
        is_active:       true,
      };
      const { error } = await supabase.from('studio_schedule').insert(insert);
      setSaving(false);
      if (error !== null) { reportNetworkError(error); } else { reportNetworkSuccess(); }
      return { error: error?.message ?? null };
    },
    [],
  );

  const deleteSession = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      const { error } = await supabase
        .from('studio_schedule')
        .update({ is_active: false })
        .eq('id', id);
      if (error !== null) { reportNetworkError(error); } else { reportNetworkSuccess(); }
      return { error: error?.message ?? null };
    },
    [],
  );

  return { saving, addSession, deleteSession };
}
