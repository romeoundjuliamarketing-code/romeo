import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import ChallengeCard, { CARD_WIDTH, CARD_HEIGHT } from './ChallengeCard';

const EXIT_MS = 200;
const FLIP_MS = 420;
const LIFT_MS = 220;

interface Props {
  card:         SparringChallenge | null;
  done:         boolean;
  onToggleDone: () => void;
  empty:        boolean;
}

// Card back — also used for the two idle cards below the top card.
function CardBack({ dimmed = false }: { dimmed?: boolean }): React.ReactElement {
  return (
    <View style={[styles.back, dimmed && styles.backDimmed]}>
      <View style={styles.backInner}>
        <Ionicons name="flash-outline" size={32} color={colors.accentBlue} />
        <Text style={styles.backText}>SPARR</Text>
      </View>
    </View>
  );
}

// Stack of cards that lifts and flips whenever a new challenge is drawn. The flip uses
// two stacked faces whose opacity is switched at the halfway point — backfaceVisibility
// is not reliable on Android.
export default function ChallengeDeck({ card, done, onToggleDone, empty }: Props): React.ReactElement {
  const flip  = useSharedValue(0);
  const lift  = useSharedValue(0);
  const scale = useSharedValue(1);
  const slide = useSharedValue(0);

  const prevIdRef = useRef<string | null>(null);
  const firstRunRef = useRef(true);

  useEffect(() => {
    const id = card?.id ?? null;
    // Consumed on the very first run regardless of outcome, so a later draw animates.
    const isFirstRun = firstRunRef.current;
    firstRunRef.current = false;

    if (id === prevIdRef.current) return;

    const hadCard = prevIdRef.current !== null;
    prevIdRef.current = id;

    if (id === null) {
      flip.value = 0;
      return;
    }

    // A card restored from storage on mount must not play the draw animation.
    if (isFirstRun) {
      flip.value = 180;
      return;
    }

    const delay = hadCard ? EXIT_MS : 0;

    if (hadCard) {
      // Push the old card aside, then snap back with the face hidden again.
      slide.value = withSequence(
        withTiming(-CARD_WIDTH * 1.2, { duration: EXIT_MS }),
        withTiming(0, { duration: 0 }),
      );
      flip.value = withSequence(
        withDelay(EXIT_MS, withTiming(0, { duration: 0 })),
        withTiming(180, { duration: FLIP_MS }),
      );
    } else {
      flip.value = withTiming(180, { duration: FLIP_MS });
    }

    lift.value = withDelay(delay, withSequence(
      withTiming(-24, { duration: LIFT_MS }),
      withSpring(0, { damping: 14 }),
    ));
    scale.value = withDelay(delay, withSequence(
      withTiming(1.06, { duration: LIFT_MS }),
      withSpring(1, { damping: 14 }),
    ));
  }, [card, flip, lift, scale, slide]);

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: slide.value },
      { translateY: lift.value },
      { scale: scale.value },
    ],
  }));

  const backFaceStyle = useAnimatedStyle(() => ({
    opacity: flip.value > 90 ? 0 : 1,
    transform: [{ perspective: 900 }, { rotateY: `${flip.value}deg` }],
  }));

  const frontFaceStyle = useAnimatedStyle(() => ({
    opacity: flip.value > 90 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${flip.value - 180}deg` }],
  }));

  return (
    <View style={styles.wrap}>
      {/* Idle cards below the top card */}
      <View style={[styles.stacked, styles.stackedFar]} pointerEvents="none">
        <CardBack dimmed />
      </View>
      <View style={[styles.stacked, styles.stackedNear]} pointerEvents="none">
        <CardBack dimmed />
      </View>

      <Animated.View style={[styles.stacked, topStyle]}>
        <Animated.View style={[styles.face, backFaceStyle]} pointerEvents="none">
          <CardBack />
        </Animated.View>

        {card !== null ? (
          <Animated.View style={[styles.face, frontFaceStyle]}>
            <ChallengeCard challenge={card} done={done} onToggleDone={onToggleDone} />
          </Animated.View>
        ) : null}
      </Animated.View>

      {empty ? (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Text style={styles.emptyText}>Für diesen Bereich gibt es noch keine Karten</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stacked: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  stackedFar: {
    transform: [{ rotate: '-6deg' }, { scale: 0.92 }],
  },
  stackedNear: {
    transform: [{ rotate: '3deg' }, { scale: 0.96 }],
  },
  face: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },

  back: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: colors.headerBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backDimmed: {
    opacity: 0.45,
  },
  backInner: {
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 8,
    color: colors.headerTextPrimary,
  },

  emptyOverlay: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    color: colors.headerTextSecondary,
  },
});
