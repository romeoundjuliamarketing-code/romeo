import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';

const EDGE = 4;          // visible darker bottom edge at rest
const PRESS_DEPTH = 3;   // the face sinks this far while held
const RADIUS = 16;

type Variant = 'primary' | 'quiet' | 'danger';

interface Props {
  label:      string;
  onPress:    () => void;
  variant?:   Variant;
  icon?:      React.ComponentProps<typeof Ionicons>['name'];
  loading?:   boolean;
  disabled?:  boolean;
  /** Shown next to a spinner instead of the label (e.g. eligibility check). */
  busyLabel?: string;
}

// Action button of the sparring sheet. Primary: Sparr blue face on a darker
// edge that sinks on press (same idea as CoachPrimaryButton, in accent blue).
// Quiet/danger: flat light buttons for secondary actions.
export default function SparrDepthButton({
  label, onPress, variant = 'primary', icon, loading = false, disabled = false, busyLabel,
}: Props): React.ReactElement {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pressed.value * PRESS_DEPTH }] }));
  const busy = loading || busyLabel !== undefined;
  const inactive = disabled || busy;
  const a11y = {
    accessibilityRole:  'button' as const,
    accessibilityLabel: label,
    accessibilityState: { disabled: inactive, busy },
  };
  const primary = variant === 'primary';
  const fg = primary ? colors.card : variant === 'danger' ? colors.deleteRed : colors.text;
  const labelStyle = primary ? styles.labelPrimary : variant === 'danger' ? styles.labelDanger : styles.labelQuiet;

  const content = busyLabel !== undefined ? (
    <View style={styles.row}>
      <ActivityIndicator color={fg} />
      <Text style={[styles.label, labelStyle]}>{busyLabel}</Text>
    </View>
  ) : loading ? (
    <ActivityIndicator color={fg} />
  ) : (
    <View style={styles.row}>
      {icon !== undefined && <Ionicons name={icon} size={20} color={fg} />}
      <Text style={[styles.label, labelStyle]}>{label}</Text>
    </View>
  );

  if (!primary) {
    return (
      <Pressable
        style={({ pressed: p }) => [styles.quiet, p && styles.quietPressed, inactive && styles.inactive]}
        onPress={onPress}
        disabled={inactive}
        {...a11y}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[styles.primaryTouch, inactive && styles.inactive]}
      onPress={onPress}
      disabled={inactive}
      onPressIn={() => { pressed.value = withTiming(1, { duration: 60 }); }}
      onPressOut={() => {
        pressed.value = reduceMotion
          ? withTiming(0, { duration: 80 })
          : withSpring(0, { damping: 10, stiffness: 420, mass: 0.6 });
      }}
      {...a11y}
    >
      <View style={styles.edge} />
      <Animated.View style={[styles.face, faceStyle]}>{content}</Animated.View>
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
    backgroundColor: colors.accentBlueEdge,
  },
  face: {
    minHeight:         52,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      RADIUS,
    backgroundColor:   colors.accentBlue,
  },
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
  },
  label: {
    flexShrink: 1,
    textAlign:  'center',
  },
  labelPrimary: {
    fontSize:   17,
    fontWeight: '800',
    color:      colors.card,
  },
  labelQuiet: {
    fontSize:   15,
    fontWeight: '600',
    color:      colors.text,
  },
  labelDanger: {
    fontSize:   15,
    fontWeight: '600',
    color:      colors.deleteRed,
  },
  quiet: {
    minHeight:         48,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      RADIUS,
    borderWidth:       1,
    borderColor:       colors.hairline,
    backgroundColor:   colors.card,
  },
  quietPressed: {
    backgroundColor: colors.background,
  },
  inactive: {
    opacity: 0.6,
  },
});
