import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import StudioTrainingCard from './StudioTrainingCard';
import DailyStretchCard from './DailyStretchCard';
import DailyMobilityCard from './DailyMobilityCard';
import type { StudioSchedule, TeamAnnouncement } from '../../types/database.types';

// Returns 'stretch' on even day-of-year, 'mobility' on odd — alternates daily
function todayRoutineType(): 'stretch' | 'mobility' {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.now() - start) / 86_400_000);
  return dayOfYear % 2 === 0 ? 'stretch' : 'mobility';
}

// ─── Static data ──────────────────────────────────────────────────────────────

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const TOTAL_DAYS = DAY_LABELS.length;

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  name: string | null;
  announcement: TeamAnnouncement | null;
  isCoach: boolean;
  onDeleteAnnouncement: () => void;
  completedDayIndices: number[];
  streak: number;
  todaySession: StudioSchedule | null;
  isParticipating: boolean;
  onParticipate: () => void;
  onCancel: () => void;
  stretchDone: boolean;
  stretchUrgent: boolean;
  onStretch: () => void;
  mobilityDone: boolean;
  mobilityUrgent: boolean;
  onMobility: () => void;
};

export default function HeroSection({
  name,
  announcement,
  isCoach,
  onDeleteAnnouncement,
  completedDayIndices,
  streak,
  todaySession,
  isParticipating,
  onParticipate,
  onCancel,
  stretchDone,
  stretchUrgent,
  onStretch,
  mobilityDone,
  mobilityUrgent,
  onMobility,
}: Props) {
  const routineType = todayRoutineType();
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Guten Morgen' : now.getHours() < 18 ? 'Guten Tag' : 'Guten Abend';
  const todayIndex = (now.getDay() + 6) % 7;

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

      {/* ── Header: greeting left, logo centered ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{greeting}</Text>
          {name !== null && <Text style={styles.name}>{name.split(' ')[0]}</Text>}
        </View>
        <View style={styles.logoWrap}>
          <Image
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            source={require('../../../assets/logo-home.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* ── Streak ── */}
      <View style={styles.streakWrap}>
        <Text style={styles.streakValue}>{streak}</Text>
        <Text style={styles.streakLabel}>Tage hintereinander</Text>
      </View>

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
          const isToday  = i === todayIndex;
          const isFuture = i > todayIndex;
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

      {announcement !== null && (
        <View style={styles.announcementCard}>
          <View style={styles.announcementHeader}>
            <Text style={styles.announcementTitle}>Ankündigung vom Trainer</Text>
            {isCoach && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={onDeleteAnnouncement}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteButtonLabel}>Löschen</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.announcementText}>{announcement.message}</Text>
        </View>
      )}

      {/* ── Studio session ── */}
      <StudioTrainingCard
        dark
        session={todaySession}
        participating={isParticipating}
        onParticipate={onParticipate}
        onCancel={onCancel}
      />

      {/* ── Daily routine (alternates daily: stretch / mobility) ── */}
      {routineType === 'stretch' ? (
        <DailyStretchCard
          isDone={stretchDone}
          isUrgent={stretchUrgent}
          onConfirm={onStretch}
        />
      ) : (
        <DailyMobilityCard
          isDone={mobilityDone}
          isUrgent={mobilityUrgent}
          onConfirm={onMobility}
        />
      )}


    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: {
    flex: 1,
    maxWidth: '45%',
  },
  logoWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -14,
    alignItems: 'center',
  },
  headerLogo: {
    width: 220,
    height: 100,
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
  announcementCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderLeftWidth: 3,
    borderLeftColor: colors.accentBlue,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  announcementTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  deleteButton: {
    height: 32,
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  deleteButtonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  announcementText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.headerTextPrimary,
    lineHeight: 22,
  },

});
