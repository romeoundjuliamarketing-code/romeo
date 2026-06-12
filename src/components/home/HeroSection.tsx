import React, { useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager, Dimensions, type LayoutChangeEvent } from 'react-native';
import HeroNetworkPattern, { type HeroNetworkPatternHandle } from './HeroNetworkPattern';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
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
  todaySessions: StudioSchedule[];
  isSessionParticipating: (sessionId: string, date: string) => boolean;
  onSessionParticipate: (session: StudioSchedule) => void;
  onSessionCancel: (session: StudioSchedule) => void;
  stretchDone: boolean;
  stretchUrgent: boolean;
  onStretch: () => void;
  mobilityDone: boolean;
  mobilityUrgent: boolean;
  onMobility: () => void;
  onNotificationsPress: () => void;
  unreadNotificationCount: number;
  networkPatternRef?: React.Ref<HeroNetworkPatternHandle>;
};

export default function HeroSection({
  name,
  announcement,
  isCoach,
  onDeleteAnnouncement,
  completedDayIndices,
  streak,
  todaySessions,
  isSessionParticipating,
  onSessionParticipate,
  onSessionCancel,
  onNotificationsPress,
  unreadNotificationCount,
  stretchDone,
  stretchUrgent,
  onStretch,
  mobilityDone,
  mobilityUrgent,
  onMobility,
  networkPatternRef,
}: Props) {
  const routineType = todayRoutineType();
  const [expanded, setExpanded] = useState(false);
  const [heroHeight, setHeroHeight] = useState(0);
  const [streakCenter, setStreakCenter] = useState<{ x: number; y: number } | null>(null);
  const onHeroLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setHeroHeight(h);
  };
  const todayDate = new Date().toISOString().split('T')[0];
  const firstSession = todaySessions[0] ?? null;
  const extraSessions = todaySessions.slice(1);
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
    <View style={styles.hero} onLayout={onHeroLayout}>
      <HeroNetworkPattern ref={networkPatternRef} height={heroHeight} exclusionCenter={streakCenter} />

      {/* ── Header: greeting left, logo centered, bell right ── */}
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
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={onNotificationsPress}
            style={styles.bellButton}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="notifications-outline"
              size={24}
              color={colors.headerTextPrimary}
            />
            {unreadNotificationCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadNotificationCount > 99 ? '99+' : String(unreadNotificationCount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Streak ── */}
      <View
        style={styles.streakWrap}
        onLayout={(e) => {
          const { y, height } = e.nativeEvent.layout;
          setStreakCenter({ x: Dimensions.get('window').width / 2, y: y + height / 2 });
        }}
      >
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

      {/* ── Studio sessions ── */}
      <View>
        <StudioTrainingCard
          dark
          session={firstSession}
          participating={firstSession !== null && isSessionParticipating(firstSession.id, todayDate)}
          onParticipate={() => { if (firstSession !== null) onSessionParticipate(firstSession); }}
          onCancel={() => { if (firstSession !== null) onSessionCancel(firstSession); }}
        />
        {extraSessions.length > 0 && !expanded && (
          <TouchableOpacity
            style={styles.alleSehenBtn}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setExpanded(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.alleSehenText}>Alle sehen</Text>
            <Ionicons name="chevron-down" size={15} color={colors.headerTextSecondary} />
          </TouchableOpacity>
        )}
        {expanded && extraSessions.map((session) => (
          <StudioTrainingCard
            key={session.id}
            dark
            session={session}
            participating={isSessionParticipating(session.id, todayDate)}
            onParticipate={() => onSessionParticipate(session)}
            onCancel={() => onSessionCancel(session)}
          />
        ))}
        {expanded && (
          <TouchableOpacity
            style={styles.alleSehenBtn}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setExpanded(false);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.alleSehenText}>Weniger</Text>
            <Ionicons name="chevron-up" size={15} color={colors.headerTextSecondary} />
          </TouchableOpacity>
        )}
      </View>

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
    overflow: 'hidden',
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
  headerRight: {
    flex: 1,
    maxWidth: '45%',
    alignItems: 'flex-end',
  },
  bellButton: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.deleteRed,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.headerTextPrimary,
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
  alleSehenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -10,
    marginBottom: 16,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.headerBorder,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  alleSehenText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },

});
