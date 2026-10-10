import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSparringTrustActions, type TrustOutcome } from './useSparringTrustActions';
import { acquireDeviceFix, getLocationPermissionState, openLocationSettings } from './useDeviceFix';
import { joinGateFor, type JoinGate } from '../utils/joinGate';
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

// Order of the binding join: intro (once per account) -> location primer
// (while the permission can still be asked) -> measure position -> server
// eligibility WITH position (radius, slot, state) -> rules consent (owned by
// the screen) -> join. A known radius refusal stops before the rules and
// becomes the join gate; every other failure becomes a problem card.
// When the details open and permission is already granted, the same server
// check runs silently, so the gate is visible before anyone taps "Zusagen".
export function useSparringJoinFlow(args: {
  sparringId: string | null;
  /** Check eligibility as soon as the details open (normal join CTA would show). */
  checkOnOpen: boolean;
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
  const [gate, setGate] = useState<JoinGate>({ kind: 'unknown' });
  const lastRulesRef = useRef<number | null>(null);
  const argsRef = useRef(args);
  argsRef.current = args;
  const { sparringId, checkOnOpen } = args;

  const reset = useCallback((): void => {
    setOverlay(null);
    setIntroBusy(false);
    setIntroError(null);
    setProblem(null);
    lastRulesRef.current = null;
  }, []);

  useEffect(() => { reset(); }, [sparringId, reset]);

  // Silent check when the details open: never asks for permission, and any
  // failure (no permission, no fix, no network) leaves the gate 'unknown'.
  useEffect(() => {
    setGate({ kind: 'unknown' });
    if (sparringId === null || !checkOnOpen) return;
    let cancelled = false;
    void (async () => {
      if (await getLocationPermissionState() !== 'granted' || cancelled) return;
      setGate({ kind: 'checking' });
      const fixed = await acquireDeviceFix(false);
      if (cancelled) return;
      if (!fixed.ok) {
        setGate({ kind: 'unknown' });
        return;
      }
      const out = await checkEligibility('join', { sparringId, fix: fixed.fix });
      if (!cancelled) setGate(joinGateFor(out));
    })();
    return () => { cancelled = true; };
  }, [sparringId, checkOnOpen, checkEligibility]);

  // Measure, then let the server check radius/slot/state before the rules.
  const measureAndCheck = useCallback(async (): Promise<void> => {
    const a = argsRef.current;
    if (a.sparringId === null) return;
    a.setBusy(true);
    const fixed = await acquireDeviceFix(true);
    if (!fixed.ok) {
      a.setBusy(false);
      setProblem({ kind: 'location', error: fixed.error });
      return;
    }
    const out = await checkEligibility('join', { sparringId: a.sparringId, fix: fixed.fix });
    a.setBusy(false);
    const next = joinGateFor(out);
    if (next.kind === 'tooFar') {
      setGate(next);
      return;
    }
    if (out.kind !== 'ok') {
      setProblem(problemOf(out));
      return;
    }
    setGate(next);
    a.openConsent();
  }, [checkEligibility]);

  const runChecks = useCallback(async (): Promise<void> => {
    // Not decided yet, or denied but still askable: explain first, then ask.
    const permission = await getLocationPermissionState();
    if (permission === 'undetermined' || permission === 'denied') {
      setOverlay('primer');
      return;
    }
    await measureAndCheck();
  }, [measureAndCheck]);

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
    // The final server check refused the radius: show it in the action area.
    const next = joinGateFor(out);
    if (next.kind === 'tooFar') {
      lastRulesRef.current = null;
      setGate(next);
      return;
    }
    setProblem(problemOf(out));
  }, [join]);

  const start = useCallback((): void => {
    setProblem(null);
    lastRulesRef.current = null;
    if (gate.kind === 'checking' || gate.kind === 'tooFar') return;
    if (argsRef.current.reachStatus?.intro_acked !== true) {
      setOverlay('intro');
      return;
    }
    void runChecks();
  }, [runChecks, gate.kind]);

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
    void measureAndCheck();
  }, [measureAndCheck]);

  const onOverlayClose = useCallback((): void => {
    if (introBusy) return;
    setOverlay(null);
  }, [introBusy]);

  const onProblemAction = useCallback((action: TrustAction): void => {
    const a = argsRef.current;
    if (action === 'settings') {
      openLocationSettings();
    } else if (action === 'limit') {
      setOverlay('limit');
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
    view: { overlay, introBusy, introError, problem, gate, onIntroNext, onPrimerAllow, onOverlayClose, onProblemAction },
    start,
    confirm,
    reset,
  };
}
