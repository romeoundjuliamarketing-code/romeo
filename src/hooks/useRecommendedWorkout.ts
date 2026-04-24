import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ─── Fitness group mapping ─────────────────────────────────────────────────────

export type FitnessGroup = 'schlagkraft' | 'trittkraft' | 'ausdauer' | 'schulter' | 'nackenhals' | 'griffkraft' | 'beinarbeit' | 'koordination' | 'mobilitaet' | 'partnertraining';

// Maps workout_logs.training_type values to fitness groups.
// Includes both internal Workout['category'] values (from module workouts)
// and external training type names (from studio sessions and manual logs).
const TRAINING_TYPE_TO_GROUP: Record<string, FitnessGroup> = {
  // Internal Workout['category'] values stored by TimerScreen
  'schlagkraft':  'schlagkraft',
  'trittkraft':   'trittkraft',
  'koordination': 'koordination',
  'ausdauer':     'ausdauer',
  'beinarbeit':   'beinarbeit',
  'schulter':     'schulter',
  'nackenhals':   'nackenhals',
  'griffkraft':   'griffkraft',
  'mobilitaet':    'mobilitaet',
  'partnertraining':  'partnertraining',
  // External names from studio_schedule.training_type and manual logs
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

const GROUP_TIPS: Record<FitnessGroup, string> = {
  schlagkraft:  'Drei saubere Kombinationen sind mehr wert als zehn ungenaue – Qualität vor Quantität.',
  trittkraft:   'Ein kraftvoller Tritt kommt aus der Hüftrotation – fokussiere dich bewusst darauf.',
  ausdauer:     'Schon 15 Minuten kontinuierliche Belastung verbessern deine ringspezifische Ausdauer.',
  schulter:     'Kurze Schulter-Aktivierungsübungen halten die Gelenke stabil und schützen langfristig.',
  nackenhals:   'Ein stabiler Nacken verbessert die Kontrolle bei Treffern und schützt in Clinch-Situationen.',
  griffkraft:   'Starke Finger- und Unterarmkraft verbessert jeden Clinch, Grip und die Kontrolle am Gegner.',
  beinarbeit:   'Gute Beinarbeit schafft Distanz und Winkel – trainiere Bewegung, nicht nur Kraft.',
  koordination: 'Reaktions- und Rhythmusübungen sind die effektivste Form von Koordinationstraining.',
  mobilitaet:   '10 Minuten Dehnen nach dem Training wirken sich direkt auf deine Schlagtechnik aus.',
  partnertraining: 'Distanzkontrolle gewinnt Kämpfe – trainiere Beinarbeit mit einem Partner für maximalen Transfer.',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FocusRecommendation {
  group: FitnessGroup;
  label: string;
  reason: string;
  tip: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRecommendedWorkout(refetchTrigger = 0): {
  recommendation: FocusRecommendation | null;
  loading: boolean;
} {
  const { user } = useAuth();
  const [recommendation, setRecommendation] = useState<FocusRecommendation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === null) {
      setLoading(false);
      return;
    }

    // Start of current calendar week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysToMonday);
    const weekStart = monday.toISOString().split('T')[0];

    supabase
      .from('workout_logs')
      .select('training_type')
      .eq('user_id', user.id)
      .eq('completed', true)
      .gte('date', weekStart)
      .then(({ data }) => {
        // Count sessions per fitness group
        const counts: Record<FitnessGroup, number> = {
          schlagkraft:  0,
          trittkraft:   0,
          ausdauer:     0,
          schulter:     0,
          nackenhals:   0,
          griffkraft:   0,
          beinarbeit:   0,
          partnertraining: 0,
          koordination: 0,
          mobilitaet:   0,
        };

        for (const row of (data ?? [])) {
          const trainingType = row.training_type;
          if (trainingType === null) continue;
          const group = TRAINING_TYPE_TO_GROUP[trainingType];
          if (group !== undefined) counts[group]++;
        }

        // Least-trained group this week
        const groups = Object.keys(counts) as FitnessGroup[];
        const leastGroup = groups.reduce((min, g) => counts[g] < counts[min] ? g : min);

        const label = GROUP_LABELS[leastGroup];
        const reason = counts[leastGroup] === 0
          ? `${label} diese Woche noch nicht trainiert`
          : `Wenig ${label} diese Woche`;

        setRecommendation({
          group:  leastGroup,
          label,
          reason,
          tip: GROUP_TIPS[leastGroup],
        });
        setLoading(false);
      });
  }, [user, refetchTrigger]);

  return { recommendation, loading };
}
