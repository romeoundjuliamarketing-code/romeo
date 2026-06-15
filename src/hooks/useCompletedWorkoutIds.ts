import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';

// Returns ISO date strings for Mon–Sun of the current week
function currentWeekRange(): { from: string; to: string } {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // Mon=0 … Sun=6
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    from: monday.toISOString().split('T')[0],
    to:   sunday.toISOString().split('T')[0],
  };
}

type CompletedWorkoutIdsSnapshot = { titles: string[] };

// Returns the Set of workout titles (source='module') completed this week.
// Matched by title since workout_logs has no separate source_id column.
export function useCompletedWorkoutIds(refetchTrigger = 0): Set<string> {
  const { user } = useAuth();
  const cacheKey = user ? `useCompletedWorkoutIds:${user.id}` : null;
  const cached = cacheKey ? getCached<CompletedWorkoutIdsSnapshot>(cacheKey) : undefined;
  const [completedTitles, setCompletedTitles] = useState<Set<string>>(() => new Set(cached?.titles ?? []));

  const load = useCallback(async () => {
    if (user === null) return;
    const { from, to } = currentWeekRange();

    const { data } = await supabase
      .from('workout_logs')
      .select('title')
      .eq('user_id', user.id)
      .eq('source', 'module')
      .gte('date', from)
      .lte('date', to);

    if (data !== null) {
      const titles = data.map((r) => r.title ?? '');
      setCompletedTitles(new Set(titles));
      if (cacheKey) setCached<CompletedWorkoutIdsSnapshot>(cacheKey, { titles });
    }
  }, [user, cacheKey]);

  useEffect(() => {
    void load();
  }, [load, refetchTrigger]);

  return completedTitles;
}
