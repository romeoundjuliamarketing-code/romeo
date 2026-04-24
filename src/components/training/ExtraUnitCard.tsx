import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import type { ExtraUnit } from './ExtraTab';

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  unit: ExtraUnit;
  doneToday: boolean;
  weekDots: boolean[]; // 7 values: Mon(0) … Sun(6)
  loading: boolean;
  onLog: () => void;
};

// ─── Day labels ───────────────────────────────────────────────────────────────

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// ─── Intensity badge color ─────────────────────────────────────────────────────

function intensityColor(intensity: ExtraUnit['intensity']): string {
  switch (intensity) {
    case 'leicht':   return colors.accentBlueSoft;
    case 'mittel':   return 'rgba(200,168,130,0.18)';
    case 'intensiv': return colors.darkMuted;
  }
}

function intensityTextColor(intensity: ExtraUnit['intensity']): string {
  switch (intensity) {
    case 'leicht':   return colors.accentBlue;
    case 'mittel':   return colors.accent;
    case 'intensiv': return colors.textPrimary;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExtraUnitCard({ unit, doneToday, weekDots, loading, onLog }: Props) {
  return (
    <View style={styles.card}>
      {/* ── Header row ── */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>{unit.title}</Text>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: intensityColor(unit.intensity) }]}>
            <Text style={[styles.badgeText, { color: intensityTextColor(unit.intensity) }]}>
              {unit.intensity}
            </Text>
          </View>
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsBadgeText}>
              {unit.isSteps ? 'bis 30p' : `${unit.points}p`}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Duration ── */}
      <Text style={styles.duration}>{unit.durationLabel}</Text>

      {/* ── Week dots ── */}
      <View style={styles.dotsRow}>
        {weekDots.map((done, i) => (
          <View key={i} style={styles.dotItem}>
            <View style={[styles.dot, done && styles.dotDone]} />
            <Text style={styles.dotLabel}>{DAY_LABELS[i]}</Text>
          </View>
        ))}
        <Text style={styles.weekCount}>
          {weekDots.filter(Boolean).length}x
        </Text>
      </View>

      {/* ── Log button ── */}
      <TouchableOpacity
        style={[styles.logBtn, (doneToday || loading) && styles.logBtnDone]}
        onPress={onLog}
        disabled={doneToday || loading}
        activeOpacity={0.75}
      >
        <Text style={[styles.logBtnLabel, (doneToday || loading) && styles.logBtnLabelDone]}>
          {doneToday ? 'Heute geloggt' : 'Heute gemacht'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pointsBadge: {
    backgroundColor: colors.darkMuted,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pointsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  duration: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dotItem: {
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dotDone: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  dotLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  weekCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginLeft: 4,
  },
  logBtn: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logBtnDone: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  logBtnLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  logBtnLabelDone: {
    color: '#FFFFFF',
  },
});
