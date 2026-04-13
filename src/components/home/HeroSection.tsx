import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import StudioTrainingCard from './StudioTrainingCard';

// ─── Static data ──────────────────────────────────────────────────────────────

const USER_NAME     = 'Romeo';
const USER_INITIALS = 'RG';
const DAY_LABELS    = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const TOTAL_DAYS    = DAY_LABELS.length;

const TODAY_WORKOUT = { title: 'Upper Body Power', duration: '45 Min', category: 'Kraft' };

// 0 = Mon … 6 = Sun
const jsDay      = new Date().getDay();
const TODAY_INDEX = (jsDay + 6) % 7;

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  completedDayIndices: number[];
  streak: number;
};

export default function HeroSection({ completedDayIndices, streak }: Props) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';

  // Connector line geometry derived from real completed days
  const connectorLeft = useMemo((): `${number}%` => {
    if (completedDayIndices.length < 2) return '0%';
    const min = Math.min(...completedDayIndices);
    return `${((min + 0.5) / TOTAL_DAYS) * 100}%`;
  }, [completedDayIndices]);

  const connectorWidth = useMemo((): `${number}%` => {
    if (completedDayIndices.length < 2) return '0%';
    const min = Math.min(...completedDayIndices);
    const max = Math.max(...completedDayIndices);
    return `${((max - min) / TOTAL_DAYS) * 100}%`;
  }, [completedDayIndices]);

  return (
    <View style={styles.hero}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.name}>{USER_NAME}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{USER_INITIALS}</Text>
        </View>
      </View>

      {/* ── Streak ── */}
      {streak > 0 && (
        <View style={styles.streakWrap}>
          <Text style={styles.streakValue}>{streak}</Text>
          <Text style={styles.streakLabel}>Tage hintereinander</Text>
        </View>
      )}

      {/* ── Week strip ── */}
      <View style={styles.weekStrip}>
        {/* Connector line behind completed dots — data-driven width/left */}
        {completedDayIndices.length > 1 && (
          <View
            style={[styles.connectorLine, { left: connectorLeft, width: connectorWidth }]}
          />
        )}
        {DAY_LABELS.map((day, i) => {
          const isDone   = completedDayIndices.includes(i);
          const isToday  = i === TODAY_INDEX;
          const isFuture = i > TODAY_INDEX;
          return (
            <View key={day} style={styles.dayCol}>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{day}</Text>
              <View style={[
                styles.dayCircle,
                isDone              && styles.dayCircleDone,
                isToday && !isDone  && styles.dayCircleToday,
                isFuture            && styles.dayCircleFuture,
              ]}>
                {isDone            && <Text style={styles.dayCheck}>✓</Text>}
                {isToday && !isDone && <View style={styles.dayDot} />}
              </View>
            </View>
          );
        })}
      </View>
      <Text style={styles.weekSubtext}>{completedDayIndices.length} von 7 Tagen erledigt</Text>

      {/* ── Studio session ── */}
      <StudioTrainingCard dark />

      {/* ── Today's own workout ── */}
      <View style={styles.workoutCard}>
        <Text style={styles.workoutCardTitle}>Heutiges Training</Text>
        <View style={styles.workoutRow}>
          <View style={styles.workoutIconWrap}>
            <MaterialCommunityIcons name="lightning-bolt" size={24} color={colors.accentBlue} />
          </View>
          <View style={styles.workoutInfo}>
            <Text style={styles.workoutTitle}>{TODAY_WORKOUT.title}</Text>
            <View style={styles.workoutMeta}>
              <MaterialCommunityIcons name="clock-outline" size={13} color={colors.headerTextSecondary} />
              <Text style={styles.workoutMetaText}>{TODAY_WORKOUT.duration}</Text>
              <View style={styles.workoutDivider} />
              <MaterialCommunityIcons name="weight-lifter" size={13} color={colors.headerTextSecondary} />
              <Text style={styles.workoutMetaText}>{TODAY_WORKOUT.category}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.startButton} activeOpacity={0.8}>
          <Text style={styles.startButtonText}>Training starten</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 13,
    color: colors.headerTextSecondary,
    fontWeight: '400',
    marginBottom: 2,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.headerTextPrimary,
    letterSpacing: -0.5,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.headerCard,
    borderWidth: 1.5,
    borderColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.headerTextPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Streak
  streakWrap: {
    alignItems: 'center',
    marginBottom: 32,
  },
  streakValue: {
    fontSize: 52,
    fontWeight: '800',
    color: colors.accentBlue,
    letterSpacing: -2,
    lineHeight: 60,
  },
  streakLabel: {
    fontSize: 11,
    color: colors.headerTextSecondary,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  streakMotivation: {
    fontSize: 11,
    color: colors.headerTextSecondary,
    fontWeight: '400',
  },

  // Week strip
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    position: 'relative',
  },
  // Connector line: width + left are data-driven and passed inline
  connectorLine: {
    position: 'absolute',
    top: 36,
    height: 1.5,
    backgroundColor: colors.accentBlueMuted,
  },
  dayCol: {
    alignItems: 'center',
    gap: 6,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.headerTextSecondary,
  },
  dayLabelToday: {
    color: colors.headerTextPrimary,
    fontWeight: '700',
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: colors.headerBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.headerBg, // masks connector line underneath
  },
  dayCircleDone: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  dayCircleToday: {
    borderColor: colors.headerTextPrimary,
    backgroundColor: colors.headerBg,
  },
  dayCircleFuture: {
    backgroundColor: colors.headerDotFuture,
    borderColor: 'transparent',
  },
  dayCheck: {
    color: colors.headerTextPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.headerTextPrimary,
  },
  weekSubtext: {
    fontSize: 12,
    color: colors.headerTextSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },

  // Today's own workout card
  workoutCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 16,
  },
  workoutCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 14,
  },
  workoutIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.headerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutInfo: {
    flex: 1,
  },
  workoutTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.headerTextPrimary,
    marginBottom: 5,
  },
  workoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  workoutMetaText: {
    fontSize: 12,
    color: colors.headerTextSecondary,
    fontWeight: '500',
  },
  workoutDivider: {
    width: 1,
    height: 12,
    backgroundColor: colors.headerBorder,
    marginHorizontal: 4,
  },
  startButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: colors.headerBg,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
