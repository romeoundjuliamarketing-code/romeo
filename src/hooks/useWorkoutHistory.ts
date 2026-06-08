import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';

export interface WeekData {
  weekKey: string;   // Monday ISO date "YYYY-MM-DD"
  weekLabel: string; // "07.04 – 13.04"
  segments: { type: string; points: number }[];
  totalPoints: number;
}

function getMondayStr(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const date = new Date(y, mo - 1, d, 12, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildWeekLabel(mondayStr: string): string {
  const [y, mo, d] = mondayStr.split('-').map(Number);
  const monday = new Date(y, mo - 1, d);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt: Date): string =>
    `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}`;
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

export function useWorkoutHistory(): { weeks: WeekData[]; loading: boolean } {
  const { user } = useAuth();
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === null) return;

    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('workout_logs')
        .select('date, training_type, points')
        .eq('user_id', user.id)
        .eq('completed', true)
        .order('date', { ascending: true });

      if (error !== null) {
        reportNetworkError(error);
        setLoading(false);
        return;
      }

      reportNetworkSuccess();

      const weekMap = new Map<string, Map<string, number>>();
      for (const row of data ?? []) {
        if (row.date === null) continue;
        const monday = getMondayStr(row.date as string);
        const type = ((row.training_type as string | null) ?? 'sonstige').toLowerCase();
        const pts = (row.points as number | null) ?? 0;
        if (!weekMap.has(monday)) weekMap.set(monday, new Map());
        const typeMap = weekMap.get(monday)!;
        typeMap.set(type, (typeMap.get(type) ?? 0) + pts);
      }

      const result: WeekData[] = [];
      for (const [mondayStr, typeMap] of weekMap) {
        const segments = Array.from(typeMap.entries())
          .map(([type, points]) => ({ type, points }))
          .sort((a, b) => b.points - a.points);
        const totalPoints = segments.reduce((sum, s) => sum + s.points, 0);
        result.push({
          weekKey: mondayStr,
          weekLabel: buildWeekLabel(mondayStr),
          segments,
          totalPoints,
        });
      }

      setWeeks(result);
      setLoading(false);
    })();
  }, [user]);

  return { weeks, loading };
}
