// Invisible component: calls read-only data hooks once to warm the query cache
// for the Training and Profil tabs while the user is on Home.
// Returns null — no UI, no layout impact.
import { useEffect } from 'react';
import { Image } from 'react-native';
import { SPARR_LOGO_SOURCE } from './SparrLogo';
import { useWorkoutStats } from '../../hooks/useWorkoutStats';
import { useFightRecord } from '../../hooks/useFightRecord';
import { useStudio } from '../../hooks/useStudio';
import { useProfile } from '../../hooks/useProfile';
import { useWeight } from '../../hooks/useWeight';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useVerification } from '../../hooks/useVerification';
import { useWeeklyVolume } from '../../hooks/useWeeklyVolume';

// Hooks deliberately excluded:
// - useWaterTracking: on mount it may sync widget-pending water, award XP points
//   via add_workout_points RPC, and call onGoalReached — too many side effects.
// - useParticipation: contains participate/cancelParticipation mutation paths.
// - useSchedule: does not write to queryCache (no setCached), so warming it here
//   provides no benefit and would cause a redundant network request.
// - Sparring-map hooks: excluded per spec (too heavy).

// Decodes the Sparr mark once at app start so it is already in the image cache when
// the Training hero or a challenge card first renders.
function useWarmSparrLogo(): void {
  useEffect(() => {
    const source = Image.resolveAssetSource(SPARR_LOGO_SOURCE);
    if (source?.uri === undefined) return;
    void Image.prefetch(source.uri).catch(() => undefined);
  }, []);
}

export default function CacheWarmer(): null {
  useWarmSparrLogo();

  // Mirror the same default argument (0) that screens pass on their first render
  useWorkoutStats(0);
  useFightRecord(0);
  useStudio(0);
  useProfile(0);
  useWeight(0);
  useEntitlement(0);
  useVerification(0);
  useWeeklyVolume(0);

  return null;
}
