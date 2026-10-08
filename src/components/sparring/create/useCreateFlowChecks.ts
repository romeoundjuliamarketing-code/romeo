import { useEffect, useState } from 'react';
import { useSparringTrustActions } from '../../../hooks/useSparringTrustActions';
import { acquireDeviceFix, getLocationPermissionState } from '../../../hooks/useDeviceFix';
import type { SparringPlace } from '../../../types/sparringTrust';
import type { TrustProblem } from '../trust/TrustNoticeCard';

// Early, non-binding checks of the create flow. Never asks for permission.
export function useCreateFlowChecks(visible: boolean, place: SparringPlace | null): {
  /** Active sparring / daily limit: publishing is not possible right now. */
  blocker:     TrustProblem | null;
  /** Place too far away (only when location is already granted). */
  placeNotice: TrustProblem | null;
} {
  const { checkEligibility } = useSparringTrustActions();
  const [blocker, setBlocker] = useState<TrustProblem | null>(null);
  const [placeNotice, setPlaceNotice] = useState<TrustProblem | null>(null);
  const placeId = place?.id ?? null;

  useEffect(() => {
    if (!visible) { setBlocker(null); return; }
    let cancelled = false;
    void checkEligibility('publish', {}).then((outcome) => {
      if (cancelled) return;
      const hit = outcome.kind === 'refused'
        && (outcome.refusal.reason === 'slot_taken' || outcome.refusal.reason === 'rate_limited');
      setBlocker(hit && outcome.kind === 'refused' ? { kind: 'refused', refusal: outcome.refusal } : null);
    });
    return () => { cancelled = true; };
  }, [visible, checkEligibility]);

  useEffect(() => {
    setPlaceNotice(null);
    if (!visible || placeId === null) return;
    let cancelled = false;
    void (async () => {
      if (await getLocationPermissionState() !== 'granted') return;
      const fixed = await acquireDeviceFix(false);
      if (cancelled || !fixed.ok) return;
      const outcome = await checkEligibility('publish', { placeId, fix: fixed.fix });
      if (cancelled) return;
      if (outcome.kind === 'refused' && outcome.refusal.reason === 'too_far') {
        setPlaceNotice({ kind: 'refused', refusal: outcome.refusal });
      }
    })();
    return () => { cancelled = true; };
  }, [visible, placeId, checkEligibility]);

  return { blocker, placeNotice };
}
