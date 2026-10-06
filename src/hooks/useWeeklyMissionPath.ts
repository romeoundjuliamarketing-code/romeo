import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'sparr.challenge.week.v1';

// Missionsrunden the week is planned for. Deliberately a weekly target, not a daily
// streak — a missed day must not break anything.
export const WEEKLY_TARGET = 3;

interface WeekProgress {
  // Monday of the tracked week, YYYY-MM-DD.
  weekKey: string;
  // Completed sessions in that week.
  done:    number;
  // Focus areas the completed missions covered.
  focus:   string[];
}

// Monday of the week the given date falls into.
export function weekKeyFor(date: Date): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // JS getDay(): 0=Sun … 6=Sat → shift so Monday is the first day
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const day   = String(monday.getDate()).padStart(2, '0');
  return `${monday.getFullYear()}-${month}-${day}`;
}

function emptyProgress(): WeekProgress {
  return { weekKey: weekKeyFor(new Date()), done: 0, focus: [] };
}

// Reads the stored week defensively and drops it once a new week starts.
function parseProgress(raw: string | null): WeekProgress {
  if (raw === null) return emptyProgress();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyProgress();
  }
  if (typeof parsed !== 'object' || parsed === null) return emptyProgress();

  const value = parsed as Partial<WeekProgress>;
  if (typeof value.weekKey !== 'string' || typeof value.done !== 'number') return emptyProgress();
  if (value.weekKey !== weekKeyFor(new Date())) return emptyProgress();

  return {
    weekKey: value.weekKey,
    done:    Math.max(0, Math.floor(value.done)),
    focus:   Array.isArray(value.focus) ? value.focus.filter((f) => typeof f === 'string') : [],
  };
}

// Counts one game visit (at least one card drawn) towards the week. Called when the
// player leaves the deck (useExitCardFeedback), read
// back by the Training tab — hence a plain function rather than part of the hook.
export async function recordMissionSession(focus: string[]): Promise<void> {
  try {
    const current = parseProgress(await AsyncStorage.getItem(STORAGE_KEY));
    const merged = new Set([...current.focus, ...focus]);
    const next: WeekProgress = {
      weekKey: current.weekKey,
      done:    current.done + 1,
      focus:   Array.from(merged),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Progress display only — losing a count must never break the session.
  }
}

export interface UseWeeklyMissionPathResult {
  done:      number;
  target:    number;
  focusDone: string[];
  loading:   boolean;
}

// Weekly mission path for the Training tab. No streak, no ranking, no XP — just how far
// the week has come.
export function useWeeklyMissionPath(refetchTrigger = 0): UseWeeklyMissionPathResult {
  const [progress, setProgress] = useState<WeekProgress>(emptyProgress);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (): Promise<WeekProgress> => (
    parseProgress(await AsyncStorage.getItem(STORAGE_KEY))
  ), []);

  useEffect(() => {
    let active = true;
    load()
      .then((next) => {
        if (!active) return;
        setProgress(next);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => { active = false; };
  }, [load, refetchTrigger]);

  return {
    done:      Math.min(progress.done, WEEKLY_TARGET),
    target:    WEEKLY_TARGET,
    focusDone: progress.focus,
    loading,
  };
}
