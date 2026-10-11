import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, TouchableOpacity, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';

export const ONBOARDING_GUTTER = 16;

// Full-screen frame of both onboarding steps: progress on top (with back and
// sign-out), scrollable content in the middle, the main action pinned at the
// bottom above the keyboard. Own screen with a warm background, no app behind.
// Vertical padding of the body (content style below), part of its height.
const BODY_PADDING = 16 + 24;

export default function OnboardingShell({ step, total, onBack, onSignOut, renderHero, footer, children }: {
  step:      number;
  /** Steps this account goes through; with only one the progress is hidden. */
  total:     number;
  /** Shown on step 2: back to step 1. */
  onBack?:   () => void;
  onSignOut: () => void;
  /**
   * Edge-to-edge content above the padded body (e.g. the welcome scene). Gets
   * the height left over by the body in the visible area, so hints under the
   * last field are never cut off by the pinned footer; null = not measured yet.
   */
  renderHero?: (maxHeight: number | null) => React.ReactNode;
  footer:    React.ReactNode;
  children:  React.ReactNode;
}): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const sidePadding = { paddingLeft: insets.left + ONBOARDING_GUTTER, paddingRight: insets.right + ONBOARDING_GUTTER };
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [bodyHeight, setBodyHeight] = useState<number | null>(null);
  const heroRoom = viewportHeight !== null && bodyHeight !== null
    ? viewportHeight - bodyHeight - BODY_PADDING
    : null;
  const measure = (set: (h: number) => void) => (e: LayoutChangeEvent): void => {
    set(Math.round(e.nativeEvent.layout.height));
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.header, sidePadding, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerSide}>
          {onBack !== undefined && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.back')}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
        {total > 1 && (
        <View
          style={styles.progress}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('onboarding.progress', { step, total })}
          accessibilityValue={{ min: 1, max: total, now: step }}
        >
          <View style={styles.bars}>
            {Array.from({ length: total }, (_, i) => (
              <View key={i} style={[styles.bar, i < step && styles.barDone]} />
            ))}
          </View>
          <Text style={styles.progressText}>{t('onboarding.progress', { step, total })}</Text>
        </View>
        )}
        <View style={[styles.headerSide, styles.headerSideEnd]}>
          <TouchableOpacity style={styles.headerButton} onPress={onSignOut} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.signOut} numberOfLines={1}>{t('onboarding.signOut')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        // Edge-to-edge (SDK 55): the window no longer resizes on Android either.
        behavior="padding"
      >
        <ScrollView
          style={styles.flex}
          onLayout={measure(setViewportHeight)}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {renderHero?.(heroRoom)}
          <View style={[styles.content, sidePadding]}>
            {/* Measured at natural height with a hero; grows into free space without. */}
            <View style={[styles.body, renderHero === undefined && styles.bodyGrow]} onLayout={measure(setBodyHeight)}>
              {children}
            </View>
          </View>
        </ScrollView>
        <View style={[styles.footer, sidePadding, { paddingBottom: insets.bottom + 16 }]}>
          {footer}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingBottom:  8,
  },
  headerSide: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
  },
  headerSideEnd: { justifyContent: 'flex-end' },
  headerButton: {
    minHeight:      44,
    minWidth:       44,
    justifyContent: 'center',
  },
  progress: {
    alignItems: 'center',
    gap:        8,
  },
  bars: {
    flexDirection: 'row',
    gap:           8,
  },
  bar: {
    width:           32,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.hairline,
  },
  barDone: { backgroundColor: colors.brandPrimary },
  progressText: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.textMuted,
  },
  signOut: {
    fontSize:   15,
    fontWeight: '600',
    color:      colors.textMuted,
    textAlign:  'right',
  },
  scrollContent: { flexGrow: 1 },
  content: {
    flexGrow:      1,
    paddingTop:    16,
    paddingBottom: 24,
  },
  body: { gap: 24 },
  bodyGrow: { flexGrow: 1 },
  footer: {
    paddingTop: 8,
    gap:        8,
  },
});
