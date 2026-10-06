import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { BodyStat, TrainingHeadline } from '../../utils/athleteProfile';

// Body numbers directly on the page: value big, label small beneath, no frame.
// Wraps into further rows on narrow screens or large system fonts.
export function BodyStats({ stats }: { stats: BodyStat[] }): React.ReactElement | null {
  if (stats.length === 0) return null;
  return (
    <View style={styles.stats}>
      {stats.map((s) => (
        <View key={s.label} style={styles.stat} accessible accessibilityLabel={`${s.label}: ${s.value}`}>
          <Text style={styles.statValue} maxFontSizeMultiplier={1.4}>{s.value}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

// Personal description as plain reading text — no heading. On the own profile
// an empty bio becomes a quiet prompt; foreign profiles render nothing.
export function ProfileBio({ bio, onAdd }: { bio: string; onAdd?: () => void }): React.ReactElement | null {
  if (bio.length > 0) return <Text style={styles.bio}>{bio}</Text>;
  if (onAdd === undefined) return null;
  return <QuietAdd label="Ein paar Worte über dich ergänzen" onPress={onAdd} />;
}

// Training as typography: "ca. 5×" big, "Training pro Woche" beside it, the
// experience line beneath. Only stored values, nothing else in this block.
export function TrainingStatement({ headline, onAdd }: {
  headline: TrainingHeadline | null;
  onAdd?:   () => void;
}): React.ReactElement | null {
  if (headline === null) {
    return onAdd !== undefined ? <QuietAdd label="Trainingspensum und Erfahrung ergänzen" onPress={onAdd} /> : null;
  }
  return (
    <View style={styles.training}>
      {headline.times !== null && (
        <View
          style={styles.timesRow}
          accessible
          accessibilityLabel={`Circa ${headline.times.replace('×', ' mal')} Training pro Woche`}
        >
          <Text style={styles.approx}>ca.</Text>
          <Text style={styles.times} maxFontSizeMultiplier={1.2}>{headline.times}</Text>
          <Text style={styles.timesLabel}>Training{'\n'}pro Woche</Text>
        </View>
      )}
      {headline.experience !== null && <Text style={styles.experience}>{headline.experience}</Text>}
    </View>
  );
}

// Small own-profile prompt for an optional, empty field.
export function QuietAdd({ label, onPress }: { label: string; onPress: () => void }): React.ReactElement {
  return (
    <TouchableOpacity style={styles.quietAdd} onPress={onPress} activeOpacity={0.6} accessibilityRole="button">
      <Ionicons name="add" size={18} color={colors.accentBlueText} />
      <Text style={styles.quietAddText}>{label}</Text>
    </TouchableOpacity>
  );
}

// Section title used across the profile: sentence case, no divider line.
export function BlockTitle({ children, action }: { children: string; action?: React.ReactNode }): React.ReactElement {
  return (
    <View style={styles.blockTitleRow}>
      <Text style={styles.blockTitle} accessibilityRole="header">{children}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    columnGap:     32,
    rowGap:        16,
  },
  stat: {
    gap: 0,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize:   30,
    lineHeight: 34,
    color:      colors.text,
  },
  statLabel: {
    fontSize: 13,
    color:    colors.textMuted,
  },
  bio: {
    fontSize:   16,
    lineHeight: 24,
    color:      colors.text,
  },
  training: {
    gap: 8,
  },
  timesRow: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    flexWrap:      'wrap',
    columnGap:     8,
  },
  approx: {
    fontSize:      15,
    fontWeight:    '700',
    color:         colors.textMuted,
    paddingBottom: 8,
  },
  times: {
    fontFamily: fonts.display,
    fontSize:   64,
    lineHeight: 64,
    color:      colors.text,
  },
  timesLabel: {
    fontSize:      15,
    lineHeight:    20,
    fontWeight:    '700',
    color:         colors.text,
    paddingBottom: 8,
  },
  experience: {
    fontSize:   15,
    lineHeight: 22,
    color:      colors.textMuted,
  },
  quietAdd: {
    flexDirection: 'row',
    alignItems:    'center',
    alignSelf:     'flex-start',
    gap:           8,
    minHeight:     44,
  },
  quietAddText: {
    flexShrink: 1,
    fontSize:   15,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },
  blockTitleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            8,
    minHeight:      32,
  },
  blockTitle: {
    flexShrink: 1,
    fontSize:   20,
    fontWeight: '800',
    color:      colors.text,
  },
});
