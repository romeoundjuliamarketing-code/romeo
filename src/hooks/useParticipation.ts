import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { calculatePoints } from '../utils/points';
import type { ScheduleParticipation } from '../types/database.types';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

interface UseParticipationResult {
  participations: ScheduleParticipation[];
  loading: boolean;
  participate: (
    scheduleId: string,
    sessionDate: string,
    pointsPer30Min: number,
    durationMin: number,
    trainingName?: string,
    trainingType?: string,
  ) => Promise<void>;
  cancelParticipation: (scheduleId: string, sessionDate: string) => Promise<void>;
  isParticipating: (scheduleId: string, sessionDate: string) => boolean;
}

export function useParticipation(): UseParticipationResult {
  const { user } = useAuth();
  const [participations, setParticipations] = useState<ScheduleParticipation[]>([]);
  const [loading, setLoading] = useState(true);

  // Load today's participations for the current user
  useEffect(() => {
    if (user === null) {
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from('schedule_participations')
      .select('*')
      .eq('user_id', user.id)
      .eq('session_date', todayIso())
      .then(({ data, error }) => {
        if (error !== null) {
          reportNetworkError(error);
        } else {
          reportNetworkSuccess();
        }
        setParticipations(data ?? []);
        setLoading(false);
      });
  }, [user]);

  const isParticipating = useCallback(
    (scheduleId: string, sessionDate: string): boolean =>
      participations.some(
        (p) => p.schedule_id === scheduleId && p.session_date === sessionDate,
      ),
    [participations],
  );

  const participate = useCallback(
    async (
      scheduleId: string,
      sessionDate: string,
      pointsPer30Min: number,
      durationMin: number,
      trainingName?: string,
      trainingType?: string,
    ): Promise<void> => {
      if (user === null) return;

      const pointsEarned = calculatePoints(durationMin, pointsPer30Min);

      // Build optimistic entry so isParticipating() flips immediately
      const optimistic: ScheduleParticipation = {
        id: `optimistic-${scheduleId}-${sessionDate}`,
        created_at: new Date().toISOString(),
        user_id: user.id,
        schedule_id: scheduleId,
        session_date: sessionDate,
        status: 'confirmed',
        points_earned: pointsEarned,
      };

      // Flip the button immediately before any network call
      setParticipations((prev) => [...prev, optimistic]);

      // 1. Insert schedule participation
      const { data: newParticipation, error: participationError } = await supabase
        .from('schedule_participations')
        .insert({
          user_id: user.id,
          schedule_id: scheduleId,
          session_date: sessionDate,
          status: 'confirmed',
          points_earned: pointsEarned,
        })
        .select()
        .single();

      if (participationError !== null || newParticipation === null) {
        // Roll back optimistic entry on failure
        setParticipations((prev) => prev.filter((p) => p.id !== optimistic.id));
        return;
      }

      // Replace optimistic entry with the real server row
      setParticipations((prev) =>
        prev.map((p) => (p.id === optimistic.id ? newParticipation : p)),
      );

      // 2. Insert workout log
      await supabase.from('workout_logs').insert({
        user_id: user.id,
        date: sessionDate,
        source: 'plan',
        completed: true,
        points: pointsEarned,
        duration_min: durationMin,
        title: trainingName ?? null,
        training_type: trainingType ?? null,
        category: 'Studio',
      });

      // 3. Credit profile points atomically + update last training date
      await Promise.all([
        supabase.rpc('add_workout_points', {
          p_user_id: user.id,
          p_date: sessionDate,
          p_points: pointsEarned,
        }),
        supabase.from('profiles').update({ last_training_date: sessionDate }).eq('id', user.id),
      ]);
    },
    [user],
  );

  const cancelParticipation = useCallback(
    async (scheduleId: string, sessionDate: string): Promise<void> => {
      if (user === null) return;

      // Capture the entry for potential rollback before any network call
      const participation = participations.find(
        (p) => p.schedule_id === scheduleId && p.session_date === sessionDate,
      );
      if (participation === undefined) return;

      const pointsToDeduct = participation.points_earned;

      // Flip the button immediately by removing the entry optimistically
      setParticipations((prev) =>
        prev.filter(
          (p) => !(p.schedule_id === scheduleId && p.session_date === sessionDate),
        ),
      );

      // 1. Delete schedule participation
      const { error } = await supabase
        .from('schedule_participations')
        .delete()
        .eq('user_id', user.id)
        .eq('schedule_id', scheduleId)
        .eq('session_date', sessionDate);

      if (error !== null) {
        // Roll back optimistic removal on failure
        setParticipations((prev) => [...prev, participation]);
        return;
      }

      // 2. Look up training name so only the matching log is deleted,
      //    not other activities (e.g. stretching) on the same day
      const { data: scheduleRow } = await supabase
        .from('studio_schedule')
        .select('training_name')
        .eq('id', scheduleId)
        .single();

      if (scheduleRow !== null) {
        await supabase
          .from('workout_logs')
          .delete()
          .eq('user_id', user.id)
          .eq('date', sessionDate)
          .eq('source', 'plan')
          .eq('title', scheduleRow.training_name);
      }

      // 3. Deduct points from profile atomically
      await supabase.rpc('deduct_workout_points', {
        p_user_id: user.id,
        p_points: pointsToDeduct,
      });
    },
    [user, participations],
  );

  return { participations, loading, participate, cancelParticipation, isParticipating };
}
