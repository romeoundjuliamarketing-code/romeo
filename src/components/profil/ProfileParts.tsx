import React from 'react';
import { View, Text, Pressable, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { FactRow } from '../../utils/athleteProfile';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Toolbar ────────────────────────────────────────────────────────────────

export interface ToolbarAction {
  icon:    IconName;
  label:   string;
  onPress: () => void;
}

// Compact top toolbar of the profile: title or back on the left, small icon
// actions on the right (visually 22 px, touch target 44 px).
export function ProfileToolbar({ title, onBack, actions }: {
  title?:   string;
  onBack?:  () => void;
  actions:  ToolbarAction[];
}): React.ReactElement {
  return (
    <View style={styles.toolbar}>
      {onBack !== undefined ? (
        <TouchableOpacity style={styles.toolBtn} onPress={onBack} accessibilityRole="button" accessibilityLabel="Zurück">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ) : (
        <Text style={styles.toolbarTitle} accessibilityRole="header">{title}</Text>
      )}
      <View style={styles.toolbarActions}>
        {actions.map((a) => (
          <TouchableOpacity
            key={a.label}
            style={styles.toolBtn}
            onPress={a.onPress}
            accessibilityRole="button"
            accessibilityLabel={a.label}
          >
            <Ionicons name={a.icon} size={22} color={colors.text} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
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

export function SectionDivider(): React.ReactElement {
  return <View style={styles.divider} />;
}

// Own-profile prompt for an empty section (never shown on foreign profiles).
export function AddPrompt({ label, onPress }: { label: string; onPress: () => void }): React.ReactElement {
  return (
    <TouchableOpacity style={styles.addPrompt} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      <Ionicons name="add-circle-outline" size={20} color={colors.accentBlue} />
      <Text style={styles.addPromptText}>{label}</Text>
    </TouchableOpacity>
  );
}

// Label/value list, e.g. "So trainiere ich".
export function FactList({ rows }: { rows: FactRow[] }): React.ReactElement {
  return (
    <View style={styles.factList}>
      {rows.map((r) => (
        <View key={r.label} style={styles.factRow}>
          <Text style={styles.factLabel}>{r.label}</Text>
          <Text style={styles.factValue}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 8,
    minHeight:         48,
  },
  toolbarTitle: {
    paddingLeft: 8,
    fontSize:    22,
    fontWeight:  '900',
    color:       colors.text,
  },
  toolbarActions: {
    flexDirection: 'row',
  },
  toolBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
  },
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
  divider: {
    height:          1,
    backgroundColor: colors.hairline,
  },
  addPrompt: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    minHeight:     44,
  },
  addPromptText: {
    flex:       1,
    fontSize:   15,
    fontWeight: '700',
    color:      colors.text,
  },
  factList: {
    gap: 8,
  },
  factRow: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    justifyContent: 'space-between',
    columnGap:      16,
    paddingVertical: 4,
  },
  factLabel: {
    fontSize: 15,
    color:    colors.textMuted,
  },
  factValue: {
    flexShrink: 1,
    fontSize:   15,
    fontWeight: '700',
    color:      colors.text,
    textAlign:  'right',
  },
});
