import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import ChallengeCard from './ChallengeCard';
import ChallengeCardBack from './ChallengeCardBack';
import { CARD_RADIUS } from './cardLayout';
import type { CardSize } from './cardLayout';

const EXIT_MS   = 160; // played card leaves the stack
const SETTLE_MS = 90;  // new card lies face down for a beat
const FLIP_MS   = 420; // and turns over

// Total time a draw is blocked, see SparringChallengeScreen.
export const DRAW_ANIMATION_MS = EXIT_MS + SETTLE_MS + FLIP_MS;

interface Props {
  card: SparringChallenge | null;
  done: boolean;
  size: CardSize;
}

// Stack of cards. Drawing plays out like a real deck: the played card slides off,
// the next one lands face down and turns over. The turn uses two stacked faces whose
// visibility flips at the halfway point — backfaceVisibility is unreliable on Android.
export default function ChallengeDeck({ card, done, size }: Props): React.ReactElement {
  const [displayCard, setDisplayCard] = useState<SparringChallenge | null>(card);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate     = useSharedValue(0);
  const scale      = useSharedValue(1);
  const opacity    = useSharedValue(1);
  // 0 = face down, 180 = face up
  const flip       = useSharedValue(card === null ? 0 : 180);

  const displayRef  = useRef<SparringChallenge | null>(card);
  const prevIdRef   = useRef<string | null>(card?.id ?? null);
  const firstRunRef = useRef(true);

  // Puts the next card face down on the stack and turns it over.
  const dealCard = (next: SparringChallenge | null): void => {
    displayRef.current = next;
    setDisplayCard(next);

    translateX.value = 0;
    rotate.value     = 0;
    opacity.value    = 1;
    flip.value       = 0;
    translateY.value = -10;
    scale.value      = 0.97;

    translateY.value = withDelay(SETTLE_MS, withSpring(0, { damping: 15, stiffness: 190 }));
    scale.value      = withDelay(SETTLE_MS, withSpring(1, { damping: 15, stiffness: 190 }));

    if (next !== null) {
      flip.value = withDelay(
        SETTLE_MS,
        withTiming(180, { duration: FLIP_MS, easing: Easing.inOut(Easing.ease) }),
      );
    }
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

    // Nothing on the stack yet: the top card simply turns over.
    if (displayRef.current === null) {
      dealCard(card);
      return;
    }

    // Otherwise the played card leaves first.
    opacity.value    = withTiming(0, { duration: EXIT_MS });
    rotate.value     = withTiming(-5, { duration: EXIT_MS });
    translateX.value = withTiming(
      -(size.width * 1.1),
      { duration: EXIT_MS },
      (finished) => {
        if (finished === true) runOnJS(dealCard)(card);
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

  const layerSize = { width: size.width, height: size.height };

  return (
    <View style={[styles.wrap, layerSize]}>
      {/* Cards still in the deck — filled surfaces only, no content */}
      <View style={[styles.layer, styles.stackFar, layerSize]} pointerEvents="none" />
      <View style={[styles.layer, styles.stackNear, layerSize]} pointerEvents="none" />

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
    backgroundColor: colors.cardBackEdge,
    transform: [{ translateY: -6 }, { translateX: 6 }, { rotate: '1.5deg' }],
  },
  stackNear: {
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.cardBack,
    transform: [{ translateY: -3 }, { translateX: 3 }, { rotate: '0.8deg' }],
  },
});
