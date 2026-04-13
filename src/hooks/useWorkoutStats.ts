import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface WorkoutStats {
  completedDayIndices: number[]; // 0=Mon … 6=Sun for the current week
  totalPoints: number;
  totalWorkouts: number; // all-time completed workout count
  streak: number; // consecutive completed days ending today or yesterday
  loading: boolean;
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

function toIso(date: Date): string {
  return date.toISOString().split('T')[0];
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

export function useWorkoutStats(refetchTrigger = 0): WorkoutStats {
  const { user } = useAuth();
  const [completedDayIndices, setCompletedDayIndices] = useState<number[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

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
      // Total XP + all dates for streak (last 365 days)
      supabase
        .from('workout_logs')
        .select('date, points')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('date', toIso(new Date(Date.now() - 365 * 86_400_000))),
      // All-time workout count
      supabase
        .from('workout_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('completed', true),
    ]).then(([weekRes, allRes, countRes]) => {
      if (weekRes.data !== null) {
        const indices = weekRes.data.map((row) => {
          const d = new Date(row.date + 'T12:00:00'); // noon to avoid TZ issues
          const js = d.getDay(); // 0=Sun
          return (js + 6) % 7; // convert to 0=Mon
        });
        setCompletedDayIndices(indices);
      }
      if (allRes.data !== null) {
        const sum = allRes.data.reduce((acc, row) => acc + (row.points as number), 0);
        setTotalPoints(sum);
        setStreak(calcStreak(allRes.data.map((row) => row.date as string)));
      }
      setTotalWorkouts(countRes.count ?? 0);
      setLoading(false);
    });
  }, [user, refetchTrigger]);

  return { completedDayIndices, totalPoints, totalWorkouts, streak, loading };
}
