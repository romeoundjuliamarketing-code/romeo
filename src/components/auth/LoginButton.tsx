import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';

interface Props {
  label:   string;
  loading: boolean;
  onPress: () => void;
}

// Primary login action: presses in to 0.98 on the UI thread, shows a spinner in
// place of the label while busy and ignores further taps until done. Fixed
// min height, so switching label and spinner never changes its size.
export default function LoginButton({ label, loading, onPress }: Props): React.ReactElement {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => () => cancelAnimation(scale), [scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const pressTo = (value: number): void => {
    if (reduceMotion) return;
    scale.value = withTiming(value, { duration: 120 });
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => pressTo(0.98)}
        onPressOut={() => pressTo(1)}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: loading, busy: loading }}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        {/* The label keeps its space while hidden, so the spinner never resizes the button */}
        <Text style={[styles.label, loading && styles.labelHidden]} maxFontSizeMultiplier={1.6}>{label}</Text>
        {loading && <ActivityIndicator style={styles.spinner} color={colors.card} />}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight:         56,
    borderRadius:      16,
    paddingHorizontal: 24,
    paddingVertical:   16,
    backgroundColor:   colors.accentBlue,
    alignItems:        'center',
    justifyContent:    'center',
  },
  buttonPressed: {
    backgroundColor: colors.accentBluePressed,
  },
  label: {
    // 19 pt bold counts as large text, so white on the brand blue (3.3:1) passes.
    fontSize:   19,
    fontWeight: '800',
    color:      colors.card,
  },
  labelHidden: {
    opacity: 0,
  },
  spinner: {
    ...StyleSheet.absoluteFillObject,
  },
});
