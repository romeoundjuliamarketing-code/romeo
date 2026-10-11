import React, { useEffect, useRef, useState } from 'react';
import { View, Text, BackHandler, StyleSheet, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { useTour, type TourTargetKey } from '../../context/TourContext';
import { TOUR_STATIONS, visibleHoles, type Rect, type TourStation } from '../../utils/tour';
import { playableChallengesForArea } from '../../utils/challengeAvailability';
import ChallengeCard from '../challenge/ChallengeCard';
import TourSpotlight from './TourSpotlight';
import TourPanel, { type TourFreeArea, type TourPanelAction } from './TourPanel';
import TourDemoSparring from './TourDemoSparring';
import { TOUR_SCENES } from './tourScenes';

// Elements each station highlights. The cards station highlights nothing: it
// shows one static example card itself instead of the tab's interactive
// showcase (pager, flip, counter).
const TARGETS: Record<TourStation, TourTargetKey[]> = {
  profile:  ['profileCard'],
  cards:    [],
  discover: ['discoverSearch', 'discoverFirst', 'discoverCreate'],
  detail:   ['detailHeader'],
};
// Measuring follows navigation and sheet animations for this long after a
// station change; afterwards target layout changes trigger a new measurement.
const SETTLE_MS = 1600;
const POLL_MS = 120;
// Example task: a short, easily understood card from the real deck. All
// delivered cards are rated "schwer", so the preview hides the rating.
const EXAMPLE_ID = 'k1-111';
const MAX_EXAMPLE_WIDTH = 300;

function measure(view: View): Promise<Rect | null> {
  return new Promise((resolve) => {
    view.measureInWindow((x, y, width, height) => {
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

// Coach tour over the real app pages. layer 'root' sits above the navigator
// (stations 1-3 and the demo); layer 'sheet' is rendered inside the real
// sparring sheet's Modal, which would otherwise cover it (station 4).
export default function TourOverlay({ layer }: { layer: 'root' | 'sheet' }): React.ReactElement | null {
  const tour = useTour();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const selfRef = useRef<View>(null);
  const [rects, setRects] = useState<Partial<Record<TourTargetKey, Rect>>>({});
  const [settleUntil, setSettleUntil] = useState(0);
  const [freeArea, setFreeArea] = useState<TourFreeArea | null>(null);
  const [example] = useState(() => playableChallengesForArea('kickboxen').find((c) => c.id === EXAMPLE_ID) ?? null);
  const reportFreeArea = tour.reportFreeArea;

  // The profile page scrolls its card above the coach group with this.
  useEffect(() => {
    if (layer === 'root' && freeArea !== null) reportFreeArea(freeArea.bottom);
  }, [layer, freeArea, reportFreeArea]);

  const station = tour.station;
  const realDetail = station === 'detail' && !tour.demo && tour.detailSparringId !== null && !tour.detailGone;
  const visible = tour.active && station !== null && (layer === 'sheet' ? realDetail : !realDetail);
  const stepKey = `${tour.stationIndex}-${tour.demo ? 'demo' : 'real'}-${tour.detailGone ? 'gone' : ''}`;

  useEffect(() => {
    setRects({});
    setSettleUntil(Date.now() + SETTLE_MS);
  }, [stepKey]);

  // Real positions only, measured relative to this overlay.
  useEffect(() => {
    if (!visible || station === null) return undefined;
    let cancelled = false;
    async function run(): Promise<void> {
      if (station === null) return;
      const self = selfRef.current;
      const origin = self !== null ? await measure(self) : null;
      const next: Partial<Record<TourTargetKey, Rect>> = {};
      for (const key of TARGETS[station]) {
        const view = tour.getTarget(key)?.current ?? null;
        const r = view !== null ? await measure(view) : null;
        if (r !== null) next[key] = { ...r, x: r.x - (origin?.x ?? 0), y: r.y - (origin?.y ?? 0) };
      }
      if (!cancelled) setRects(next);
    }
    void run();
    const timer = setInterval(() => {
      if (Date.now() > settleUntil) clearInterval(timer);
      else void run();
    }, POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [visible, station, tour.layoutTick, settleUntil, tour.getTarget]);

  // Android back steps back inside the tour instead of leaving the page.
  useEffect(() => {
    if (!visible || layer !== 'root') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      tour.back();
      return true;
    });
    return () => sub.remove();
  }, [visible, layer, tour.back]);

  // While the real sheet opens above, the root layer only blocks touches, so
  // the list behind cannot be tapped during the sheet's entrance.
  if (layer === 'root' && tour.active && realDetail) {
    return <View style={styles.root} onStartShouldSetResponder={() => true} />;
  }
  if (!visible || station === null) return null;

  const progress = t('onboarding.tour.progress', { step: tour.stationIndex + 1, total: TOUR_STATIONS.length });
  const back = tour.stationIndex > 0 ? tour.back : undefined;
  // Holes only where the explained element shows between progress row and
  // coach group; without any (still measuring, missing anchor) the page is
  // simply dimmed and the tour stays usable.
  const measured = Object.values(rects).filter((r): r is Rect => r !== undefined);
  const holes = freeArea !== null ? visibleHoles(measured, freeArea) : [];

  let title = '';
  let body = '';
  let hint: string | undefined;
  let stage: React.ReactNode;
  let primary: TourPanelAction = { label: '', onPress: tour.next };
  let secondary: TourPanelAction | undefined;

  if (station === 'profile') {
    title = t('onboarding.tour.profile.title');
    body = t('onboarding.tour.profile.body');
    primary = { label: t('onboarding.tour.profile.next'), onPress: tour.next };
  } else if (station === 'cards') {
    title = t('onboarding.tour.cards.title');
    body = t('onboarding.tour.cards.body');
    hint = t('onboarding.tour.cards.hint');
    if (example !== null) {
      stage = (
        <View style={styles.example} pointerEvents="none">
          <Text style={styles.exampleBadge}>{t('onboarding.tour.cards.badge')}</Text>
          <ChallengeCard
            challenge={example}
            size={{ width: Math.min(width - 32, MAX_EXAMPLE_WIDTH), height: 0 }}
            scrollable={false}
            elevated={false}
            preview
          />
        </View>
      );
    }
    primary = { label: t('onboarding.tour.cards.next'), onPress: tour.next };
  } else if (station === 'discover') {
    title = t('onboarding.tour.discover.title');
    body = t('onboarding.tour.discover.body');
    hint = t('onboarding.tour.discover.createHint');
    const info = tour.discover;
    if (info?.status === 'error') {
      hint = t('onboarding.tour.discover.loadFailed');
      primary = { label: t('onboarding.tour.discover.openDemo'), onPress: tour.openDemo };
      secondary = { label: t('onboarding.tour.discover.retry'), onPress: info.retry };
    } else if (info === null || info.status === 'loading') {
      primary = { label: t('onboarding.tour.discover.loading'), onPress: () => undefined };
      secondary = { label: t('onboarding.tour.discover.openDemo'), onPress: tour.openDemo };
    } else if (info.candidateId !== null) {
      primary = { label: t('onboarding.tour.discover.openReal'), onPress: tour.openRealDetail };
    } else {
      primary = { label: t('onboarding.tour.discover.openDemo'), onPress: tour.openDemo };
    }
  } else {
    title = t('onboarding.tour.detail.title');
    body = t('onboarding.tour.detail.body');
    if (tour.detailGone) {
      hint = t('onboarding.tour.detail.gone');
      primary = { label: t('onboarding.tour.discover.openDemo'), onPress: tour.openDemo };
    } else if (tour.demo) {
      primary = { label: t('onboarding.tour.detail.demoDone'), onPress: tour.finish };
    } else {
      primary = { label: t('onboarding.tour.detail.done'), onPress: tour.finish };
    }
  }

  return (
    <View
      ref={selfRef}
      style={styles.root}
      // Background taps never reach the page: no accidental join, create or paywall.
      // The tour's own controls sit above it and stay usable.
      onStartShouldSetResponder={() => true}
      accessibilityViewIsModal
    >
      {station === 'detail' && tour.demo && <TourDemoSparring />}
      <TourSpotlight rects={holes} />
      <TourPanel
        onFreeArea={setFreeArea}
        stepKey={stepKey}
        progress={progress}
        title={title}
        body={body}
        hint={hint}
        stage={stage}
        scene={TOUR_SCENES[station]}
        primary={primary}
        secondary={secondary}
        backLabel={t('onboarding.tour.back')}
        onBack={back}
        skipLabel={t('onboarding.tour.skip')}
        onSkip={tour.skip}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject },
  example: {
    alignItems: 'center',
    gap:        8,
  },
  exampleBadge: {
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      8,
    overflow:          'hidden',
    fontSize:          12,
    fontWeight:        '700',
    color:             colors.headerTextPrimary,
    backgroundColor:   colors.tourPill,
  },
});
