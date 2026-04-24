import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getRelevantFitnessGroups } from '../data/disciplines';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FitnessGroup =
  | 'schlagkraft'
  | 'trittkraft'
  | 'ausdauer'
  | 'schulter'
  | 'nackenhals'
  | 'griffkraft'
  | 'beinarbeit'
  | 'koordination'
  | 'mobilitaet'
  | 'partnertraining';

export interface FitnessRating {
  group:  FitnessGroup;
  label:  string;
  score:  number; // 0–100, relative to best-trained group
  count:  number; // raw session count (last 30 days)
}

// ─── Mappings ─────────────────────────────────────────────────────────────────

const GROUP_LABELS: Record<FitnessGroup, string> = {
  schlagkraft:  'Schlagkraft',
  trittkraft:   'Trittkraft',
  ausdauer:     'Ausdauer',
  schulter:     'Schulter & Kraft',
  nackenhals:   'Nacken und Hals',
  griffkraft:   'Griffkraft',
  beinarbeit:   'Beinarbeit',
  koordination: 'Koordination',
  mobilitaet:   'Mobilität',
  partnertraining: 'Partnertraining',
};

// Maps training_type values stored in workout_logs to a fitness group.
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
  partnertraining:       'partnertraining',
  // Studio / manual log types
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
  'Sauna':            'mobilitaet',
};

const ALL_GROUPS: FitnessGroup[] = [
  'schlagkraft',
  'trittkraft',
  'ausdauer',
  'schulter',
  'nackenhals',
  'griffkraft',
  'beinarbeit',
  'koordination',
  'mobilitaet',
  'partnertraining',
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFitnessRatings(refetchTrigger = 0, disciplines: string[] = []): {
  ratings: FitnessRating[];
  loading: boolean;
} {
  const { user } = useAuth();
  const [ratings, setRatings] = useState<FitnessRating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === null) {
      setLoading(false);
      return;
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
      .toISOString()
      .split('T')[0];

    supabase
      .from('workout_logs')
      .select('training_type')
      .eq('user_id', user.id)
      .eq('completed', true)
      .gte('date', thirtyDaysAgo)
      .then(({ data }) => {
        // Count sessions per group
        const counts: Record<FitnessGroup, number> = {
          schlagkraft:  0,
          trittkraft:   0,
          ausdauer:     0,
          schulter:     0,
          nackenhals:   0,
          griffkraft:   0,
          beinarbeit:   0,
          koordination: 0,
          mobilitaet:   0,
          partnertraining: 0,
        };

        for (const row of (data ?? [])) {
          if (row.training_type === null) continue;
          const group = TRAINING_TYPE_TO_GROUP[row.training_type];
          if (group !== undefined) counts[group]++;
        }

        // Filter to groups relevant for the user's disciplines
        const relevantGroups = getRelevantFitnessGroups(disciplines);

        // Normalize relative to best group (best = 100)
        const max = Math.max(...relevantGroups.map((g) => counts[g]));

        const result: FitnessRating[] = relevantGroups.map((group) => ({
          group,
          label: GROUP_LABELS[group],
          score: max === 0 ? 0 : Math.round((counts[group] / max) * 100),
          count: counts[group],
        }));

        setRatings(result);
        setLoading(false);
      });
  }, [user, refetchTrigger, disciplines]);

  return { ratings, loading };
}
