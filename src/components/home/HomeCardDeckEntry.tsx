import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, useWindowDimensions } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import ChallengeCard from '../challenge/ChallengeCard';
import ChallengeCardBack from '../challenge/ChallengeCardBack';
import { CARD_ASPECT, CARD_RADIUS } from '../challenge/cardLayout';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { useTranslation } from 'react-i18next';

interface Props {
  /** The fixed free K-1 example card; null → the card back is shown. */
  preview: SparringChallenge | null;
  /** Opens the existing card game entry (onboarding, access and paywall live there). */
  onDraw:  () => void;
}

// Home content is capped at 600 pt with a 16 pt gutter per side.
const HOME_MAX_WIDTH = 600;
const PAGE_GUTTER    = 16;
// Width is capped by the screen height too, so on small phones the start of the
// sparring section still shows below the button.
const MAX_FRONT_WIDTH   = 240;
const WIDTH_FRACTION    = 0.64;
const HEIGHT_FRACTION   = 0.38;
const MIN_FRONT_WIDTH   = 200;
// The real card face is laid out at least this wide (narrower, its brand band
// breaks words) and scaled down only slightly — title and task stay readable.
const MIN_RENDER_WIDTH  = 264;
const MAX_FONT_SCALE    = 2;
// Room for the fanned cards on each side and below/above the front card.
const FAN_SIDE = 32;
const FAN_TOP  = 16;

// Resting pose of the two cards behind the front one.
const FAR  = { rotate: -9, x: -26, y: 8 };
const NEAR = { rotate: 7,  x: 24,  y: 6 };
const FAN_DURATION = 520;

function backCardStyle(progress: SharedValue<number>, pose: typeof FAR) {
  'worklet';
  return {
    opacity:   progress.value,
    transform: [
      { translateX: pose.x * progress.value },
      { translateY: pose.y * progress.value },
      { rotate: `${pose.rotate * progress.value}deg` },
    ],
  };
}

// "Was steht diese Runde an?": the card stack is the eye-catcher of Home — a
// real, readable K-1 task in front, two turned cards behind it, a soft blue
// oval underneath. Stack and button both open the card game; nothing is drawn
// or started here. The stack fans out once on first show (transform/opacity
// only, skipped with reduced motion).
export default function HomeCardDeckEntry({ preview, onDraw }: Props) {
  const { t } = useTranslation();
  const { width, height, fontScale } = useWindowDimensions();
  const inner      = Math.min(width, HOME_MAX_WIDTH) - 2 * PAGE_GUTTER;
  const cardWidth  = Math.round(Math.max(MIN_FRONT_WIDTH, Math.min(
    MAX_FRONT_WIDTH,
    inner * WIDTH_FRACTION,
    height * HEIGHT_FRACTION * CARD_ASPECT,
  )));
  const cardHeight = Math.round(cardWidth / CARD_ASPECT);
  // Large system text: the fixed-size face is laid out wider (and scaled down
  // more), so its text keeps the card's layout instead of being cut off. The
  // full task is in the accessibility label.
  const renderWidth = Math.max(cardWidth, MIN_RENDER_WIDTH * Math.min(Math.max(fontScale, 1), MAX_FONT_SCALE));
  const scale      = cardWidth / renderWidth;
  const size       = { width: renderWidth, height: Math.round(renderWidth / CARD_ASPECT) };
  const scaler     = {
    left:      (cardWidth - size.width) / 2,
    top:       (cardHeight - size.height) / 2,
    transform: [{ scale }],
  };
  const stage      = { width: cardWidth + 2 * FAN_SIDE, height: cardHeight + 2 * FAN_TOP };
  const oval       = {
    width:        Math.min(inner, Math.round(cardWidth * 1.7)),
    height:       Math.round(cardHeight * 0.5),
    borderRadius: cardHeight,
  };
  // Same corner as the scaled card face, so stack and shadow follow its edge.
  const cardBox    = { width: cardWidth, height: cardHeight, borderRadius: CARD_RADIUS * scale };

  const reduceMotion = useReducedMotion();
  const progress     = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, { duration: FAN_DURATION, easing: Easing.out(Easing.cubic) });
  }, [reduceMotion, progress]);

  const farStyle   = useAnimatedStyle(() => backCardStyle(progress, FAR));
  const nearStyle  = useAnimatedStyle(() => backCardStyle(progress, NEAR));
  const frontStyle = useAnimatedStyle(() => ({
    opacity:   0.4 + 0.6 * progress.value,
    transform: [{ translateY: 8 * (1 - progress.value) }, { rotate: `${-1 * progress.value}deg` }],
  }));

  const a11yLabel = preview !== null
    ? t('home.cards.openWithPreview', { title: preview.title })
    : t('home.cards.open');

  return (
    <View style={styles.root}>
      <Text style={styles.heading} accessibilityRole="header">{t('home.cards.heading')}</Text>

      <Pressable
        onPress={onDraw}
        style={({ pressed }) => [styles.stage, stage, pressed && styles.stagePressed]}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint={t('home.cards.openHint')}
      >
        <View style={[styles.oval, oval]} pointerEvents="none" />
        <View style={styles.cards} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Animated.View style={[styles.backCard, styles.backFar, cardBox, farStyle]} />
          <Animated.View style={[styles.backCard, styles.backNear, cardBox, nearStyle]} />
          <Animated.View style={[styles.frontCard, cardBox, frontStyle]}>
            <View style={[styles.scaler, scaler]}>
              {preview !== null
                ? <ChallengeCard challenge={preview} size={size} scrollable={false} elevated={false} />
                : <ChallengeCardBack size={size} elevated={false} />}
            </View>
          </Animated.View>
        </View>
      </Pressable>

      <View style={styles.sportTag}>
        <Ionicons name="layers-outline" size={14} color={colors.accentBlueText} />
        <Text style={styles.sportText}>{t('home.cards.discipline')}</Text>
      </View>

      <Pressable
        onPress={onDraw}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityHint={t('home.cards.openHint')}
      >
        <Text style={styles.buttonText}>{t('home.cards.button')}</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.card} />
      </Pressable>
    </View>
  );
}

// Softer than the deck's cardShadow: the stack rests on the page, it does not float.
const frontShadow = Platform.select({
  ios:     { shadowColor: colors.dark, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16 },
  android: { elevation: 6 },
});

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  // Section title, left-aligned with the greeting. The stage keeps 16 pt of
  // room above the front card (the turned back cards only rise a little into
  // it), so no extra margin: about 16 pt to the visible card edge.
  heading: {
    alignSelf: 'stretch',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '600',
    color: colors.text,
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  // No scale on the card stack: scaling resamples the rendered card (text +
  // shadow) as a bitmap on iOS, so it looks pixelated while pressed.
  stagePressed: {
    opacity: 0.85,
  },
  // Light blue oval behind the lower half of the stack — depth, not a tile.
  oval: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: colors.accentBlueTint,
  },
  cards: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Solid fills and the card's dark edge, so no light seam shows at the corners.
  backCard: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.dark,
  },
  backFar: {
    backgroundColor: colors.cardStackFar,
  },
  backNear: {
    backgroundColor: colors.cardStackNear,
  },
  // Dark fill matches the card's 2 pt dark border, so the rounded corners stay clean
  // (Android elevation needs a background to cast the shadow).
  frontCard: {
    backgroundColor: colors.dark,
    ...frontShadow,
  },
  scaler: {
    position: 'absolute',
  },
  sportTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  sportText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accentBlueText,
  },
  button: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.dark,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.card,
  },
});
