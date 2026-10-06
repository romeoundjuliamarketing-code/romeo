import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Toolbar ────────────────────────────────────────────────────────────────

export interface ToolbarAction {
  icon:    IconName;
  label:   string;
  onPress: () => void;
}

// ─── Buttons with press feedback ───────────────────────────────────────────

// Short scale feedback on press (transform only); none with "reduce motion".
export function PressScale({ onPress, style, children, disabled, accessibilityLabel }: {
  onPress:  () => void;
  style:    React.ComponentProps<typeof View>['style'];
  children: React.ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
}): React.ReactElement {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled === true }}
      onPressIn={() => { if (!reduceMotion) scale.value = withTiming(0.97, { duration: 80 }); }}
      onPressOut={() => { if (!reduceMotion) scale.value = withTiming(1, { duration: 120 }); }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

// Primary: brand blue with dark label (white on #4A90D9 is only 3.3:1).
export function PrimaryButton({ icon, label, onPress, loading = false, disabled = false }: {
  icon: IconName; label: string; onPress: () => void; loading?: boolean; disabled?: boolean;
}): React.ReactElement {
  return (
    <PressScale
      onPress={onPress}
      style={[styles.primaryBtn, disabled && styles.primaryBtnDisabled]}
      disabled={loading || disabled}
      accessibilityLabel={label}
    >
      {loading ? <ActivityIndicator color={colors.dark} /> : (
        <>
          <Ionicons name={icon} size={18} color={colors.dark} />
          <Text style={styles.primaryText}>{label}</Text>
        </>
      )}
    </PressScale>
  );
}

// Secondary: white with hairline border, dark label, blue icon.
export function SecondaryButton({ icon, label, onPress }: {
  icon: IconName; label: string; onPress: () => void;
}): React.ReactElement {
  return (
    <PressScale onPress={onPress} style={styles.secondaryBtn} accessibilityLabel={label}>
      <Ionicons name={icon} size={18} color={colors.accentBlue} />
      <Text style={styles.secondaryText} numberOfLines={1}>{label}</Text>
    </PressScale>
  );
}

// ─── Sections ───────────────────────────────────────────────────────────────

// Page section: heading + content, separated from the next by a hairline.
export function ProfileSection({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
    minHeight:         48,
    paddingHorizontal: 16,
    borderRadius:      16,
    backgroundColor:   colors.accentBlue,
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryText: {
    fontSize:   16,
    fontWeight: '800',
    color:      colors.dark,
  },
  secondaryBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
    minHeight:         44,
    paddingHorizontal: 16,
    borderRadius:      16,
    borderWidth:       1,
    borderColor:       colors.hairline,
    backgroundColor:   colors.card,
  },
  secondaryText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.text,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize:   20,
    fontWeight: '800',
    color:      colors.text,
  },
});
