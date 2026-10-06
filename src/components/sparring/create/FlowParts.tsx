import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { fonts } from '../../../theme/typography';

// Small building blocks shared by the three steps of the create flow.

export function StepTitle({ text }: { text: string }): React.ReactElement {
  return <Text style={styles.stepTitle} accessibilityRole="header">{text}</Text>;
}

export function SectionLabel({ text, hint }: { text: string; hint?: string }): React.ReactElement {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionLabel}>{text}</Text>
      {hint !== undefined && <Text style={styles.sectionHint}>{hint}</Text>}
    </View>
  );
}

export function FieldError({ text }: { text: string | undefined }): React.ReactElement | null {
  if (text === undefined) return null;
  return (
    <View style={styles.errorRow} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Ionicons name="alert-circle" size={16} color={colors.deleteRed} />
      <Text style={styles.errorText}>{text}</Text>
    </View>
  );
}

const STEP_OFFSET = 24;

// Short slide/fade when a step mounts. Only transform + opacity, ends on exact
// values (sharp resting state), skipped entirely with "Bewegung reduzieren".
export function StepTransition({ direction, children }: {
  direction: 1 | -1;
  children: React.ReactNode;
}): React.ReactElement {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    if (progress.value >= 1) return { opacity: 1, transform: [] };
    return {
      opacity: progress.value,
      transform: [{ translateX: Math.round((1 - progress.value) * STEP_OFFSET * direction) }],
    };
  });

  return <Animated.View style={[styles.fill, animatedStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    color: colors.text,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  sectionHead: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.text,
  },
  sectionHint: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textMuted,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.deleteRed,
    fontWeight: '600',
  },
});
