import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// Segment shown in the donut chart — one per workout category
export interface ModuleSegment {
  label: string;
  value: number;
  color: string;
}

// Maps workout category keys (stored in training_type) to display labels and colors
const CATEGORY_CONFIG: { key: string; label: string; color: string }[] = [
  { key: 'schlagkraft',  label: 'Schlagkraft',  color: '#0A0A0A' },
  { key: 'trittkraft',   label: 'Trittkraft',    color: '#C4704F' },
  { key: 'ausdauer',     label: 'Ausdauer',      color: '#B8975A' },
  { key: 'schulter',     label: 'Schulter',      color: '#3D6B9E' },
  { key: 'nackenhals',   label: 'Nacken und Hals', color: '#5E7AA3' },
  { key: 'griffkraft',   label: 'Griffkraft',    color: '#4F6D7A' },
  { key: 'beinarbeit',   label: 'Beinarbeit',    color: '#2D6E6E' },
  { key: 'koordination', label: 'Koordination',  color: '#4A90D9' },
  { key: 'mobilitaet',    label: 'Mobilität',     color: '#7B6FA0' },
  { key: 'partnertraining', label: 'Partnertraining',  color: '#4A7C59' },
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
        built.push({ label: 'Extras', value: extraCount, color: '#8CB8E0' });
      }

      const sum = built.reduce((acc, s) => acc + s.value, 0);
      setSegments(built);
      setTotal(sum);
      setLoading(false);
    });
  }, [user, refetchTrigger]);

  return { segments, total, loading };
}
