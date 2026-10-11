import React, { useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing, Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';
import ComicSpeechBubble, { type BubbleTail } from './ComicSpeechBubble';
import type { CoachFigure } from './coachFigures';

const ACTIONS_GAP = 12;            // coach body to the answer column
const COACH_SHARE = 0.36;          // share of the scene width
const COACH_MIN = 88;
const COACH_MAX = 148;
const STACKED_COACH_MAX = 112;
// Width the primary answer needs for a one-line label at fontScale 1
// (label, arrow, padding, outline); below that the answers move under the scene.
const PRIMARY_NEEDS = 204;
const TAIL_DROP = 20;              // tail tip below the bubble's bottom edge
const TAIL_SWING = 22;             // tail base sits this far right of its tip
const TIP_GAP = 6;                 // tip to the head outline
const DEFAULT_HEAD = { x: 0.6, y: 0.1 };
// One 400 ms entrance; each part plays in its own slice of it.
const ENTER_DURATION = 400;
const COACH_RANGE = [0, 260 / 400];
const BUBBLE_RANGE = [80 / 400, 300 / 400];
const ACTIONS_RANGE = [180 / 400, 1];
const RISE = 16;
const ACTIONS_SHIFT = 6;

type Layout = { coachWidth: number; stacked: boolean };

// Picks the coach size: next to him the answers need a one-line primary
// label; if even the smallest coach leaves too little room, they go below.
function sceneLayout(width: number, fontScale: number): Layout {
  const needs = PRIMARY_NEEDS * Math.max(1, fontScale);
  const preferred = Math.round(Math.max(COACH_MIN, Math.min(COACH_MAX, width * COACH_SHARE)));
  for (const coachWidth of [preferred, COACH_MIN]) {
    if (width - coachWidth - ACTIONS_GAP >= needs) return { coachWidth, stacked: false };
  }
  return { coachWidth: Math.round(Math.max(COACH_MIN, Math.min(STACKED_COACH_MAX, width * COACH_SHARE))), stacked: true };
}

// Coach scene: a wide comic speech bubble on top, the coach below its
// bottom-left corner (the tail points at his head) and the answers to his
// right, or below everything on narrow screens / large text. Plays a short
// entrance whenever `visible` turns true. Texts stay native and readable.
export default function CoachScene({ visible, figure, width, title, body, primary, secondary }: {
  visible:   boolean;
  figure:    CoachFigure;
  /** Width available to the scene. */
  width:     number;
  title:     string;
  body:      string;
  /** Main answer, e.g. CoachPrimaryButton. */
  primary:   React.ReactNode;
  /** Quiet answer below the main one. */
  secondary: React.ReactNode;
}): React.ReactElement {
  const { fontScale } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const enter = useSharedValue(1);

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = 0;
    enter.value = withTiming(1, { duration: ENTER_DURATION, easing: Easing.linear });
  }, [visible, reduceMotion, enter]);

  // Progress of one part within its slice, eased out.
  function part(value: number, range: number[]): number {
    'worklet';
    return Easing.out(Easing.cubic)(interpolate(value, range, [0, 1], Extrapolation.CLAMP));
  }

  const coachStyle = useAnimatedStyle(() => {
    const p = part(enter.value, COACH_RANGE);
    return { opacity: p, transform: [{ translateY: (1 - p) * RISE }] };
  });
  const bubbleStyle = useAnimatedStyle(() => {
    const p = part(enter.value, BUBBLE_RANGE);
    return { opacity: p, transform: [{ scale: 0.97 + p * 0.03 }] };
  });
  const actionsStyle = useAnimatedStyle(() => {
    const p = part(enter.value, ACTIONS_RANGE);
    return { opacity: p, transform: [{ translateY: (1 - p) * ACTIONS_SHIFT }] };
  });

  const { coachWidth, stacked } = sceneLayout(width, fontScale);
  const coachHeight = Math.round(coachWidth / figure.ratio);
  const head = figure.head ?? DEFAULT_HEAD;
  // The tip sits just right of the head at eye level; the coach is shifted
  // so that eye level lands right under the tip.
  const tipX = head.x * coachWidth + TIP_GAP;
  const coachTop = TAIL_DROP + 2 - head.y * coachHeight;
  const tail = (): BubbleTail => ({ baseX: tipX + TAIL_SWING, tipX, tipY: TAIL_DROP });

  const answers = (
    <Animated.View style={[styles.answers, stacked ? styles.answersStacked : styles.answersBeside, actionsStyle]}>
      {primary}
      <View style={styles.secondary}>{secondary}</View>
    </Animated.View>
  );

  return (
    <View>
      <Animated.View style={[styles.bubble, bubbleStyle]}>
        <ComicSpeechBubble tail={tail}>
          <View style={styles.message} accessible>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>
        </ComicSpeechBubble>
      </Animated.View>
      <View style={[styles.row, { marginTop: coachTop }]}>
        <Animated.Image
          source={figure.source}
          style={[{ width: coachWidth, height: coachHeight }, coachStyle]}
          resizeMode="contain"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        />
        {stacked ? null : answers}
      </View>
      {stacked ? answers : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Grows from the tail corner.
  bubble: { transformOrigin: '20% 100%' },
  message: { gap: 8 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: colors.text },
  body: { fontSize: 17, lineHeight: 25, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems:    'flex-end',
  },
  answers: { gap: 8 },
  answersBeside: {
    flex:       1,
    marginLeft: ACTIONS_GAP,
  },
  answersStacked: { marginTop: 16 },
  secondary: { alignSelf: 'flex-end' },
});
