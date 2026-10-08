import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSparringTrustActions, type TrustOutcome } from './useSparringTrustActions';
import { getLocationPermissionState, openLocationSettings } from './useDeviceFix';
import type { JoinFlowView, JoinOverlay } from '../components/sparring/trust/JoinFlowOverlay';
import type { TrustProblem } from '../components/sparring/trust/TrustNoticeCard';
import type { TrustAction } from '../utils/sparringTrust';
import type { SparringReachStatus } from '../types/sparringTrust';

type JoinStatus = 'pending' | 'confirmed' | 'waitlisted';

function problemOf(out: Exclude<TrustOutcome<unknown>, { kind: 'ok' }>): TrustProblem {
  if (out.kind === 'refused') return { kind: 'refused', refusal: out.refusal };
  if (out.kind === 'location') return { kind: 'location', error: out.error };
  return { kind: 'network' };
}

// Order of the binding join: intro (once per account) -> early slot/state check
// -> location primer (while the permission can still be asked) -> rules
// consent (owned by the screen) -> join with the measured position. Every
// outcome except success becomes a problem card in the detail sheet.
export function useSparringJoinFlow(args: {
  sparringId: string | null;
  reachStatus: SparringReachStatus | null;
  ackIntro: () => Promise<boolean>;
  refetchReach: () => void;
  setBusy: (busy: boolean) => void;
  openConsent: () => void;
  onJoined: (status: JoinStatus) => void;
  onOpenSparring: (sparringId: string) => void;
  onShowNearby: () => void;
}): {
  view: JoinFlowView;
  start: () => void;
  confirm: (rulesVersion: number) => Promise<void>;
  reset: () => void;
} {
  const { t } = useTranslation();
  const { checkEligibility, join } = useSparringTrustActions();
  const [overlay, setOverlay] = useState<JoinOverlay | null>(null);
  const [introBusy, setIntroBusy] = useState(false);
  const [introError, setIntroError] = useState<string | null>(null);
  const [problem, setProblem] = useState<TrustProblem | null>(null);
  const lastRulesRef = useRef<number | null>(null);
  const argsRef = useRef(args);
  argsRef.current = args;
  const { sparringId } = args;

  const reset = useCallback((): void => {
    setOverlay(null);
    setIntroBusy(false);
    setIntroError(null);
    setProblem(null);
    lastRulesRef.current = null;
  }, []);

  useEffect(() => { reset(); }, [sparringId, reset]);

  const runChecks = useCallback(async (): Promise<void> => {
    const a = argsRef.current;
    if (a.sparringId === null) return;
    a.setBusy(true);
    const out = await checkEligibility('join', { sparringId: a.sparringId });
    a.setBusy(false);
    if (out.kind !== 'ok') {
      setProblem(problemOf(out));
      return;
    }
    // Not decided yet, or denied but still askable: explain first, then ask.
    const permission = await getLocationPermissionState();
    if (permission === 'undetermined' || permission === 'denied') {
      setOverlay('primer');
      return;
    }
    a.openConsent();
  }, [checkEligibility]);

  const doJoin = useCallback(async (rulesVersion: number): Promise<void> => {
    const a = argsRef.current;
    if (a.sparringId === null) return;
    a.setBusy(true);
    setProblem(null);
    const out = await join(a.sparringId, rulesVersion, true);
    a.setBusy(false);
    if (out.kind === 'ok') {
      lastRulesRef.current = null;
      a.refetchReach();
      a.onJoined(out.data.status);
      return;
    }
    setProblem(problemOf(out));
  }, [join]);

  const start = useCallback((): void => {
    setProblem(null);
    lastRulesRef.current = null;
    if (argsRef.current.reachStatus?.intro_acked !== true) {
      setOverlay('intro');
      return;
    }
    void runChecks();
  }, [runChecks]);

  const confirm = useCallback(async (rulesVersion: number): Promise<void> => {
    lastRulesRef.current = rulesVersion;
    await doJoin(rulesVersion);
  }, [doJoin]);

  const onIntroNext = useCallback((): void => {
    setIntroBusy(true);
    setIntroError(null);
    void (async () => {
      const ok = await argsRef.current.ackIntro();
      setIntroBusy(false);
      if (!ok) {
        setIntroError(t('sparringTrust.intro.saveFailed'));
        return;
      }
      setOverlay(null);
      void runChecks();
    })();
  }, [runChecks, t]);

  const onPrimerAllow = useCallback((): void => {
    setOverlay(null);
    argsRef.current.openConsent();
  }, []);

  const onOverlayClose = useCallback((): void => {
    if (introBusy) return;
    setOverlay(null);
  }, [introBusy]);

  const onProblemAction = useCallback((action: TrustAction): void => {
    const a = argsRef.current;
    if (action === 'settings') {
      openLocationSettings();
    } else if (action === 'howItWorks') {
      setOverlay('explain');
    } else if (action === 'nearby') {
      a.onShowNearby();
    } else if (action === 'mySparring') {
      const id = problem?.kind === 'refused' ? problem.refusal.active_sparring_id : undefined;
      if (id !== undefined) a.onOpenSparring(id);
    } else if (action === 'retry') {
      if (lastRulesRef.current !== null) {
        void doJoin(lastRulesRef.current);
      } else {
        setProblem(null);
        void runChecks();
      }
    }
  }, [problem, doJoin, runChecks]);

  return {
    view: { overlay, introBusy, introError, problem, onIntroNext, onPrimerAllow, onOverlayClose, onProblemAction },
    start,
    confirm,
    reset,
  };
}
