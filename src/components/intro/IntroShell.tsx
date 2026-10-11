import React, { useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, AccessibilityInfo, findNodeHandle, StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { FLOW_TOTAL_STEPS } from '../../utils/intro';

export const INTRO_GUTTER = 24;

// Frame of the two intro steps (own screen, warm background, nothing of the
// app behind it): back, four progress segments and "Später" on top; topic
// line, large left-aligned title and one lead sentence; the step's scene
// and notes scroll; the main action is pinned at the same bottom position
// on both steps.
export default function IntroShell({
  step, topic, title, lead, onBack, onLater, footer, children,
}: {
  /** 1-based step of the whole flow (3 or 4). */
  step:     number;
  topic:    string;
  title:    string;
  lead:     string;
  /** Hidden when there is nothing to go back to. */
  onBack?:  () => void;
  onLater:  () => void;
  footer:   React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const titleRef = useRef<Text>(null);
  const side = { paddingLeft: insets.left + INTRO_GUTTER, paddingRight: insets.right + INTRO_GUTTER };

  // Screen readers start each step at its title.
  useEffect(() => {
    const node = findNodeHandle(titleRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [step]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.header, side, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerSide}>
          {onBack !== undefined && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.back')}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
        <View
          style={styles.bars}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('onboarding.progress', { step, total: FLOW_TOTAL_STEPS })}
          accessibilityValue={{ min: 1, max: FLOW_TOTAL_STEPS, now: step }}
        >
          {Array.from({ length: FLOW_TOTAL_STEPS }, (_, i) => (
            <View key={i} style={[styles.bar, i < step && styles.barDone]} />
          ))}
        </View>
        <View style={[styles.headerSide, styles.headerSideEnd]}>
          <TouchableOpacity style={styles.headerButton} onPress={onLater} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.later} numberOfLines={1}>{t('onboarding.intro.later')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, side]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heading}>
          <Text style={styles.topic}>{topic}</Text>
          <Text ref={titleRef} style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.lead}>{lead}</Text>
        </View>
        {children}
      </ScrollView>

      <View style={[styles.footer, side, { paddingBottom: insets.bottom + 16 }]}>
        {footer}
      </View>
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
    flexDirection: 'row',
    alignItems:    'center',
    paddingBottom: 8,
  },
  headerSide: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
  },
  headerSideEnd: { justifyContent: 'flex-end' },
  headerButton: {
    minHeight:      44,
    minWidth:       44,
    justifyContent: 'center',
  },
  bars: {
    flexDirection: 'row',
    gap:           8,
  },
  bar: {
    width:           32,
    height:          6,
    borderRadius:    3,
    backgroundColor: colors.hairline,
  },
  barDone: { backgroundColor: colors.brandPrimary },
  later: {
    fontSize:   15,
    fontWeight: '600',
    color:      colors.textMuted,
    textAlign:  'right',
  },
  scrollContent: {
    flexGrow:      1,
    paddingTop:    16,
    paddingBottom: 16,
    gap:           16,
  },
  heading: { gap: 8 },
  topic: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color:         colors.brandPrimary,
  },
  title: {
    fontSize:   30,
    lineHeight: 36,
    fontWeight: '800',
    color:      colors.text,
  },
  lead: {
    fontSize:   16,
    lineHeight: 23,
    color:      colors.text,
  },
  footer: {
    paddingTop: 8,
    gap:        8,
  },
});
