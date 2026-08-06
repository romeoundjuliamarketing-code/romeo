import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import ChallengeCard from './ChallengeCard';
import { CARD_RADIUS, cardShadow } from './cardLayout';
import type { CardSize } from './cardLayout';

const EXIT_MS  = 150;
const ENTER_MS = 180;

// Total time the draw is blocked — exit plus enter, see SparringChallengeScreen.
export const DRAW_ANIMATION_MS = EXIT_MS + ENTER_MS;

interface BackProps {
  size:    CardSize;
  dimmed?: boolean;
}

// Face-down card — the top card before a draw and the two cards left in the deck.
function CardBack({ size, dimmed = false }: BackProps): React.ReactElement {
  return (
    <View
      style={[
        styles.back,
        { width: size.width, height: size.height },
        dimmed ? styles.backDimmed : cardShadow,
      ]}
    >
      <View style={styles.backBadge}>
        <Ionicons name="flash" size={22} color={colors.accentBlue} />
      </View>
      <Text style={styles.backText}>SPARR</Text>
    </View>
  );
}

interface Props {
  card:  SparringChallenge | null;
  done:  boolean;
  empty: boolean;
  size:  CardSize;
}

// Stack of cards. A draw slides the current card out sideways while the deck behind
// nudges forward — no 3D flip, which reads cleaner and behaves the same on Android.
export default function ChallengeDeck({ card, done, empty, size }: Props): React.ReactElement {
  const [displayCard, setDisplayCard] = useState<SparringChallenge | null>(card);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate     = useSharedValue(0);
  const scale      = useSharedValue(1);
  const opacity    = useSharedValue(1);
  const stackNudge = useSharedValue(0);

  const displayRef  = useRef<SparringChallenge | null>(card);
  const prevIdRef   = useRef<string | null>(card?.id ?? null);
  const firstRunRef = useRef(true);

  // Sets the incoming card and lets it settle into the stack.
  const enterCard = (next: SparringChallenge | null): void => {
    displayRef.current = next;
    setDisplayCard(next);
    translateX.value = 0;
    rotate.value     = 0;
    translateY.value = 10;
    scale.value      = 0.94;
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

    // The deck behind nudges forward while the old card leaves.
    stackNudge.value = withSequence(
      withTiming(1, { duration: EXIT_MS }),
      withTiming(0, { duration: ENTER_MS }),
    );

    opacity.value    = withTiming(0, { duration: EXIT_MS });
    rotate.value     = withTiming(-6, { duration: EXIT_MS });
    translateY.value = withTiming(-12, { duration: EXIT_MS });
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

  const nearStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${3 - stackNudge.value * 1.5}deg` },
      { scale: 0.96 + stackNudge.value * 0.02 },
    ],
  }));

  const farStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${-5 + stackNudge.value * 2}deg` },
      { scale: 0.92 + stackNudge.value * 0.02 },
    ],
  }));

  return (
    <View style={[styles.wrap, { width: size.width, height: size.height }]}>
      {!empty ? (
        <>
          <Animated.View style={[styles.layer, farStyle]} pointerEvents="none">
            <CardBack size={size} dimmed />
          </Animated.View>
          <Animated.View style={[styles.layer, nearStyle]} pointerEvents="none">
            <CardBack size={size} dimmed />
          </Animated.View>
        </>
      ) : null}

      <Animated.View style={[styles.layer, topStyle]}>
        {displayCard === null ? (
          <View>
            <CardBack size={size} />
            {empty ? (
              <View style={styles.emptyOverlay} pointerEvents="none">
                <Text style={styles.emptyText}>Noch keine Karten in diesem Bereich</Text>
              </View>
            ) : null}
          </View>
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

  back: {
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.headerCard,
    borderWidth: 1,
    borderColor: colors.headerBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  backDimmed: {
    opacity: 0.5,
  },
  backBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentBlueSoft,
  },
  backText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 6,
    color: colors.headerTextPrimary,
  },

  emptyOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    color: colors.headerTextSecondary,
  },
});
