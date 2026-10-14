import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, useWindowDimensions } from 'react-native';
import type { AccessibilityActionEvent, LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import ChallengeCard from '../challenge/ChallengeCard';
import { CARD_ASPECT, CARD_RADIUS } from '../challenge/cardLayout';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { useLocalized } from '../../i18n/language';

interface Props {
  cards:  SparringChallenge[];
  /** Tap on the fan: the existing card game entry (nothing is drawn here). */
  onOpen: () => void;
}

// Home content is capped at 600 pt with a 16 pt gutter per side.
const HOME_MAX_WIDTH = 600;
const PAGE_GUTTER    = 16;
const SWITCH_MS      = 320;
// Finger travel / fling speed that counts as a card change.
const SWIPE_MIN      = 40;
const FLING_MIN      = 500;

function wrapRel(index: number, offset: number, count: number): number {
  'worklet';
  const half = count / 2;
  return ((((index - offset) % count) + count + half) % count) - half;
}

function mod(n: number, count: number): number {
  'worklet';
  return ((n % count) + count) % count;
}

// Large interactive fan of real card fronts for the Home "Sparring Cards"
// teaser. The front card is fully readable; the other two fan out left and
// right. A clearly horizontal swipe (or the arrow buttons) moves the front
// card aside and brings the next one forward — preview only, no round starts
// and nothing is stored. Vertical drags stay with the page scroll.
export default function HomeCardFan({ cards, onOpen }: Props): React.ReactElement | null {
  const { t } = useTranslation();
  const tx = useLocalized();
  const { width, fontScale } = useWindowDimensions();
  const count = cards.length;

  const inner = Math.min(width, HOME_MAX_WIDTH) - 2 * PAGE_GUTTER;
  // Small screens or large text: wider front card for readability, flatter fan.
  const roomy     = width >= 360 && fontScale <= 1.3;
  // Very large text: the card takes the full content width (long title words
  // must fit one line), the back cards then only show by their tilt.
  const fullWidth = !roomy && fontScale > 1.6;
  const cardW     = Math.round(roomy ? Math.min(width * 0.6, 300) : fullWidth ? Math.min(inner, 340) : Math.min(inner * 0.84, 320));
  const backTilt  = roomy ? 12 : fullWidth ? 4 : 7;
  const frontTilt = roomy ? -3 : -2;

  // Height follows the longest of the three texts (measured off-screen once),
  // so every card shows its task in full without empty space.
  const [heights, setHeights] = useState<Record<string, number>>({});
  const measured = cards.map((card) => heights[`${card.id}:${cardW}`]).filter((h): h is number => h !== undefined);
  const cardH = measured.length === count && count > 0
    ? Math.ceil(Math.max(...measured))
    : Math.round(cardW / CARD_ASPECT);
  const onMeasure = useCallback((key: string) => (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setHeights((prev) => (prev[key] === h ? prev : { ...prev, [key]: h }));
  }, []);

  // Back cards are pushed out as far as the turned card still fits the page
  // (plus half the gutter), so their coloured heads show beside the front card.
  const rad      = (backTilt * Math.PI) / 180;
  const bboxHalfW = (cardW * Math.cos(rad) + cardH * Math.sin(rad)) / 2;
  const bboxHalfH = (cardH * Math.cos(rad) + cardW * Math.sin(rad)) / 2;
  const dx       = Math.max(fullWidth ? 0 : 8, Math.min(cardW * 0.4, inner / 2 + PAGE_GUTTER / 2 - bboxHalfW));
  const dy       = 8;
  const padV     = Math.ceil(bboxHalfH - cardH / 2 + dy + 8);
  const geometry = useMemo(() => ({ dx, dy, backTilt, frontTilt }), [dx, dy, backTilt, frontTilt]);

  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(0);
  const start  = useSharedValue(0);
  const [index, setIndex] = useState(0);

  const goTo = useCallback((target: number) => {
    'worklet';
    const settle = mod(Math.round(target), count);
    if (reduceMotion) {
      offset.value = target;
      runOnJS(setIndex)(settle);
      return;
    }
    offset.value = withTiming(target, { duration: SWITCH_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished === true) runOnJS(setIndex)(settle);
    });
  }, [count, reduceMotion, offset]);

  const step = useCallback((dir: 1 | -1) => {
    goTo(Math.round(offset.value) + dir);
  }, [goTo, offset]);

  const swipeDistance = cardW * 0.9;
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      // Only a clearly horizontal drag switches cards; vertical movement
      // fails the pan first, so the page keeps scrolling.
      .activeOffsetX([-16, 16])
      .failOffsetY([-12, 12])
      .onBegin(() => {
        start.value = Math.round(offset.value);
      })
      .onUpdate((e) => {
        if (reduceMotion) return;
        const next = start.value - e.translationX / swipeDistance;
        offset.value = Math.max(start.value - 1, Math.min(start.value + 1, next));
      })
      .onEnd((e) => {
        let target = start.value;
        if (e.translationX < -SWIPE_MIN || e.velocityX < -FLING_MIN) target = start.value + 1;
        else if (e.translationX > SWIPE_MIN || e.velocityX > FLING_MIN) target = start.value - 1;
        goTo(target);
      });
    const tap = Gesture.Tap().onEnd((_e, success) => {
      if (success) runOnJS(onOpen)();
    });
    return Gesture.Race(pan, tap);
  }, [goTo, offset, start, reduceMotion, swipeDistance, onOpen]);

  if (count === 0) return null;

  const current = cards[index] ?? cards[0];
  const a11yLabel = t('home.cards.fanLabel', {
    pos: index + 1, count, title: tx(current.title), task: tx(current.instruction),
  });
  function onA11yAction(e: AccessibilityActionEvent): void {
    if (e.nativeEvent.actionName === 'increment') step(1);
    if (e.nativeEvent.actionName === 'decrement') step(-1);
    if (e.nativeEvent.actionName === 'activate') onOpen();
  }

  const size  = { width: cardW, height: cardH };
  const stage = { height: cardH + 2 * padV };
  const slot  = { width: cardW, height: cardH, top: padV, left: (inner - cardW) / 2 };
  const oval  = {
    width:        Math.min(inner + PAGE_GUTTER, cardW + 2 * dx + 64),
    height:       Math.round(cardH * 0.42),
    borderRadius: cardH,
    bottom:       Math.max(0, padV - 24),
  };

  return (
    <View style={styles.root}>
      <GestureDetector gesture={gesture}>
        <View
          style={[styles.stage, stage]}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={a11yLabel}
          accessibilityHint={t('home.cards.fanHint')}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate' }]}
          onAccessibilityAction={onA11yAction}
        >
          <View style={[styles.oval, oval]} pointerEvents="none" />

          {/* Off-screen measuring copies: natural height of each card at this width. */}
          <View style={styles.measure} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {cards.map((card) => (
              <View key={card.id} onLayout={onMeasure(`${card.id}:${cardW}`)}>
                <ChallengeCard challenge={card} size={size} fitContent scrollable={false} elevated={false} areaOnly />
              </View>
            ))}
          </View>

          {cards.map((card, i) => (
            <FanCard key={card.id} index={i} count={count} offset={offset} geometry={geometry} slot={slot}>
              <ChallengeCard challenge={card} size={size} scrollable={false} elevated={false} areaOnly />
            </FanCard>
          ))}
        </View>
      </GestureDetector>

      <View style={styles.controls}>
        <Pressable
          style={({ pressed }) => [styles.arrow, pressed && styles.arrowPressed]}
          onPress={() => step(-1)}
          accessibilityRole="button"
          accessibilityLabel={t('home.cards.prev')}
          hitSlop={4}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.hint}>{t('home.cards.swipeHint')}</Text>
        <Pressable
          style={({ pressed }) => [styles.arrow, pressed && styles.arrowPressed]}
          onPress={() => step(1)}
          accessibilityRole="button"
          accessibilityLabel={t('home.cards.next')}
          hitSlop={4}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

interface FanGeometry { dx: number; dy: number; backTilt: number; frontTilt: number }

// One card of the fan. Its pose follows its distance to the front slot
// (0 = front, ±1 = back left/right); the card wrapping around behind the
// others fades out and in, so the fan never jumps.
function FanCard({ index, count, offset, geometry, slot, children }: {
  index:    number;
  count:    number;
  offset:   SharedValue<number>;
  geometry: FanGeometry;
  slot:     { width: number; height: number; top: number; left: number };
  children: React.ReactNode;
}): React.ReactElement {
  const pose = useAnimatedStyle(() => {
    const rel  = wrapRel(index, offset.value, count);
    const a    = Math.max(-1, Math.min(1, rel));
    const dist = Math.abs(rel);
    const fade = dist <= 1 ? 1 : Math.max(0, 1 - (dist - 1) * 2);
    return {
      opacity:   fade,
      zIndex:    Math.round(100 - dist * 40),
      elevation: dist < 0.5 ? 8 : 3,
      transform: [
        { translateX: a * geometry.dx },
        { translateY: Math.abs(a) * geometry.dy },
        { rotate: `${geometry.frontTilt * (1 - Math.abs(a)) + a * geometry.backTilt}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[styles.card, slot, pose]} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {children}
    </Animated.View>
  );
}

// Soft, low shadow: the cards rest on the stage, they do not float.
const cardShadow = Platform.select({
  ios:     { shadowColor: colors.dark, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 16 },
  android: {},
});

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
  },
  stage: {
    alignSelf: 'stretch',
  },
  // Light blue stage under the lower part of the fan, peeking out at the sides.
  oval: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: colors.accentBlueTint,
  },
  measure: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0,
  },
  // Dark fill matches the card's 2 pt dark border, so the rounded corners stay
  // clean (Android elevation needs a background to cast the shadow).
  card: {
    position: 'absolute',
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.dark,
    ...cardShadow,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  arrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  arrowPressed: {
    backgroundColor: colors.darkMuted,
  },
  hint: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
});
