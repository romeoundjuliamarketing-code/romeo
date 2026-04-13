import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { workouts } from '../data/workouts';
import type { Workout } from '../data/workouts';

// ─── Fitness group mapping ─────────────────────────────────────────────────────

type FitnessGroup = 'schlagkraft' | 'ausdauer' | 'kraft' | 'mobilitaet';

const CATEGORY_TO_GROUP: Record<Workout['category'], FitnessGroup> = {
  schlagkraft:  'schlagkraft',
  trittkraft:   'schlagkraft',
  ausdauer:     'ausdauer',
  beinarbeit:   'ausdauer',
  schulter:     'kraft',
  koordination: 'kraft',
  mobilitaet:   'mobilitaet',
};

const GROUP_LABELS: Record<FitnessGroup, string> = {
  schlagkraft: 'Schlagkraft',
  ausdauer:    'Ausdauer',
  kraft:       'Kraft',
  mobilitaet:  'Mobilität',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecommendedWorkout {
  workout: Workout;
  reason: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRecommendedWorkout(refetchTrigger = 0): {
  recommendation: RecommendedWorkout | null;
  loading: boolean;
} {
  const { user } = useAuth();
  const [recommendation, setRecommendation] = useState<RecommendedWorkout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === null) {
      setLoading(false);
      return;
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    supabase
      .from('training_category_log')
      .select('category')
      .eq('user_id', user.id)
      .gte('logged_at', sevenDaysAgo)
      .then(({ data }) => {
        // Count sessions per fitness group
        const counts: Record<FitnessGroup, number> = {
          schlagkraft: 0,
          ausdauer:    0,
          kraft:       0,
          mobilitaet:  0,
        };

        for (const row of (data ?? [])) {
          const cat = row.category as Workout['category'];
          const group = CATEGORY_TO_GROUP[cat];
          if (group !== undefined) counts[group]++;
        }

        // Least-trained group
        const groups = Object.keys(counts) as FitnessGroup[];
        const leastGroup = groups.reduce((min, g) => counts[g] < counts[min] ? g : min);

        // Workout categories within that group
        const targetCategories = (Object.keys(CATEGORY_TO_GROUP) as Workout['category'][])
          .filter((cat) => CATEGORY_TO_GROUP[cat] === leastGroup);

        const candidates = workouts.filter((w) => targetCategories.includes(w.category));
        if (candidates.length === 0) {
          setLoading(false);
          return;
        }

        // Deterministic-random pick (changes daily)
        const seed = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const index = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % candidates.length;
        const picked = candidates[index];

        const label = GROUP_LABELS[leastGroup];
        const reason = counts[leastGroup] === 0
          ? `${label} diese Woche noch nicht trainiert`
          : `Wenig ${label} diese Woche`;

        setRecommendation({ workout: picked, reason });
        setLoading(false);
      });
  }, [user, refetchTrigger]);

  return { recommendation, loading };
}
