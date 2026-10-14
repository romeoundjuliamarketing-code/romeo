import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Line, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import { useLocalized } from '../../i18n/language';
import CardPreviewFace from './CardPreviewFace';
import { CARD_RADIUS } from './cardLayout';

// Change = front card slides aside with a slight turn (OUT_MS), the next one moves
// forward (IN_MS); ~300 ms in total.
const OUT_MS = 160;
const IN_MS  = 140;
const MAX_CARD_WIDTH = 300;
const MIN_CARD_HEIGHT = 300;
// Tilt and sideways shift of the two backs: only narrow strips show.
const LEFT_TILT  = -5;
const RIGHT_TILT = 6;
const BACK_SHIFT = 10;

// Soft blue light behind the deck; fades to nothing, so no box edge shows.
function DeckGlow(): React.ReactElement {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <RadialGradient id="deckGlow" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={colors.accentBlue} stopOpacity="0.14" />
          <Stop offset="1" stopColor={colors.accentBlue} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill="url(#deckGlow)" />
    </Svg>
  );
}

// A card back behind the example: solid fill with a restrained diagonal line
// pattern and a fine inset keyline.
function BackPlate({ width, height, fill, id }: { width: number; height: number; fill: string; id: string }): React.ReactElement {
  return (
    <View style={[styles.backPlate, { width, height, backgroundColor: fill }]}>
      <Svg width={width} height={height}>
        <Defs>
          <Pattern id={id} width={12} height={12} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Line x1={0} y1={0} x2={0} y2={12} stroke={colors.cardBackPattern} strokeWidth={2} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} />
        <Rect
          x={8.5}
          y={8.5}
          width={width - 17}
          height={height - 17}
          rx={CARD_RADIUS - 8}
          stroke={colors.cardBackKeyline}
          strokeWidth={1}
          fill="none"
        />
      </Svg>
    </View>
  );
}

interface Props {
  cards: SparringChallenge[];
}

// The example deck on the Karten tab: one readable front card framed by two card
// backs. Tapping the card or the row below shows the next released example.
// Preview only — no round starts, no paywall, nothing stored.
export default function CardsPreviewDeck({ cards }: Props): React.ReactElement | null {
  const { t } = useTranslation();
  const tx = useLocalized();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [areaWidth, setAreaWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const busy = useRef(false);
  const count = cards.length;

  const inner = areaWidth > 0 ? areaWidth : windowWidth - 32;
  const cardW = Math.round(Math.min(inner - 48, MAX_CARD_WIDTH));

  // All examples share the height of the tallest one (measured off-screen), so the
  // deck never jumps between cards and every task shows in full.
  const [heights, setHeights] = useState<Record<string, number>>({});
  const keyFor = (id: string): string => `${id}:${cardW}:${fontScale}`;
  const measured = cards.map((card) => heights[keyFor(card.id)]).filter((h): h is number => h !== undefined);
  // While a new width or text size is being measured, the last height stays in
  // place so the deck never blanks out.
  const lastHeight = useRef<number | null>(null);
  const cardH = measured.length === count && count > 0
    ? Math.max(MIN_CARD_HEIGHT, Math.ceil(Math.max(...measured)))
    : lastHeight.current;
  lastHeight.current = cardH;
  const onMeasure = useCallback((key: string) => (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setHeights((prev) => (prev[key] === h ? prev : { ...prev, [key]: h }));
  }, []);

  // Vertical room for the tilted backs above and below the front card.
  const h = cardH ?? MIN_CARD_HEIGHT;
  const rad = (RIGHT_TILT * Math.PI) / 180;
  const padV = Math.ceil((h * Math.cos(rad) + cardW * Math.sin(rad)) / 2 - h / 2 + 4);

  // 0 = at rest; `lift` 0 -> 1 moves the front card out, `incoming` 1 -> 0 brings
  // the next one forward.
  const lift = useSharedValue(0);
  const incoming = useSharedValue(0);

  const frontStyle = useAnimatedStyle(() => {
    if (lift.value === 0 && incoming.value === 0) return { opacity: 1, transform: [] };
    if (lift.value > 0) {
      return {
        opacity: 1 - lift.value,
        transform: [
          { translateX: lift.value * cardW * 0.35 },
          { rotate: `${lift.value * 8}deg` },
        ],
      };
    }
    return {
      opacity: 1 - incoming.value,
      transform: [{ translateY: incoming.value * 10 }, { scale: 1 - incoming.value * 0.04 }],
    };
  });

  const settled = useCallback(() => { busy.current = false; }, []);
  const advance = useCallback(() => {
    setIndex((prev) => (prev + 1) % count);
  }, [count]);

  // After the swap the new content is in place (still invisible): bring it forward.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (reduceMotion) return;
    incoming.value = 1;
    lift.value = 0;
    incoming.value = withTiming(0, { duration: IN_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished === true) runOnJS(settled)();
    });
  }, [index, reduceMotion, incoming, lift, settled]);

  const next = (): void => {
    if (busy.current || count < 2) return;
    if (reduceMotion) {
      advance();
      return;
    }
    busy.current = true;
    lift.value = withTiming(1, { duration: OUT_MS, easing: Easing.in(Easing.quad) }, (finished) => {
      if (finished === true) runOnJS(advance)();
    });
  };

  if (count === 0) return null;
  const current = cards[index] ?? cards[0];
  const pad2 = (n: number): string => String(n).padStart(2, '0');

  const stageStyle = { height: h + 2 * padV };
  const slotStyle  = { width: cardW, height: h, top: padV, left: (inner - cardW) / 2 };
  const leftBack   = { transform: [{ translateX: -BACK_SHIFT }, { rotate: `${LEFT_TILT}deg` }] };
  const rightBack  = { transform: [{ translateX: BACK_SHIFT }, { translateY: 4 }, { rotate: `${RIGHT_TILT}deg` }] };
  const rowStyle   = { width: cardW };

  return (
    <View onLayout={(e) => setAreaWidth(Math.round(e.nativeEvent.layout.width))}>
      {/* Off-screen measurement of every example at the current width and text size. */}
      <View style={styles.measure} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {cards.map((card) => (
          <CardPreviewFace key={card.id} card={card} width={cardW} onLayout={onMeasure(keyFor(card.id))} />
        ))}
      </View>

      <View style={[styles.stage, stageStyle]}>
        <View style={styles.glow} pointerEvents="none">
          <DeckGlow />
        </View>
        {cardH !== null ? (
          <>
            <View style={[styles.slot, slotStyle, leftBack]} pointerEvents="none">
              <BackPlate width={cardW} height={h} fill={colors.cardBackDeep} id="backDeep" />
            </View>
            <View style={[styles.slot, slotStyle, rightBack]} pointerEvents="none">
              <BackPlate width={cardW} height={h} fill={colors.accentBlue} id="backBlue" />
            </View>
            <Pressable
              style={[styles.slot, slotStyle]}
              onPress={next}
              accessibilityRole="button"
              accessibilityLabel={t('challenge.landing.deckLabel', {
                index: index + 1, total: count, title: tx(current.title), instruction: tx(current.instruction),
              })}
              accessibilityHint={t('challenge.landing.deckA11yHint')}
            >
              <Animated.View style={frontStyle}>
                <CardPreviewFace card={current} width={cardW} height={cardH} />
              </Animated.View>
            </Pressable>
          </>
        ) : null}
      </View>

      {count > 1 ? (
        <View style={[styles.row, rowStyle]}>
          <Pressable
            style={({ pressed }) => [styles.nextButton, pressed && styles.nextButtonPressed]}
            onPress={next}
            accessibilityRole="button"
            accessibilityHint={t('challenge.landing.deckA11yHint')}
          >
            <Text style={styles.nextText}>{t('challenge.landing.nextExample')}</Text>
            <Ionicons name="refresh" size={16} color={colors.accentBlueText} />
          </Pressable>
          <Text
            style={styles.counter}
            accessibilityLabel={t('challenge.landing.progress', { index: index + 1, total: count })}
          >
            {`${pad2(index + 1)} / ${pad2(count)}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  measure: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0,
  },
  stage: {
    width: '100%',
  },
  // Bleeds past the content gutter so the light fades out towards the screen edge.
  glow: {
    position: 'absolute',
    top: -16,
    bottom: -16,
    left: -16,
    right: -16,
  },
  slot: {
    position: 'absolute',
  },
  backPlate: {
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
  },
  row: {
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 16,
  },
  nextButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextButtonPressed: {
    opacity: 0.6,
  },
  nextText: {
    color: colors.accentBlueText,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
  },
  counter: {
    color: colors.textMuted,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
});
