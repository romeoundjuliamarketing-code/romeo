import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { WeeklyHydrationDay } from '../components/ernaehrung/WeeklyHydrationDots';

function isoDateWithOffset(daysOffset: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}

function weekdayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  const short = new Intl.DateTimeFormat('de-DE', { weekday: 'short' }).format(date);
  return short.replace('.', '').slice(0, 2);
}

export function useWeeklyHydration(userId: string | null, goalMl: number, amountMl: number): WeeklyHydrationDay[] {
  const [reachedDays, setReachedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadWeek(): Promise<void> {
      if (userId === null) {
        setReachedDays(new Set());
        return;
      }

      const startDate = isoDateWithOffset(-6);
      const endDate = isoDateWithOffset(0);

      const { data, error } = await supabase
        .from('water_logs')
        .select('date, amount_ml')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error !== null || data === null) {
        setReachedDays(new Set());
        return;
      }

      const nextReachedDays = new Set<string>();
      data.forEach((entry) => {
        if (entry.amount_ml >= goalMl) {
          nextReachedDays.add(entry.date);
        }
      });
      setReachedDays(nextReachedDays);
    }

    void loadWeek();
  }, [amountMl, goalMl, userId]);

  return useMemo<WeeklyHydrationDay[]>(() => (
    Array.from({ length: 7 }).map((_, index) => {
      const date = isoDateWithOffset(index - 6);
      return {
        key: date,
        label: weekdayLabel(date),
        reachedGoal: reachedDays.has(date),
      };
    })
  ), [reachedDays]);
}
