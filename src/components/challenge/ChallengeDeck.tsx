import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import ChallengeCard from './ChallengeCard';
import ChallengeCardBack from './ChallengeCardBack';
import { CARD_RADIUS } from './cardLayout';
import type { CardSize } from './cardLayout';

const EXIT_MS  = 150;
const ENTER_MS = 180;

// Total time the draw is blocked — exit plus enter, see SparringChallengeScreen.
export const DRAW_ANIMATION_MS = EXIT_MS + ENTER_MS;

interface Props {
  card: SparringChallenge | null;
  done: boolean;
  size: CardSize;
}

// Stack of cards. The two cards below are plain filled surfaces — no content, no
// borders — so the stack reads as depth instead of overlapping outlines. Only the
// top card animates, and it lives in its own view.
export default function ChallengeDeck({ card, done, size }: Props): React.ReactElement {
  const [displayCard, setDisplayCard] = useState<SparringChallenge | null>(card);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate     = useSharedValue(0);
  const scale      = useSharedValue(1);
  const opacity    = useSharedValue(1);

  const displayRef  = useRef<SparringChallenge | null>(card);
  const prevIdRef   = useRef<string | null>(card?.id ?? null);
  const firstRunRef = useRef(true);

  // Sets the incoming card and lets it settle onto the stack.
  const enterCard = (next: SparringChallenge | null): void => {
    displayRef.current = next;
    setDisplayCard(next);
    translateX.value = 0;
    rotate.value     = 0;
    translateY.value = 8;
    scale.value      = 0.96;
    opacity.value    = 0;
    opacity.value    = withTiming(1, { duration: ENTER_MS });
    translateY.value = withSpring(0, { damping: 16, stiffness: 200 });
    scale.value      = withSpring(1, { damping: 16, stiffness: 200 });
  };

  useEffect(() => {
    const id = card?.id ?? null;
    // Consumed on the very first run regardless of outcome, so a later draw animates.
    const isFirstRun = firstRunRef.current;
    firstRunRef.current = false;

    if (id === prevIdRef.current && !isFirstRun) return;
    prevIdRef.current = id;

    // A card restored from storage on mount must not play the draw animation.
    if (isFirstRun) {
      displayRef.current = card;
      setDisplayCard(card);
      return;
    }

    if (displayRef.current === null || card === null) {
      enterCard(card);
      return;
    }

    opacity.value    = withTiming(0, { duration: EXIT_MS });
    rotate.value     = withTiming(-4, { duration: EXIT_MS });
    translateY.value = withTiming(-8, { duration: EXIT_MS });
    translateX.value = withTiming(
      -(size.width * 1.15),
      { duration: EXIT_MS },
      (finished) => {
        if (finished === true) runOnJS(enterCard)(card);
      },
    );
  }, [card]);

  const topStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  const layerSize = { width: size.width, height: size.height };

  return (
    <View style={[styles.wrap, layerSize]}>
      {/* Cards still in the deck — filled surfaces only */}
      <View style={[styles.layer, styles.stackFar, layerSize]} pointerEvents="none" />
      <View style={[styles.layer, styles.stackNear, layerSize]} pointerEvents="none" />

      {/* Animated top card, isolated from the stack views */}
      <Animated.View style={[styles.layer, topStyle]}>
        {displayCard === null ? (
          <ChallengeCardBack size={size} />
        ) : (
          <ChallengeCard challenge={displayCard} size={size} done={done} />
        )}
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
