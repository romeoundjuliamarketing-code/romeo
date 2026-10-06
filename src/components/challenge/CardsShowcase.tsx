import React, { memo, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import { useTranslation } from 'react-i18next';
import SparrLogo from '../common/SparrLogo';
import ChallengeCard from './ChallengeCard';
import ChallengeCardBack from './ChallengeCardBack';
import { CARD_RADIUS } from './cardLayout';

const FLIP_MS  = 320;
const FAN_MS   = 520;
const PRESS_MS = 90;

// How far the card stack reaches below the dark stage.
const OVERHANG = 40;
// Widest the example card gets, so it keeps card proportions on tablets.
const MAX_CARD_WIDTH = 300;

// Static stage behind the stack: near-black with a restrained blue light from above.
function StageBackground(): React.ReactElement {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 400" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <RadialGradient id="stageGlow" cx="0.5" cy="0.3" r="0.6">
          <Stop offset="0" stopColor={colors.accentBlue} stopOpacity="0.32" />
          <Stop offset="1" stopColor={colors.accentBlue} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="400" height="400" fill={colors.dark} />
      <Rect x="0" y="0" width="400" height="400" fill="url(#stageGlow)" />
    </Svg>
  );
}

interface FlipCardProps {
  card:         SparringChallenge;
  width:        number;
  reduceMotion: boolean;
}

// One example card with two faces. Tapping turns it to the back and again to the
// front. At rest neither face carries a transform, so text stays sharp (see
// docs/ui-performance.md, "Ruhezustand ist scharf").
const FlipCard = memo(function FlipCard({ card, width, reduceMotion }: FlipCardProps): React.ReactElement {
  const { t } = useTranslation();
  const [showBack, setShowBack] = useState(false);
  const [height, setHeight]     = useState<number | null>(null);
  // 0 = front, 180 = back
  const flip  = useSharedValue(0);
  const press = useSharedValue(1);

  const toggle = (): void => {
    const next = !showBack;
    setShowBack(next);
    const target = next ? 180 : 0;
    flip.value = reduceMotion
      ? target
      : withTiming(target, { duration: FLIP_MS, easing: Easing.inOut(Easing.cubic) });
  };

  const frontStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 90 ? 1 : 0,
    transform: flip.value === 0 ? [] : [{ perspective: 1600 }, { rotateY: `${flip.value}deg` }],
  }));

  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 90 ? 0 : 1,
    transform: flip.value === 180 ? [] : [{ perspective: 1600 }, { rotateY: `${flip.value - 180}deg` }],
  }));

  const pressStyle = useAnimatedStyle(() => ({
    transform: press.value === 1 ? [] : [{ scale: press.value }],
  }));

  const onFrontLayout = (e: LayoutChangeEvent): void => {
    const next = Math.round(e.nativeEvent.layout.height);
    setHeight((prev) => (prev === next ? prev : next));
  };

  return (
    <Pressable
      onPress={toggle}
      onPressIn={() => { if (!reduceMotion) press.value = withTiming(0.97, { duration: PRESS_MS }); }}
      onPressOut={() => { press.value = reduceMotion ? 1 : withTiming(1, { duration: PRESS_MS }); }}
      accessibilityRole="button"
      accessibilityLabel={showBack
        ? t('challenge.showcase.backLabel')
        : t('challenge.showcase.frontLabel', { title: card.title, instruction: card.instruction })}
      accessibilityHint={showBack ? t('challenge.showcase.hintShow') : t('challenge.showcase.hintFlip')}
    >
      <Animated.View style={pressStyle}>
        <Animated.View style={frontStyle} onLayout={onFrontLayout}>
          <ChallengeCard
            challenge={card}
            size={{ width, height: width }}
            scrollable={false}
            elevated={false}
            fitContent
          />
        </Animated.View>
        {height !== null ? (
          <Animated.View style={[styles.backFace, backStyle]} pointerEvents="none">
            <ChallengeCardBack size={{ width, height }} elevated={false} />
          </Animated.View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
});

interface Props {
  cards: SparringChallenge[];
}

// The cards as the centre of the Karten tab: a stack on a dark stage whose front card
// is a real, released example. Tap turns it over, a horizontal swipe (or the arrow
// buttons) moves between the examples. Nothing here starts a game or changes progress.
export default function CardsShowcase({ cards }: Props): React.ReactElement {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [pageWidth, setPageWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const pagerRef = useRef<ScrollView>(null);

  const cardWidth = Math.round(Math.min((pageWidth || windowWidth) - 80, MAX_CARD_WIDTH));
  const multiple  = cards.length > 1;

  // The stack fans out once when it first appears.
  const fan = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    fan.value = withTiming(1, { duration: FAN_MS, easing: Easing.out(Easing.cubic) });
  }, [reduceMotion, fan]);

  const farStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: 16 * fan.value }, { rotate: `${7 * fan.value}deg` }],
  }));
  const nearStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: 8 * fan.value }, { rotate: `${3.5 * fan.value}deg` }],
  }));

  const goTo = (next: number): void => {
    const clamped = Math.max(0, Math.min(cards.length - 1, next));
    setIndex(clamped);
    pagerRef.current?.scrollTo({ x: clamped * pageWidth, animated: !reduceMotion });
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    if (pageWidth === 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    setIndex((prev) => (prev === next ? prev : next));
  };

  if (cards.length === 0) {
    // No released example: the stack shows the real card back only.
    return (
      <View style={styles.wrap}>
        <View style={styles.stage}>
          <StageBackground />
        </View>
        <View style={styles.backOnly}>
          <ChallengeCardBack size={{ width: 200, height: Math.round(200 / 0.7) }} elevated={false} />
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.wrap} onLayout={(e) => setPageWidth(Math.round(e.nativeEvent.layout.width))}>
        <View style={styles.stage}>
          <StageBackground />
          {/* Large cropped penguin, a quiet texture behind the stack. */}
          <View style={styles.watermark} pointerEvents="none">
            <SparrLogo size={260} opacity={0.07} />
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t('challenge.showcase.badge')}</Text>
          </View>
        </View>

        {pageWidth > 0 ? (
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            scrollEnabled={multiple}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumEnd}
            contentContainerStyle={styles.pagerContent}
          >
            {cards.map((card) => (
              <View key={card.id} style={[styles.page, { width: pageWidth }]}>
                <View>
                  <Animated.View style={[styles.stackCard, styles.stackFar, farStyle]} pointerEvents="none" />
                  <Animated.View style={[styles.stackCard, styles.stackNear, nearStyle]} pointerEvents="none" />
                  <FlipCard card={card} width={cardWidth} reduceMotion={reduceMotion} />
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <View style={styles.controls}>
        {multiple ? (
          <View style={styles.pagerRow}>
            <TouchableOpacity
              style={styles.arrow}
              onPress={() => goTo(index - 1)}
              disabled={index === 0}
              accessibilityRole="button"
              accessibilityLabel={t('challenge.showcase.prev')}
              accessibilityState={{ disabled: index === 0 }}
            >
              <Ionicons name="chevron-back" size={20} color={index === 0 ? colors.hairline : colors.text} />
            </TouchableOpacity>
            <Text style={styles.counter} accessibilityLabel={t('challenge.showcase.counter', { index: index + 1, total: cards.length })}>
              {index + 1} / {cards.length}
            </Text>
            <TouchableOpacity
              style={styles.arrow}
              onPress={() => goTo(index + 1)}
              disabled={index === cards.length - 1}
              accessibilityRole="button"
              accessibilityLabel={t('challenge.showcase.next')}
              accessibilityState={{ disabled: index === cards.length - 1 }}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={index === cards.length - 1 ? colors.hairline : colors.text}
              />
            </TouchableOpacity>
          </View>
        ) : null}
        <Text style={styles.hint}>
          {multiple ? t('challenge.showcase.hintMultiple') : t('challenge.showcase.hintSingle')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 48,
  },
  // Ends OVERHANG above the bottom, so the cards reach past its lower edge.
  stage: {
    ...StyleSheet.absoluteFillObject,
    bottom: OVERHANG,
    borderRadius: 24,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    right: -72,
    top: -40,
  },
  badge: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  badgeText: {
    color: colors.headerTextSecondary,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 2,
  },
  backOnly: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  pagerContent: {
    alignItems: 'flex-start',
  },
  page: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  // Filled card backs behind the front card; they follow its height.
  stackCard: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: CARD_RADIUS,
    borderWidth: 2,
    borderColor: colors.dark,
  },
  stackFar: {
    backgroundColor: colors.cardStackFar,
  },
  stackNear: {
    backgroundColor: colors.cardStackNear,
  },
  backFace: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  controls: {
    marginTop: 8,
    alignItems: 'center',
    gap: 4,
  },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    minWidth: 48,
    textAlign: 'center',
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  hint: {
    textAlign: 'center',
    color: colors.textMuted,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
});
