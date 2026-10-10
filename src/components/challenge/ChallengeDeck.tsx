import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import ChallengeGameCard from './ChallengeGameCard';
import ChallengeCardBack from './ChallengeCardBack';
import { useTranslation } from 'react-i18next';
import { CARD_RADIUS } from './cardLayout';
import type { CardSize } from './cardLayout';

// One draw, about 510 ms from the first card and 600 ms when a card is played off:
//   played card arcs away (EXIT_MS), the next one starts rising EXIT_LEAD_MS in,
//   rises (LIFT_MS), turns past face-up (TURN_MS) and settles flat (SETTLE_MS).
const EXIT_MS      = 200;
const EXIT_LEAD_MS = 90;
const LIFT_MS      = 130;
const TURN_MS      = 260;
// Final settle of everything that moves the face card. Timed, never sprung: the card
// must reach its exact rest values quickly so it is drawn sharp (see frontStyle).
const SETTLE_MS    = 120;

// How far the turn carries past face-up before swinging back.
const FLIP_OVERSHOOT_DEG = 186;
// How far the top card rises and grows while it is off the deck.
const LIFT_PX    = 22;
const LIFT_SCALE = 0.04;

// Reduced motion: a plain cross-fade instead of lift and flip.
const FADE_MS      = 200;
const FADE_LEAD_MS = 40;

// A drag counts as a swipe once it travels this share of the card width or is
// released faster than SWIPE_VELOCITY (px/s); otherwise the card springs back.
const SWIPE_DISTANCE_SHARE = 0.3;
const SWIPE_VELOCITY = 800;
const FLING_MS = 180;
// Tilt while dragging, in degrees per full card width of horizontal travel.
const DRAG_TILT_DEG = 14;

// Total time a draw is blocked, see SparringChallengeScreen.
export const DRAW_ANIMATION_MS = EXIT_LEAD_MS + LIFT_MS + TURN_MS + SETTLE_MS;

// Resting offset of the two cards behind the top one: a few pixels down, barely turned.
const NEAR_OFFSET = 5;
const FAR_OFFSET  = 10;
const NEAR_TILT   = -1.2;
const FAR_TILT    = 1.4;

export interface ChallengeDeckHandle {
  // Plays the face-up card off and asks the screen for the next one.
  draw: () => void;
}

interface Props {
  card:      SparringChallenge | null;
  // Bumped by the screen on every draw, so drawing the same card again still animates.
  drawKey:   number;
  size:      CardSize;
  onDraw?:   () => void;
  disabled?: boolean;
  ref?:      React.Ref<ChallengeDeckHandle>;
}

// Stack of cards. A draw lifts the top card off the deck, turns it over with a short
// 3D flip and lets it settle flat. The flip uses two stacked faces whose visibility
// switches at 90 degrees — backfaceVisibility is unreliable on Android.
//
// The played card leaves as a "ghost": a copy of the face-up card that is already
// rendered (hidden) on top. A draw or swipe starts its exit on the UI thread in the
// same frame, while the top card turns face down underneath and waits for the next
// card. No render has to finish before anything moves.
//
// Face down, the whole stack is the draw button. Face up, the card is for reading:
// its brief scrolls, and a sideways swipe plays it off.
export default function ChallengeDeck({
  card,
  drawKey,
  size,
  onDraw,
  disabled = false,
  ref,
}: Props): React.ReactElement {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [displayCard, setDisplayCard] = useState<SparringChallenge | null>(card);
  const [ghostCard, setGhostCard]     = useState<SparringChallenge | null>(card);

  // Top card: 0 = resting on the deck, 1 = lifted off
  const lift       = useSharedValue(0);
  // 0 = face down, 180 = face up
  const flip       = useSharedValue(card === null ? 0 : 180);
  // Ghost of the played card
  const ghostX       = useSharedValue(0);
  const ghostY       = useSharedValue(0);
  const ghostRotate  = useSharedValue(0);
  const ghostOpacity = useSharedValue(0);
  // 0 = deck sits flat, 1 = deck has settled back behind the lifted card
  const stackRecede = useSharedValue(0);
  const press       = useSharedValue(1);

  const displayRef   = useRef<SparringChallenge | null>(card);
  const prevKeyRef   = useRef(`${drawKey}|${card?.id ?? ''}`);
  // True while the ghost is in flight; its content must not change until it lands.
  const ghostBusyRef = useRef(false);
  // When the current exit started, and how long the next card waits after that.
  const exitAtRef    = useRef<number | null>(null);
  const exitWaitRef  = useRef(0);
  // A draw blocks the next one until its animation is through, even before the
  // screen's `disabled` has come back through a render.
  const busyUntilRef = useRef(0);
  const onDrawRef    = useRef(onDraw);
  onDrawRef.current  = onDraw;
  const disabledRef  = useRef(disabled);
  disabledRef.current = disabled;
  const reduceRef    = useRef(reduceMotion);
  reduceRef.current  = reduceMotion;

  // Leaving the screen mid-draw: stop everything, nothing may call back afterwards.
  useEffect(() => () => {
    [lift, flip, ghostX, ghostY, ghostRotate, ghostOpacity, stackRecede, press].forEach(cancelAnimation);
  }, []);

  // Lifts the next card off the deck and turns it over, after `delayMs`.
  const revealCard = (next: SparringChallenge | null, delayMs: number): void => {
    displayRef.current = next;
    setDisplayCard(next);
    if (!ghostBusyRef.current) setGhostCard(next);
    exitAtRef.current = null;

    flip.value = 0;

    if (reduceRef.current) {
      lift.value = 0;
      stackRecede.value = 0;
      if (next !== null) {
        flip.value = withDelay(delayMs, withTiming(180, {
          duration: FADE_MS,
          easing: Easing.out(Easing.quad),
          reduceMotion: ReduceMotion.Never,
        }));
      }
      return;
    }

    // 1. rise off the deck, hold while turning, settle back down as the turn lands.
    // Timed, not sprung: a spring leaves the card on sub-pixel offsets for most of a
    // second, and the brief text stays soft until it finally rests.
    const lifted = withSequence(
      withTiming(1, { duration: LIFT_MS, easing: Easing.out(Easing.quad) }),
      withDelay(TURN_MS - 80, withTiming(0, { duration: SETTLE_MS + 80, easing: Easing.inOut(Easing.quad) })),
    );
    lift.value = withDelay(delayMs, lifted);
    stackRecede.value = withDelay(delayMs, withSequence(
      withTiming(1, { duration: LIFT_MS, easing: Easing.out(Easing.quad) }),
      withDelay(TURN_MS - 80, withTiming(0, { duration: SETTLE_MS + 80, easing: Easing.inOut(Easing.quad) })),
    ));

    // 2. turn over a little past face-up, then swing back flat — the overshoot gives
    // the card weight. The swing back is timed so it lands on exactly 180 at a known
    // moment; a spring would wobble around 180 and a tilted card is drawn blurry.
    if (next !== null) {
      flip.value = withDelay(
        delayMs + LIFT_MS,
        withSequence(
          withTiming(FLIP_OVERSHOOT_DEG, { duration: TURN_MS, easing: Easing.out(Easing.cubic) }),
          withTiming(180, { duration: SETTLE_MS, easing: Easing.inOut(Easing.quad) }),
        ),
      );
    }
  };

  // The ghost has landed: it takes on the current card for the next exit.
  const onGhostDone = (): void => {
    ghostBusyRef.current = false;
    setGhostCard(displayRef.current);
  };

  const markExit = (waitMs: number): void => {
    ghostBusyRef.current = true;
    exitAtRef.current = Date.now();
    exitWaitRef.current = waitMs;
  };

  // The played card is flicked away: it tips, rises and drops along a shallow arc
  // instead of sliding out flat. Runs on the UI thread, so showing the ghost and
  // turning the top card face down land in the same frame.
  const playOff = (width: number, reduce: boolean): void => {
    'worklet';
    flip.value = 0;
    ghostX.value = 0;
    ghostY.value = 0;
    ghostRotate.value = 0;
    ghostOpacity.value = 1;
    if (reduce) {
      ghostOpacity.value = withTiming(0, { duration: FADE_MS, reduceMotion: ReduceMotion.Never }, (finished) => {
        if (finished === true) runOnJS(onGhostDone)();
      });
      return;
    }
    ghostOpacity.value = withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.quad) });
    ghostRotate.value  = withTiming(-12, { duration: EXIT_MS, easing: Easing.in(Easing.quad) });
    ghostY.value = withSequence(
      withTiming(-16, { duration: Math.round(EXIT_MS * 0.45) }),
      withTiming(14, { duration: Math.round(EXIT_MS * 0.55) }),
    );
    ghostX.value = withTiming(
      -(width * 1.05),
      { duration: EXIT_MS, easing: Easing.in(Easing.quad) },
      (finished) => {
        if (finished === true) runOnJS(onGhostDone)();
      },
    );
  };

  const startPlayOff = (): void => {
    markExit(reduceRef.current ? FADE_LEAD_MS : EXIT_LEAD_MS);
    runOnUI(playOff)(size.width, reduceRef.current);
  };

  const requestDraw = (): void => {
    if (disabledRef.current || onDrawRef.current === undefined) return;
    const now = Date.now();
    if (now < busyUntilRef.current) return;
    busyUntilRef.current = now + DRAW_ANIMATION_MS;
    if (displayRef.current !== null && !ghostBusyRef.current) startPlayOff();
    onDrawRef.current();
  };

  useImperativeHandle(ref, () => ({ draw: requestDraw }));

  useEffect(() => {
    const key = `${drawKey}|${card?.id ?? ''}`;
    // On mount the ref already holds this key, so the guard covers the first run too.
    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;

    // A change that did not come through requestDraw (e.g. another discipline) still
    // plays the old card off first.
    if (exitAtRef.current === null && displayRef.current !== null && !ghostBusyRef.current) {
      startPlayOff();
    }
    const wait = exitAtRef.current === null
      ? 0
      : Math.max(0, exitWaitRef.current - (Date.now() - exitAtRef.current));
    revealCard(card, wait);
  }, [card, drawKey]);

  // Swiped off: the next card may rise at once, the ghost is already flying.
  const onSwiped = (): void => {
    if (disabledRef.current || onDrawRef.current === undefined || Date.now() < busyUntilRef.current) {
      // No draw after all: turn the card that is still current back over.
      revealCard(displayRef.current, 0);
      return;
    }
    busyUntilRef.current = Date.now() + DRAW_ANIMATION_MS;
    markExit(0);
    onDrawRef.current();
  };

  const swipeWidth = size.width;
  const swipeHeight = size.height;
  const faceUp = displayCard !== null;
  const swipeEnabled = !disabled && onDraw !== undefined && faceUp;
  const pan = useMemo(() => Gesture.Pan()
    .enabled(swipeEnabled)
    // Sideways only: a vertical drag belongs to the scrolling brief.
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onStart(() => {
      // The ghost takes the card into the hand, the deck shows face down beneath it.
      ghostX.value = 0;
      ghostY.value = 0;
      ghostRotate.value = 0;
      ghostOpacity.value = 1;
      flip.value = 0;
    })
    .onUpdate((e) => {
      ghostX.value = e.translationX;
      ghostY.value = e.translationY;
    })
    .onEnd((e) => {
      const distance = Math.hypot(e.translationX, e.translationY);
      const speed = Math.hypot(e.velocityX, e.velocityY);
      if (distance < swipeWidth * SWIPE_DISTANCE_SHARE && speed < SWIPE_VELOCITY) {
        ghostY.value = withSpring(0, { damping: 18, stiffness: 220 });
        ghostX.value = withSpring(0, { damping: 18, stiffness: 220 }, (finished) => {
          if (finished !== true) return;
          // Back in place: hand the card back to the top layer in one frame.
          flip.value = 180;
          ghostOpacity.value = 0;
        });
        return;
      }
      // Leave along the release direction: velocity when flicked, otherwise the drag.
      const useVelocity = speed >= SWIPE_VELOCITY;
      const dirX = useVelocity ? e.velocityX : e.translationX;
      const dirY = useVelocity ? e.velocityY : e.translationY;
      const len = Math.max(Math.hypot(dirX, dirY), 1);
      const travel = Math.max(swipeWidth, swipeHeight) * 1.6;
      runOnJS(onSwiped)();
      ghostOpacity.value = withTiming(0, { duration: FLING_MS });
      ghostY.value = withTiming(ghostY.value + (dirY / len) * travel, { duration: FLING_MS, easing: Easing.out(Easing.quad) });
      ghostX.value = withTiming(
        ghostX.value + (dirX / len) * travel,
        { duration: FLING_MS, easing: Easing.out(Easing.quad) },
        (finished) => {
          if (finished === true) runOnJS(onGhostDone)();
        },
      );
    }), [swipeEnabled, swipeWidth, swipeHeight]);

  // At rest the top card carries no transform at all (see backStyle).
  const topStyle = useAnimatedStyle(() => ({
    transform: lift.value === 0
      ? []
      : [{ translateY: -LIFT_PX * lift.value }, { scale: 1 + LIFT_SCALE * lift.value }],
  }));

  const ghostStyle = useAnimatedStyle(() => ({
    opacity: ghostOpacity.value,
    transform: [
      { translateX: ghostX.value },
      { translateY: ghostY.value },
      { rotate: `${ghostRotate.value + (ghostX.value / swipeWidth) * DRAG_TILT_DEG}deg` },
    ],
  }));

  // At rest a face carries no transform at all. Even perspective + rotateY(0deg) is a
  // non-affine 3D matrix: the platform then composites the card as a filtered texture
  // instead of drawing it pixel-aligned, and text and logo look soft or pixelated.
  // With reduced motion the faces only cross-fade.
  const backStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 1 - flip.value / 180, transform: [] };
    return {
      opacity: flip.value < 90 ? 1 : 0,
      transform: flip.value === 0
        ? []
        : [{ perspective: 1800 }, { rotateY: `${flip.value}deg` }],
    };
  });

  const frontStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: flip.value / 180, transform: [] };
    return {
      opacity: flip.value < 90 ? 0 : 1,
      transform: flip.value === 180
        ? []
        : [{ perspective: 1800 }, { rotateY: `${flip.value - 180}deg` }],
    };
  });

  // The cards behind sink back a touch while the top card is lifted.
  const nearStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: NEAR_OFFSET + stackRecede.value * 2 },
      { rotate: `${NEAR_TILT}deg` },
      { scale: 1 - stackRecede.value * 0.02 },
    ],
  }));

  const farStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: FAR_OFFSET + stackRecede.value * 3 },
      { rotate: `${FAR_TILT}deg` },
      { scale: 1 - stackRecede.value * 0.04 },
    ],
  }));

  // Press feedback sits on its own view so it composes with the draw animation
  // instead of fighting it for the same shared values.
  const pressStyle = useAnimatedStyle(() => ({
    transform: press.value === 1 ? [] : [{ scale: press.value }],
  }));

  // Faces are memoised: the screen re-renders a few times per draw, and the card
  // content must not be rebuilt for that while it animates.
  const backFace = useMemo(() => <ChallengeCardBack size={size} elevated={false} />, [size]);
  const frontFace = useMemo(() => (displayCard === null ? null : (
    <ChallengeGameCard challenge={displayCard} size={size} />
  )), [displayCard, size]);
  const ghostFace = useMemo(() => (ghostCard === null ? null : (
    <ChallengeGameCard challenge={ghostCard} size={size} />
  )), [ghostCard, size]);

  const layerSize = { width: size.width, height: size.height };
  const glowWidth  = Math.round(size.width * 1.7);
  const glowHeight = Math.round(size.height * 1.25);
  const glowFrame  = {
    width: glowWidth,
    height: glowHeight,
    left: Math.round((size.width - glowWidth) / 2),
    top: Math.round((size.height - glowHeight) / 2) + FAR_OFFSET,
  };
  const tapToDraw = !faceUp && onDraw !== undefined;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.wrap, layerSize, pressStyle]}>
        {/* Static depth: a faint blue light right behind the deck and a soft shadow */}
        <Svg style={[styles.glow, glowFrame]} width={glowWidth} height={glowHeight} pointerEvents="none">
          <Defs>
            <RadialGradient id="deckGlow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={colors.accentBlue} stopOpacity={0.2} />
              <Stop offset="0.55" stopColor={colors.accentBlue} stopOpacity={0.06} />
              <Stop offset="1" stopColor={colors.accentBlue} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={glowWidth / 2} cy={glowHeight / 2} rx={glowWidth / 2} ry={glowHeight / 2} fill="url(#deckGlow)" />
        </Svg>
        <View style={[styles.layer, styles.shadowPlate, layerSize]} pointerEvents="none" />

        <Pressable
          style={[styles.wrap, layerSize]}
          onPress={requestDraw}
          onPressIn={() => { press.value = withTiming(0.97, { duration: 90 }); }}
          onPressOut={() => { press.value = withTiming(1, { duration: SETTLE_MS, easing: Easing.out(Easing.quad) }); }}
          disabled={disabled || !tapToDraw}
          // Face down the stack is one tap target; face up the brief must scroll.
          pointerEvents={tapToDraw ? 'box-only' : 'box-none'}
          accessible={tapToDraw}
          accessibilityRole="button"
          accessibilityLabel={t('challenge.deck.drawLabel')}
          accessibilityHint={t('challenge.deck.drawHint')}
          accessibilityState={{ disabled }}
        >
          {/* Cards still in the deck — filled surfaces only, never any content */}
          <Animated.View style={[styles.layer, styles.stackFar, layerSize, farStyle]} pointerEvents="none" />
          <Animated.View style={[styles.layer, styles.stackNear, layerSize, nearStyle]} pointerEvents="none" />

          {/* Animated top card, isolated from the stack views */}
          <Animated.View style={[styles.layer, layerSize, topStyle]} pointerEvents="box-none">
            <Animated.View style={[styles.face, backStyle]} pointerEvents="none">
              {backFace}
            </Animated.View>

            {frontFace !== null ? (
              <Animated.View style={[styles.face, frontStyle]}>
                {frontFace}
              </Animated.View>
            ) : null}
          </Animated.View>

          {/* The played card on its way out, above everything else */}
          {ghostFace !== null ? (
            <Animated.View style={[styles.layer, layerSize, ghostStyle]} pointerEvents="none">
              {ghostFace}
            </Animated.View>
          ) : null}
        </Pressable>
      </Animated.View>
    </GestureDetector>
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
  glow: {
    position: 'absolute',
  },
  // Never moves, so its shadow is rendered once. Sits where the bottom card rests.
  // iOS only: on Android elevation would also lift the plate above the cards in the
  // drawing order; there the glow alone carries the depth.
  shadowPlate: {
    top: FAR_OFFSET,
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.cardStackFar,
    ...Platform.select({
      ios:     { shadowColor: colors.gameShadow, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.5, shadowRadius: 24 },
      default: {},
    }),
  },
  // No shadow on the stack: these layers are always rotated, and a shadow without a
  // shadowPath is rendered offscreen on every frame they move.
  stackFar: {
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.cardStackFar,
  },
  stackNear: {
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.cardStackNear,
  },
});
