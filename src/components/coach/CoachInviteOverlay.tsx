import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Modal, StyleSheet, useWindowDimensions, type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing, Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';
import SpeechBubble from './SpeechBubble';
import { CoachPrimaryButton, CoachSecondaryButton } from './CoachAnswerButtons';
import type { CoachFigure } from './coachFigures';

const GUTTER = 16;
const BOTTOM_GAP = 24;             // visible space above the tab bar
const BUBBLE_GAP = 8;              // body starts beside the coach; the tail bridges the gap
const PENGUIN_SHARE = 0.4;         // share of the usable width
const PENGUIN_MIN = 72;
const PENGUIN_MAX = 150;
// One 360 ms entrance; each part plays in its own slice of it.
const ENTER_DURATION = 360;
const PENGUIN_RANGE = [0, 280 / 360];
const BUBBLE_RANGE = [80 / 360, 300 / 360];
const ANSWERS_RANGE = [180 / 360, 1];
const RISE = 20;
const ANSWERS_SHIFT = 6;

// Short coach dialog over the dimmed screen: the penguin on one side, his
// comic speech bubble and the two answers on the other. Texts and pose are
// passed in, so each gate brings its own wording.
export default function CoachInviteOverlay({ visible, figure, bottomInset, lead, body, primaryLabel, laterLabel, onPrimary, onClose }: {
  visible:      boolean;
  figure:       CoachFigure;
  /** Space to keep free at the bottom (safe area, floating tab bar). */
  bottomInset:  number;
  /** First sentence, set bold and larger inside the bubble. */
  lead:         string;
  body:         string;
  primaryLabel: string;
  laterLabel:   string;
  /** Called once per opening; the parent closes the scene and navigates. */
  onPrimary:    () => void;
  onClose:      () => void;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, fontScale } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const enter = useSharedValue(1);
  // Blocks double taps on the primary action until the next opening.
  const leavingRef = useRef(false);
  const [columnHeight, setColumnHeight] = useState(0);

  useEffect(() => {
    if (!visible) return;
    leavingRef.current = false;
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

  const penguinStyle = useAnimatedStyle(() => {
    const p = part(enter.value, PENGUIN_RANGE);
    return { opacity: p, transform: [{ translateY: (1 - p) * RISE }] };
  });
  const bubbleStyle = useAnimatedStyle(() => {
    const p = part(enter.value, BUBBLE_RANGE);
    return { opacity: p, transform: [{ scale: 0.96 + p * 0.04 }] };
  });
  const answersStyle = useAnimatedStyle(() => {
    const p = part(enter.value, ANSWERS_RANGE);
    return { opacity: p, transform: [{ translateY: (1 - p) * ANSWERS_SHIFT }] };
  });

  // Large text needs the room: the figure shrinks first.
  const usable = screenWidth - GUTTER * 2;
  const textShrink = fontScale > 1.15 ? (1.15 / fontScale) ** 2 : 1;
  const penguinWidth = Math.round(Math.max(PENGUIN_MIN, Math.min(PENGUIN_MAX, usable * PENGUIN_SHARE * textShrink)));
  const penguinHeight = Math.round(penguinWidth / figure.ratio);

  // Penguin and answers share the bottom edge; the tail aims at the beak.
  const tailY = columnHeight - penguinHeight + penguinHeight * figure.tailY;
  const onRight = figure.side === 'right';

  function handlePrimary(): void {
    if (leavingRef.current) return;
    leavingRef.current = true;
    onPrimary();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.overlay} accessibilityViewIsModal>
        {/* Stronger dim towards the bottom so controls behind recede. */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="coachScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.45" stopColor={colors.dark} stopOpacity={0} />
              <Stop offset="1" stopColor={colors.dark} stopOpacity={0.45} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#coachScrim)" />
        </Svg>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + GUTTER, paddingBottom: bottomInset + BOTTOM_GAP }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Free dimmed area above the scene closes it (screen readers use the answer buttons). */}
          <Pressable style={styles.spacer} onPress={onClose} accessible={false} importantForAccessibility="no" />
          <View style={[styles.row, onRight && styles.rowReverse]}>
            <Animated.Image
              source={figure.source}
              style={[{ width: penguinWidth, height: penguinHeight }, penguinStyle]}
              resizeMode="contain"
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            />
            <View style={[styles.column, onRight ? styles.columnLeft : styles.columnRight]} onLayout={(e: LayoutChangeEvent) => setColumnHeight(e.nativeEvent.layout.height)}>
              <Animated.View style={bubbleStyle}>
                <SpeechBubble tailY={tailY} tailSide={figure.side}>
                  <View style={styles.message} accessible>
                    <Text style={styles.lead}>{lead}</Text>
                    <Text style={styles.body}>{body}</Text>
                  </View>
                </SpeechBubble>
              </Animated.View>
              <Animated.View style={[styles.answers, answersStyle]}>
                <CoachPrimaryButton label={primaryLabel} onPress={handlePrimary} />
                <CoachSecondaryButton label={laterLabel} onPress={onClose} style={onRight ? styles.laterStart : styles.laterEnd} />
              </Animated.View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: colors.mapOverlay,
  },
  scroll: { flex: 1 },
  content: {
    flexGrow:          1,
    justifyContent:    'flex-end',
    paddingHorizontal: GUTTER,
  },
  spacer: { flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems:    'flex-end',
  },
  rowReverse: { flexDirection: 'row-reverse' },
  column: { flex: 1 },
  columnRight: { marginLeft: BUBBLE_GAP },
  columnLeft: { marginRight: BUBBLE_GAP },
  message: { gap: 8 },
  lead: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: colors.text },
  body: { fontSize: 16, lineHeight: 24, color: colors.text },
  answers: {
    marginTop: 16,
    gap:       8,
  },
  laterEnd: { alignSelf: 'flex-end' },
  laterStart: { alignSelf: 'flex-start' },
});
