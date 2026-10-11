import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';

const EDGE = 5;          // visible bottom edge at rest
const PRESS_DEPTH = 3;   // the face sinks this far while held
const RADIUS = 16;
const STROKE = 2;

// Chunky "game" button: a face on a darker edge. Pressing sinks the face,
// releasing springs it back. The touch area never moves. `loading`: a
// spinner instead of the arrow, not pressable until it is done.
export function CoachPrimaryButton({ label, onPress, loading = false }: {
  label:    string;
  onPress:  () => void;
  loading?: boolean;
}): React.ReactElement {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pressed.value * PRESS_DEPTH }] }));

  return (
    <Pressable
      style={styles.primaryTouch}
      onPress={onPress}
      disabled={loading}
      onPressIn={() => { pressed.value = withTiming(1, { duration: 60 }); }}
      onPressOut={() => {
        pressed.value = reduceMotion
          ? withTiming(0, { duration: 80 })
          : withSpring(0, { damping: 9, stiffness: 420, mass: 0.6 });
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled: loading }}
    >
      <View style={styles.edge} />
      <Animated.View style={[styles.face, loading && styles.faceLoading, faceStyle]}>
        <Text style={styles.primaryText}>{label}</Text>
        {loading
          ? <ActivityIndicator color={colors.card} />
          : <Ionicons name="arrow-forward" size={20} color={colors.card} />}
      </Animated.View>
    </Pressable>
  );
}

// Quiet light answer next to the primary one.
export function CoachSecondaryButton({ label, onPress, style }: {
  label:   string;
  onPress: () => void;
  style?:  StyleProp<ViewStyle>;
}): React.ReactElement {
  return (
    <Pressable
      style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed, style]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryTouch: {
    paddingBottom: EDGE,
  },
  edge: {
    position:        'absolute',
    left:            0,
    right:           0,
    top:             EDGE,
    bottom:          0,
    borderRadius:    RADIUS,
    borderWidth:     STROKE,
    borderColor:     colors.dark,
    backgroundColor: colors.coachButtonEdge,
  },
  face: {
    minHeight:         52,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      RADIUS,
    borderWidth:       STROKE,
    borderColor:       colors.dark,
    backgroundColor:   colors.brandPrimary,
  },
  faceLoading: { opacity: 0.85 },
  primaryText: { flexShrink: 1, fontSize: 18, fontWeight: '800', color: colors.card, textAlign: 'center' },
  secondary: {
    minHeight:         44,
    justifyContent:    'center',
    paddingHorizontal: 16,
    borderRadius:      14,
    borderWidth:       1.5,
    borderColor:       colors.dark,
    backgroundColor:   colors.coachBubble,
  },
  secondaryPressed: { backgroundColor: colors.background },
  secondaryText: { fontSize: 15, fontWeight: '600', color: colors.text },
});
