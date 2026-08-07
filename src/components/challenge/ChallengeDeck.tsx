import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
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
import { CARD_RADIUS } from './cardLayout';
import type { CardSize } from './cardLayout';

const EXIT_MS = 120; // played card leaves
const LIFT_MS = 130; // top back card lifts off the stack
const FLIP_MS = 320; // and turns over

// Total time a draw is blocked, see SparringChallengeScreen.
export const DRAW_ANIMATION_MS = EXIT_MS + LIFT_MS + FLIP_MS;

interface Props {
  card: SparringChallenge | null;
  done: boolean;
  size: CardSize;
}

// Stack of cards. A draw lifts the top card off the deck, turns it over with a short
// 3D flip and lets the deck behind move up. The flip uses two stacked faces whose
// visibility switches at 90 degrees — backfaceVisibility is unreliable on Android.
export default function ChallengeDeck({ card, done, size }: Props): React.ReactElement {
  const [displayCard, setDisplayCard] = useState<SparringChallenge | null>(card);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate     = useSharedValue(0);
  const scale      = useSharedValue(1);
  const opacity    = useSharedValue(1);
  // 0 = face down, 180 = face up
  const flip       = useSharedValue(card === null ? 0 : 180);
  const stackNudge = useSharedValue(0);

  const displayRef  = useRef<SparringChallenge | null>(card);
  const prevIdRef   = useRef<string | null>(card?.id ?? null);
  const firstRunRef = useRef(true);

  // Lifts the next card off the deck and turns it over.
  const revealCard = (next: SparringChallenge | null): void => {
    displayRef.current = next;
    setDisplayCard(next);

    translateX.value = 0;
    rotate.value     = 0;
    opacity.value    = 1;
    flip.value       = 0;
    translateY.value = 0;
    scale.value      = 1;

    // 1. lift off the deck, settle back down once the turn is nearly through
    translateY.value = withSequence(
      withTiming(-14, { duration: LIFT_MS, easing: Easing.out(Easing.quad) }),
      withDelay(FLIP_MS - 120, withSpring(0, { damping: 15, stiffness: 200 })),
    );
    scale.value = withSequence(
      withTiming(1.03, { duration: LIFT_MS, easing: Easing.out(Easing.quad) }),
      withDelay(FLIP_MS - 120, withSpring(1, { damping: 15, stiffness: 200 })),
    );

    // 2. + 3. turn over, front appears at the halfway point
    if (next !== null) {
      flip.value = withDelay(
        LIFT_MS,
        withTiming(180, { duration: FLIP_MS, easing: Easing.inOut(Easing.ease) }),
      );
    }

    // 4. the deck behind moves up a few points
    stackNudge.value = withDelay(
      LIFT_MS,
      withSequence(
        withTiming(1, { duration: Math.round(FLIP_MS * 0.6) }),
        withTiming(0, { duration: Math.round(FLIP_MS * 0.4) }),
      ),
    );
  };

  useEffect(() => {
    const id = card?.id ?? null;
    // Consumed on the very first run regardless of outcome, so a later draw animates.
    const isFirstRun = firstRunRef.current;
    firstRunRef.current = false;

    if (id === prevIdRef.current && !isFirstRun) return;
    prevIdRef.current = id;

    // A card restored from storage on mount is not a new card — show it face up.
    if (isFirstRun) {
      displayRef.current = card;
      setDisplayCard(card);
      flip.value = card === null ? 0 : 180;
      return;
    }

    // Nothing on the stack yet: the top card is lifted and turned straight away.
    if (displayRef.current === null) {
      revealCard(card);
      return;
    }

    // Otherwise the played card leaves first.
    opacity.value    = withTiming(0, { duration: EXIT_MS });
    rotate.value     = withTiming(-4, { duration: EXIT_MS });
    translateX.value = withTiming(
      -(size.width * 0.9),
      { duration: EXIT_MS },
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
      { scale: scale.value },
    ],
  }));

  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 90 ? 1 : 0,
    transform: [{ perspective: 1000 }, { rotateY: `${flip.value}deg` }],
  }));

  const frontStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 90 ? 0 : 1,
    transform: [{ perspective: 1000 }, { rotateY: `${flip.value - 180}deg` }],
  }));

  const nearStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -4 - stackNudge.value * 3 },
      { translateX: 4 - stackNudge.value * 2 },
      { rotate: '1.2deg' },
    ],
  }));

  const farStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -8 - stackNudge.value * 3 },
      { translateX: 8 - stackNudge.value * 2 },
      { rotate: '2.4deg' },
    ],
  }));

  const layerSize = { width: size.width, height: size.height };

  return (
    <View style={[styles.wrap, layerSize]}>
      {/* Cards still in the deck — filled surfaces only, never any content */}
      <Animated.View style={[styles.layer, styles.stackFar, layerSize, farStyle]} pointerEvents="none" />
      <Animated.View style={[styles.layer, styles.stackNear, layerSize, nearStyle]} pointerEvents="none" />

      {/* Animated top card, isolated from the stack views */}
      <Animated.View style={[styles.layer, layerSize, containerStyle]}>
        <Animated.View style={[styles.face, backStyle]} pointerEvents="none">
          <ChallengeCardBack size={size} />
        </Animated.View>

        {displayCard !== null ? (
          <Animated.View style={[styles.face, frontStyle]}>
            <ChallengeCard challenge={displayCard} size={size} done={done} />
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
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
  },
  stackNear: {
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.cardStackNear,
    borderWidth: 2,
    borderColor: colors.dark,
  },
});
