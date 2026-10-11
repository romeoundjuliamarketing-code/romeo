import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';
import { supabase } from '../lib/supabase';
import { navigationRef } from '../navigation/navigationRef';
import { TOUR_STATIONS, resumeStation, tourStationAt, type TourStation } from '../utils/tour';
import type { TourStatus } from '../utils/onboarding';

// Coach tour "Sparr kennenlernen": four stations over the real app pages.
// The overlay (components/tour) reads this state; pages register the elements
// it highlights via useTourTarget. Progress is saved per account
// (set_my_tour_state), independent of the onboarding.

export type TourTargetKey =
  | 'profileCard'
  | 'discoverSearch'
  | 'discoverFirst'
  | 'discoverCreate'
  | 'detailHeader';

/** What the discover page found for the tour (reported by SparringMapScreen). */
export interface TourDiscoverInfo {
  status:      'loading' | 'ready' | 'error';
  /** Upcoming, active sparring with a free slot, nearest first. */
  candidateId: string | null;
  retry:       () => void;
}

interface TourApi {
  active:           boolean;
  station:          TourStation | null;
  stationIndex:     number;
  /** Station 4 shows the separate demo instead of a real sparring. */
  demo:             boolean;
  /** Station 4 with a real sparring: its id (SparringMapScreen opens it). */
  detailSparringId: string | null;
  /** The chosen sparring disappeared before it could be shown. */
  detailGone:       boolean;
  discover:         TourDiscoverInfo | null;
  userName:         string | null;
  status:           TourStatus | null;
  savedStation:     number | null;
  start:            (fromIndex?: number) => void;
  next:             () => void;
  back:             () => void;
  skip:             () => void;
  finish:           () => void;
  openRealDetail:   () => void;
  openDemo:         () => void;
  reportDiscover:   (info: TourDiscoverInfo | null) => void;
  markDetailGone:   () => void;
  /** The real detail sheet was closed (e.g. Android back): back to station 3. */
  detailClosed:     () => void;
  registerTarget:   (key: TourTargetKey, ref: React.RefObject<View | null>) => () => void;
  getTarget:        (key: TourTargetKey) => React.RefObject<View | null> | undefined;
  /** Bumped on target layout changes, so the overlay measures again. */
  layoutTick:       number;
  notifyLayout:     () => void;
  /** Window y where the coach group starts; pages keep the explained part above it. */
  freeBottom:       number | null;
  reportFreeArea:   (bottom: number) => void;
}

const TourContext = createContext<TourApi | null>(null);
const MOVE_LOCK_MS = 400;
// Stable registration functions only: pages that merely mark a target never
// re-render when the tour moves on.
interface TourTargetsApi {
  registerTarget: TourApi['registerTarget'];
  notifyLayout:   () => void;
}
const TourTargetsContext = createContext<TourTargetsApi | null>(null);

function navigateTo(station: TourStation): void {
  if (!navigationRef.isReady()) return;
  if (station === 'profile') navigationRef.navigate('Tabs', { screen: 'Profil' });
  else if (station === 'cards') navigationRef.navigate('Tabs', { screen: 'Karten' });
  else if (station === 'discover') navigationRef.navigate('Tabs', { screen: 'Sparring', params: { listEntryAt: Date.now() } });
}

async function persist(status: TourStatus, station: number | null): Promise<void> {
  // Best effort with one retry: a lost save only means the tour is offered
  // again from the settings entry, never a blocked app.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { error } = await supabase.rpc('set_my_tour_state', { p_status: status, p_station: station });
      if (error === null) return;
    } catch {
      // retry once
    }
  }
}

export function TourProvider({ initialStatus, initialStation, autoStart, persistEnabled = true, userName, children }: {
  initialStatus:  TourStatus | null;
  initialStation: number | null;
  /** Start right away (first entry after the onboarding). */
  autoStart:      boolean;
  /** False (dev preview): nothing is saved to the account. */
  persistEnabled?: boolean;
  userName:       string | null;
  children:       React.ReactNode;
}): React.ReactElement {
  const [active, setActive] = useState(autoStart);
  const [stationIndex, setStationIndex] = useState(0);
  const [demo, setDemo] = useState(false);
  const [detailSparringId, setDetailSparringId] = useState<string | null>(null);
  const [detailGone, setDetailGone] = useState(false);
  const [discover, setDiscover] = useState<TourDiscoverInfo | null>(null);
  const [status, setStatus] = useState<TourStatus | null>(autoStart ? 'in_progress' : initialStatus);
  const [savedStation, setSavedStation] = useState<number | null>(autoStart ? 0 : initialStation);
  const [layoutTick, setLayoutTick] = useState(0);
  const [freeBottom, setFreeBottom] = useState<number | null>(null);
  const targets = useRef(new Map<TourTargetKey, React.RefObject<View | null>>());
  // A double tap on "Weiter"/"Zurück" moves one station, not two: further
  // moves are ignored until the target page had time to show up.
  const lastMoveAt = useRef(0);

  useEffect(() => {
    if (autoStart && persistEnabled) void persist('in_progress', 0);
  }, [autoStart, persistEnabled]);

  const save = useCallback((next: TourStatus, station: number | null): void => {
    setStatus(next);
    setSavedStation(next === 'in_progress' ? station : null);
    if (persistEnabled) void persist(next, station);
  }, [persistEnabled]);

  const goTo = useCallback((index: number): void => {
    const station = tourStationAt(index);
    setStationIndex(index);
    setDetailGone(false);
    if (station !== 'detail') {
      setDemo(false);
      setDetailSparringId(null);
    }
    navigateTo(station);
    save('in_progress', index);
  }, [save]);

  const start = useCallback((fromIndex?: number): void => {
    setActive(true);
    goTo(fromIndex ?? resumeStation(savedStation));
  }, [goTo, savedStation]);

  const close = useCallback((result: 'completed' | 'skipped'): void => {
    const leavingDemo = demo;
    setActive(false);
    setDemo(false);
    setDetailSparringId(null);
    setDetailGone(false);
    save(result, null);
    // A demo is no real page: leave it into the real search.
    if (leavingDemo) navigateTo('discover');
  }, [demo, save]);

  const moveAllowed = (): boolean => {
    const now = Date.now();
    if (now - lastMoveAt.current < MOVE_LOCK_MS) return false;
    lastMoveAt.current = now;
    return true;
  };

  const next = useCallback((): void => {
    if (!moveAllowed()) return;
    if (stationIndex < TOUR_STATIONS.length - 1) goTo(stationIndex + 1);
    else close('completed');
  }, [stationIndex, goTo, close]);

  const back = useCallback((): void => {
    if (stationIndex > 0 && moveAllowed()) goTo(stationIndex - 1);
  }, [stationIndex, goTo]);

  const openRealDetail = useCallback((): void => {
    const id = discover?.candidateId ?? null;
    if (id === null) return;
    setDemo(false);
    setDetailSparringId(id);
    setDetailGone(false);
    setStationIndex(3);
    save('in_progress', 3);
  }, [discover, save]);

  const openDemo = useCallback((): void => {
    setDemo(true);
    setDetailSparringId(null);
    setDetailGone(false);
    setStationIndex(3);
    save('in_progress', 3);
  }, [save]);

  const detailClosed = useCallback((): void => {
    if (active && stationIndex === 3 && !demo) goTo(2);
  }, [active, stationIndex, demo, goTo]);

  const registerTarget = useCallback((key: TourTargetKey, ref: React.RefObject<View | null>) => {
    targets.current.set(key, ref);
    setLayoutTick((n) => n + 1);
    return () => {
      if (targets.current.get(key) === ref) targets.current.delete(key);
    };
  }, []);

  // Stable, so list rows registering a target do not re-render with the tour.
  const notifyLayout = useCallback((): void => setLayoutTick((n) => n + 1), []);
  const getTarget = useCallback((key: TourTargetKey) => targets.current.get(key), []);

  const api = useMemo<TourApi>(() => ({
    active,
    station: active ? tourStationAt(stationIndex) : null,
    stationIndex,
    demo,
    detailSparringId,
    detailGone,
    discover,
    userName,
    status,
    savedStation,
    start,
    next,
    back,
    skip: () => close('skipped'),
    finish: () => close('completed'),
    openRealDetail,
    openDemo,
    reportDiscover: setDiscover,
    markDetailGone: () => setDetailGone(true),
    detailClosed,
    registerTarget,
    getTarget,
    layoutTick,
    notifyLayout,
    freeBottom,
    reportFreeArea: setFreeBottom,
  }), [active, stationIndex, demo, detailSparringId, detailGone, discover, userName, status, savedStation,
    start, next, back, close, openRealDetail, openDemo, detailClosed, registerTarget, getTarget, layoutTick, notifyLayout,
    freeBottom]);

  const targetsApi = useMemo<TourTargetsApi>(() => ({ registerTarget, notifyLayout }), [registerTarget, notifyLayout]);

  return (
    <TourTargetsContext.Provider value={targetsApi}>
      <TourContext.Provider value={api}>{children}</TourContext.Provider>
    </TourTargetsContext.Provider>
  );
}

/** Tour state; outside the provider (signed out) an inert default. */
export function useTour(): TourApi {
  return useContext(TourContext) ?? INERT;
}

const noop = (): void => undefined;
const INERT: TourApi = {
  active: false, station: null, stationIndex: 0, demo: false, detailSparringId: null, detailGone: false,
  discover: null, userName: null, status: null, savedStation: null,
  start: noop, next: noop, back: noop, skip: noop, finish: noop, openRealDetail: noop, openDemo: noop,
  reportDiscover: noop, markDetailGone: noop, detailClosed: noop,
  registerTarget: () => noop, getTarget: () => undefined, layoutTick: 0, notifyLayout: noop,
  freeBottom: null, reportFreeArea: noop,
};

// Registers a View the tour may highlight. Returns the ref and an onLayout
// that makes the overlay measure again.
export function useTourTarget(key: TourTargetKey): {
  ref:      React.RefObject<View | null>;
  onLayout: () => void;
} {
  const targets = useContext(TourTargetsContext);
  const ref = useRef<View | null>(null);
  const register = targets?.registerTarget;
  useEffect(() => (register !== undefined ? register(key, ref) : undefined), [register, key]);
  const notify = targets?.notifyLayout;
  const onLayout = useCallback((): void => { notify?.(); }, [notify]);
  return { ref, onLayout };
}
