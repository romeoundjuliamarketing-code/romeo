import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import ChallengeCard from './ChallengeCard';
import ChallengeCardBack from './ChallengeCardBack';
import { CARD_RADIUS, cardShadow } from './cardLayout';
import type { CardSize } from './cardLayout';

const EXIT_MS = 160; // played card arcs away
const LIFT_MS = 150; // next card rises off the deck
const FLIP_MS = 330; // and turns over, overshooting a little

// How far the turn carries past face-up before springing back.
const FLIP_OVERSHOOT_DEG = 188;

// Total time a draw is blocked, see SparringChallengeScreen.
export const DRAW_ANIMATION_MS = EXIT_MS + LIFT_MS + FLIP_MS;

interface Props {
  card:      SparringChallenge | null;
  done:      boolean;
  size:      CardSize;
  onPress?:  () => void;
  disabled?: boolean;
}

// Stack of cards. A draw lifts the top card off the deck, turns it over with a short
// 3D flip and lets the deck behind move up. The flip uses two stacked faces whose
// visibility switches at 90 degrees — backfaceVisibility is unreliable on Android.
export default function ChallengeDeck({
  card,
  done,
  size,
  onPress,
  disabled = false,
}: Props): React.ReactElement {
  const [displayCard, setDisplayCard] = useState<SparringChallenge | null>(card);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate     = useSharedValue(0);
  const opacity    = useSharedValue(1);
  // 0 = face down, 180 = face up
  const flip       = useSharedValue(card === null ? 0 : 180);
  const stackNudge = useSharedValue(0);
  // 0 = deck sits flat, 1 = deck has receded behind the lifted card
  const stackRecede = useSharedValue(0);
  const press      = useSharedValue(1);

  const displayRef  = useRef<SparringChallenge | null>(card);
  const prevIdRef   = useRef<string | null>(card?.id ?? null);

  // Lifts the next card off the deck and turns it over.
  const revealCard = (next: SparringChallenge | null): void => {
    displayRef.current = next;
    setDisplayCard(next);

    translateX.value = 0;
    rotate.value     = 0;
    opacity.value    = 1;
    flip.value       = 0;
    translateY.value = 0;

    // 1. rise off the deck and settle back down once the turn is nearly through
    translateY.value = withSequence(
      withTiming(-20, { duration: LIFT_MS, easing: Easing.out(Easing.quad) }),
      withDelay(FLIP_MS - 140, withSpring(0, { damping: 14, stiffness: 190 })),
    );

    // On a near-black screen a drop shadow would be invisible, so depth comes from
    // parallax instead: the deck recedes while the top card is up.
    stackRecede.value = withSequence(
      withTiming(1, { duration: LIFT_MS, easing: Easing.out(Easing.quad) }),
      withDelay(FLIP_MS - 140, withSpring(0, { damping: 14, stiffness: 190 })),
    );

    // 2. + 3. turn over past face-up, then spring back — the overshoot is what makes
    // the flip read as weight rather than a slide.
    if (next !== null) {
      flip.value = withDelay(
        LIFT_MS,
        withSequence(
          withTiming(FLIP_OVERSHOOT_DEG, {
            duration: Math.round(FLIP_MS * 0.82),
            easing: Easing.out(Easing.cubic),
          }),
          withSpring(180, { damping: 12, stiffness: 170 }),
        ),
      );
    }

    // 4. the deck behind fans out and snaps back
    stackNudge.value = withDelay(
      LIFT_MS,
      withSequence(
        withTiming(1, { duration: Math.round(FLIP_MS * 0.6) }),
        withSpring(0, { damping: 13, stiffness: 180 }),
      ),
    );
  };

  useEffect(() => {
    const id = card?.id ?? null;
    // On mount the refs already hold this card, so the guard covers the first run too.
    if (id === prevIdRef.current) return;
    prevIdRef.current = id;

    // Nothing on the stack yet: the top card is lifted and turned straight away.
    if (displayRef.current === null) {
      revealCard(card);
      return;
    }

    // Otherwise the played card is flicked away first: it tips, rises and drops
    // along a shallow arc instead of sliding out flat.
    opacity.value = withTiming(0, { duration: EXIT_MS });
    rotate.value  = withTiming(-12, { duration: EXIT_MS, easing: Easing.in(Easing.quad) });
    translateY.value = withSequence(
      withTiming(-16, { duration: Math.round(EXIT_MS * 0.45) }),
      withTiming(14, { duration: Math.round(EXIT_MS * 0.55) }),
    );
    translateX.value = withTiming(
      -(size.width * 1.05),
      { duration: EXIT_MS, easing: Easing.in(Easing.quad) },
      (finished) => {
        if (finished === true) runOnJS(revealCard)(card);
      },
    );
  }, [card]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 90 ? 1 : 0,
    transform: [{ perspective: 1800 }, { rotateY: `${flip.value}deg` }],
  }));

  const frontStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 90 ? 0 : 1,
    transform: [{ perspective: 1800 }, { rotateY: `${flip.value - 180}deg` }],
  }));

  const nearStyle = useAnimatedStyle(() => ({
    opacity: 1 - stackRecede.value * 0.35,
    transform: [
      { translateY: -4 - stackNudge.value * 3 },
      { translateX: 4 - stackNudge.value * 2 },
      { rotate: `${1.2 + stackNudge.value * 1.6}deg` },
      { scale: 1 - stackRecede.value * 0.05 },
    ],
  }));

  const farStyle = useAnimatedStyle(() => ({
    opacity: 1 - stackRecede.value * 0.5,
    transform: [
      { translateY: -8 - stackNudge.value * 3 },
      { translateX: 8 - stackNudge.value * 2 },
      { rotate: `${2.4 + stackNudge.value * 2.4}deg` },
      { scale: 1 - stackRecede.value * 0.09 },
    ],
  }));

  // Press feedback sits on its own view so it composes with the draw animation
  // instead of fighting it for the same shared values.
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  const layerSize = { width: size.width, height: size.height };

  return (
    <Animated.View style={[styles.wrap, layerSize, pressStyle]}>
      <Pressable
        style={[styles.wrap, layerSize]}
        onPress={onPress}
        onPressIn={() => { press.value = withTiming(0.97, { duration: 90 }); }}
        onPressOut={() => { press.value = withSpring(1, { damping: 14, stiffness: 220 }); }}
        disabled={disabled || onPress === undefined}
        // The card is one tap target — the brief inside must not swallow the tap.
        pointerEvents="box-only"
        accessibilityRole="button"
        accessibilityLabel="Neue Karte ziehen"
        accessibilityHint="Tippe auf die Karte, um eine neue Mission zu ziehen"
      >
        {/* Cards still in the deck — filled surfaces only, never any content */}
        <Animated.View style={[styles.layer, styles.stackFar, layerSize, farStyle]} pointerEvents="none" />
        <Animated.View style={[styles.layer, styles.stackNear, layerSize, nearStyle]} pointerEvents="none" />

        {/* Animated top card, isolated from the stack views */}
        <Animated.View style={[styles.layer, layerSize, containerStyle]}>
          <Animated.View style={[styles.face, backStyle]} pointerEvents="none">
            <ChallengeCardBack size={size} elevated={false} />
          </Animated.View>

          {displayCard !== null ? (
            <Animated.View style={[styles.face, frontStyle]}>
              <ChallengeCard challenge={displayCard} size={size} done={done} scrollable={false} elevated={false} />
            </Animated.View>
          ) : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
  },
  face: {
    position: 'absolute',
  },
  stackFar: {
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.cardStackFar,
    borderWidth: 2,
    borderColor: colors.dark,
    ...cardShadow,
  },
  stackNear: {
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.cardStackNear,
    borderWidth: 2,
    borderColor: colors.dark,
    ...cardShadow,
  },
});
