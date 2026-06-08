import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';

interface WorkoutStats {
  completedDayIndices: number[]; // 0=Mon … 6=Sun for the current week
  totalPoints: number;
  totalWorkouts: number; // all-time completed workout count
  streak: number; // consecutive completed days ending today or yesterday
  rank: number | null; // position within the user's studio by total_points
  trainingTypePoints: Record<string, number>; // points per training_type, all-time
  loading: boolean;
  refetch: () => void;
}

// Returns Monday of the ISO week that contains the given date
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift so Mon = 0
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Use local date components to avoid UTC-offset shifting the date boundary
function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Counts consecutive days ending on today or yesterday
function calcStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  const sorted = [...new Set(dates)].sort().reverse(); // unique, newest first
  const today = toIso(new Date());
  const yesterday = toIso(new Date(Date.now() - 86_400_000));

  // Streak must touch today or yesterday to be active
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T12:00:00');
    const curr = new Date(sorted[i] + 'T12:00:00');
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86_400_000);
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

type ProfileRow = { total_points: number; studio_id: string | null };

export function useWorkoutStats(refetchTrigger = 0): WorkoutStats {
  const { user } = useAuth();
  const [completedDayIndices, setCompletedDayIndices] = useState<number[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  const [trainingTypePoints, setTrainingTypePoints] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [internalTrigger, setInternalTrigger] = useState(0);

  const refetch = useCallback(() => setInternalTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null) {
      setLoading(false);
      return;
    }

    const monday = getMondayOfWeek(new Date());
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    Promise.all([
      // Completed days this week
      supabase
        .from('workout_logs')
        .select('date')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('date', toIso(monday))
        .lte('date', toIso(sunday)),
      // All dates for streak (last 365 days)
      supabase
        .from('workout_logs')
        .select('date')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('date', toIso(new Date(Date.now() - 365 * 86_400_000))),
      // All-time workout count
      supabase
        .from('workout_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('completed', true),
      // Total points + studio_id from profile (source of truth)
      supabase
        .from('profiles')
        .select('total_points, studio_id')
        .eq('id', user.id)
        .single(),
      // Points per training_type (all completed)
      supabase
        .from('workout_logs')
        .select('training_type, points')
        .eq('user_id', user.id)
        .eq('completed', true),
    ]).then(async ([weekRes, allRes, countRes, profileRes, typesRes]) => {
      if (weekRes.error !== null) { reportNetworkError(weekRes.error); return; }
      reportNetworkSuccess();
      if (weekRes.data !== null) {
        const indices = weekRes.data.map((row) => {
          const d = new Date(row.date + 'T12:00:00'); // noon to avoid TZ issues
          const js = d.getDay(); // 0=Sun
          return (js + 6) % 7; // convert to 0=Mon
        });
        // Deduplicate: multiple logs on the same day should count as one
        setCompletedDayIndices([...new Set(indices)]);
      }
      if (allRes.data !== null) {
        setStreak(calcStreak(allRes.data.map((row) => row.date as string)));
      }
      setTotalWorkouts(countRes.count ?? 0);
      if (typesRes.data !== null) {
        const map: Record<string, number> = {};
        for (const row of typesRes.data) {
          const type = ((row.training_type as string | null) ?? 'sonstige').toLowerCase();
          map[type] = (map[type] ?? 0) + (row.points ?? 0);
        }
        setTrainingTypePoints(map);
      }
      if (profileRes.data !== null) {
        setTotalPoints(profileRes.data.total_points);

        // Rank = number of studio members with more points + 1
        const studioId = (profileRes.data as ProfileRow).studio_id;
        if (studioId !== null) {
          const { count } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('studio_id', studioId)
            .gt('total_points', profileRes.data.total_points);
          setRank((count ?? 0) + 1);
        } else {
          setRank(null);
        }
      }
      setLoading(false);
    });
  }, [user, refetchTrigger, internalTrigger]);

  return { completedDayIndices, totalPoints, totalWorkouts, streak, rank, trainingTypePoints, loading, refetch };
}
