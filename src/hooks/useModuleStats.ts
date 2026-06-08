import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

// Segment shown in the donut chart — one per workout category
export interface ModuleSegment {
  label: string;
  value: number;
  color: string;
}

// Maps workout category keys (stored in training_type) to display labels and colors
const CATEGORY_CONFIG: { key: string; label: string; color: string }[] = [
  { key: 'schlagkraft',     label: 'Schlagkraft',     color: colors.catSchlagkraft    },
  { key: 'trittkraft',      label: 'Trittkraft',       color: colors.catTrittkraft     },
  { key: 'ausdauer',        label: 'Ausdauer',         color: colors.catCardio         },
  { key: 'schulter',        label: 'Schulter',         color: colors.catSchulter       },
  { key: 'nackenhals',      label: 'Nacken und Hals',  color: colors.catNackenhals     },
  { key: 'griffkraft',      label: 'Griffkraft',       color: colors.catGriffkraft     },
  { key: 'beinarbeit',      label: 'Beinarbeit',       color: colors.catCore           },
  { key: 'koordination',    label: 'Koordination',     color: colors.accentBlue        },
  { key: 'mobilitaet',      label: 'Mobilität',        color: colors.catMobility       },
  { key: 'partnertraining', label: 'Partnertraining',  color: colors.catPartnertraining },
];

interface UseModuleStatsResult {
  segments: ModuleSegment[];
  total: number;
  loading: boolean;
}

// Loads completed module workouts (grouped by category) and extra units,
// then combines them into donut segments.
export function useModuleStats(refetchTrigger = 0): UseModuleStatsResult {
  const { user } = useAuth();
  const [segments, setSegments] = useState<ModuleSegment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === null) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Fetch module workouts and extra logs in parallel
    Promise.all([
      supabase
        .from('workout_logs')
        .select('training_type')
        .eq('user_id', user.id)
        .eq('source', 'module')
        .eq('completed', true),
      supabase
        .from('workout_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('source', 'extra')
        .eq('completed', true),
    ]).then(([moduleRes, extraRes]) => {
      // Count module workouts per category
      const counts: Record<string, number> = {};
      for (const row of moduleRes.data ?? []) {
        const key = row.training_type ?? 'unbekannt';
        counts[key] = (counts[key] ?? 0) + 1;
      }

      // Build module segments in fixed order, skip empty
      const built: ModuleSegment[] = CATEGORY_CONFIG
        .map((cfg) => ({ label: cfg.label, value: counts[cfg.key] ?? 0, color: cfg.color }))
        .filter((s) => s.value > 0);

      // Add extras segment if any
      const extraCount = (extraRes.data ?? []).length;
      if (extraCount > 0) {
        built.push({ label: 'Extras', value: extraCount, color: colors.chartExtra });
      }

      const sum = built.reduce((acc, s) => acc + s.value, 0);
      setSegments(built);
      setTotal(sum);
      setLoading(false);
    });
  }, [user, refetchTrigger]);

  return { segments, total, loading };
}
