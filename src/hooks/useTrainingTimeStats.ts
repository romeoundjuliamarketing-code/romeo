import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { FitnessGroup } from './useFitnessRatings';

export type TrainingTimeRange = '7d' | '30d' | '90d' | '12m' | 'all';

export interface CategoryMinutes {
  key: string;
  label: string;
  minutes: number;
  groupKey: FitnessGroup | null;
}

export interface TrainingTimeStats {
  totalMinutes: number;
  sessionCount: number;
  averagePerWeekMinutes: number;
  comparisonMinutes: number | null;
  comparisonPercent: number | null;
  categories: CategoryMinutes[];
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getRangeDays(range: Exclude<TrainingTimeRange, 'all'>): number {
  switch (range) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case '12m':
      return 365;
  }
}

const CATEGORY_LABEL: Record<string, string> = {
  schlagkraft: 'Schlagkraft',
  trittkraft: 'Trittkraft',
  ausdauer: 'Ausdauer',
  schulter: 'Schulter',
  nackenhals: 'Nacken und Hals',
  griffkraft: 'Griffkraft',
  beinarbeit: 'Beinarbeit',
  koordination: 'Koordination',
  mobilitaet: 'Mobilität',
  partnertraining: 'Partnertraining',
  eigene: 'Eigene',
};

// Maps training_type values to FitnessGroup (mirrors useFitnessRatings)
const TRAINING_TYPE_TO_GROUP: Record<string, FitnessGroup> = {
  schlagkraft:        'schlagkraft',
  trittkraft:         'trittkraft',
  koordination:       'koordination',
  ausdauer:           'ausdauer',
  beinarbeit:         'beinarbeit',
  schulter:           'schulter',
  nackenhals:         'nackenhals',
  griffkraft:         'griffkraft',
  mobilitaet:         'mobilitaet',
  partnertraining:    'partnertraining',
  'K1':               'schlagkraft',
  'Boxen':            'schlagkraft',
  'BJJ':              'koordination',
  'MMA':              'schlagkraft',
  'Plyometrik':       'schlagkraft',
  'Kraft & Ausdauer': 'schulter',
  'Gym':              'schulter',
  'Kettlebell':       'schulter',
  'Intervallläufe':   'ausdauer',
  'Sprints':          'ausdauer',
  'Seilspringen':     'ausdauer',
  'Joggen':           'ausdauer',
  'Schwimmen':        'ausdauer',
  'Dehnen':           'mobilitaet',
  'Yoga':             'mobilitaet',
};

function categoryLabel(trainingType: string | null): string {
  if (trainingType === null) return 'Sonstiges';
  return CATEGORY_LABEL[trainingType] ?? trainingType;
}

function calculateAveragePerWeek(totalMinutes: number, days: number): number {
  if (days <= 0) return 0;
  return Math.round(totalMinutes / (days / 7));
}

export function useTrainingTimeStats(range: TrainingTimeRange, refetchTrigger = 0): {
  stats: TrainingTimeStats;
  loading: boolean;
} {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TrainingTimeStats>({
    totalMinutes: 0,
    sessionCount: 0,
    averagePerWeekMinutes: 0,
    comparisonMinutes: null,
    comparisonPercent: null,
    categories: [],
  });

  const today = useMemo(() => startOfToday(), [range, refetchTrigger, user?.id]);

  useEffect(() => {
    if (user === null) {
      setStats({
        totalMinutes: 0,
        sessionCount: 0,
        averagePerWeekMinutes: 0,
        comparisonMinutes: null,
        comparisonPercent: null,
        categories: [],
      });
      setLoading(false);
      return;
    }

    setLoading(true);

    const isAll = range === 'all';
    const rangeDays = isAll ? null : getRangeDays(range);

    const currentStart = rangeDays !== null ? addDays(today, -(rangeDays - 1)) : null;
    const previousStart = rangeDays !== null && currentStart !== null ? addDays(currentStart, -rangeDays) : null;
    const previousEnd = rangeDays !== null && currentStart !== null ? addDays(currentStart, -1) : null;
    const fetchStart = previousStart ?? null;

    let query = supabase
      .from('workout_logs')
      .select('date, duration_min, training_type')
      .eq('user_id', user.id)
      .eq('completed', true);

    if (fetchStart !== null) {
      query = query.gte('date', toIsoDate(fetchStart));
    }

    query.then(({ data }) => {
      const rows = data ?? [];

      let totalMinutes = 0;
      let sessionCount = 0;
      let previousMinutes = 0;

      const categorySums = new Map<string, number>();

      let earliestDate: Date | null = null;

      for (const row of rows) {
        const duration = row.duration_min ?? 0;
        if (duration <= 0) continue;
        if (row.date === null) continue;

        const rowDate = new Date(`${row.date}T00:00:00`);

        if (earliestDate === null || rowDate < earliestDate) {
          earliestDate = rowDate;
        }

        const inCurrent = currentStart === null || rowDate >= currentStart;
        if (inCurrent) {
          totalMinutes += duration;
          sessionCount += 1;

          const rawKey = row.training_type ?? 'sonstiges';
          categorySums.set(rawKey, (categorySums.get(rawKey) ?? 0) + duration);
        }

        if (previousStart !== null && previousEnd !== null && rowDate >= previousStart && rowDate <= previousEnd) {
          previousMinutes += duration;
        }
      }

      const categories: CategoryMinutes[] = Array.from(categorySums.entries())
        .map(([rawKey, minutes]) => ({
          key: rawKey,
          label: categoryLabel(rawKey),
          minutes,
          groupKey: TRAINING_TYPE_TO_GROUP[rawKey] ?? null,
        }))
        .sort((a, b) => b.minutes - a.minutes);

      const daysForAverage = (() => {
        if (rangeDays !== null) return rangeDays;
        if (earliestDate === null) return 7;
        const diffMs = today.getTime() - earliestDate.getTime();
        const diffDays = Math.max(1, Math.floor(diffMs / 86_400_000) + 1);
        return Math.max(7, diffDays);
      })();

      const averagePerWeekMinutes = calculateAveragePerWeek(totalMinutes, daysForAverage);

      const comparisonMinutes = rangeDays === null ? null : totalMinutes - previousMinutes;
      const comparisonPercent = (() => {
        if (rangeDays === null) return null;
        if (previousMinutes === 0) {
          if (totalMinutes === 0) return 0;
          return 100;
        }
        return Math.round(((totalMinutes - previousMinutes) / previousMinutes) * 100);
      })();

      setStats({
        totalMinutes,
        sessionCount,
        averagePerWeekMinutes,
        comparisonMinutes,
        comparisonPercent,
        categories,
      });
      setLoading(false);
    });
  }, [user, range, refetchTrigger, today]);

  return { stats, loading };
}
