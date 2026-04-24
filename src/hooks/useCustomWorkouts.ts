import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import type { CustomWorkout, CustomExercise } from '../types/database.types';

export interface CreateCustomWorkoutPayload {
  title: string;
  training_type: string;
  rounds: number;
  duration_min: number;
  exercises: CustomExercise[];
}

interface UseCustomWorkouts {
  customWorkouts: CustomWorkout[];
  loading: boolean;
  create: (payload: CreateCustomWorkoutPayload) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refetch: () => void;
}

export function useCustomWorkouts(refetchTrigger = 0): UseCustomWorkouts {
  const { user } = useAuth();
  const [customWorkouts, setCustomWorkouts] = useState<CustomWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalTrigger, setInternalTrigger] = useState(0);

  const refetch = useCallback(() => setInternalTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null) {
      setLoading(false);
      return;
    }

    supabase
      .from('custom_workouts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error !== null) {
          reportNetworkError(error);
        } else {
          reportNetworkSuccess();
        }
        setCustomWorkouts(data ?? []);
        setLoading(false);
      });
  }, [user, refetchTrigger, internalTrigger]);

  async function create(payload: CreateCustomWorkoutPayload): Promise<void> {
    if (user === null) return;
    await supabase.from('custom_workouts').insert({
      user_id: user.id,
      title: payload.title,
      training_type: payload.training_type,
      rounds: payload.rounds,
      duration_min: payload.duration_min,
      exercises: payload.exercises as unknown as import('../types/database.types').Json,
    });
    refetch();
  }

  async function remove(id: string): Promise<void> {
    await supabase.from('custom_workouts').delete().eq('id', id);
    refetch();
  }

  return { customWorkouts, loading, create, remove, refetch };
}
