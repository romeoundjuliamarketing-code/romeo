import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useSchedule } from '../hooks/useSchedule';
import { useParticipation } from '../hooks/useParticipation';
import { useProfile } from '../hooks/useProfile';
import StundenplanSection from '../components/training/StundenplanSection';
import WorkoutCategoryRows from '../components/training/WorkoutCategoryRows';
import ExtraTab from '../components/training/ExtraTab';
import WeeklyVolumeCard from '../components/training/WeeklyVolumeCard';
import type { StudioSchedule } from '../types/database.types';

type TabKey = 'workouts' | 'plan';

// JS getDay(): 0=Sun … 6=Sat → 0=Mon … 6=Sun
function todayDayOfWeek(): number {
  return (new Date().getDay() + 6) % 7;
}

// ─── Today session card ───────────────────────────────────────────────────────

type TodayCardProps = {
  session: StudioSchedule;
  participating: boolean;
  onParticipate: () => void;
  onCancel: () => void;
};

function TodaySessionCard({ session, participating, onParticipate, onCancel }: TodayCardProps): React.ReactElement {
  return (
    <View style={styles.todayCard}>
      <View style={styles.todayCardInfo}>
        <Text style={styles.todayCardName}>{session.training_name}</Text>
        <Text style={styles.todayCardMeta}>
          {session.start_time.slice(0, 5)} Uhr · {session.duration_min} Min
          {session.coach_name !== null ? ` · ${session.coach_name}` : ''}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.participateBtn, participating && styles.participateBtnActive]}
        onPress={participating ? onCancel : onParticipate}
        activeOpacity={0.7}
      >
        <Text style={[styles.participateBtnText, participating && styles.participateBtnTextActive]}>
          {participating ? 'Zugesagt' : 'Teilnehmen'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrainingScreen(): React.ReactElement {
  const todayDow = todayDayOfWeek();
  const todayDate = new Date().toISOString().split('T')[0];
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>('workouts');

  useFocusEffect(useCallback(() => {
    setFocusTrigger((n) => n + 1);
  }, []));

  const { schedule: fullSchedule, loading: scheduleLoading } = useSchedule();
  const todaySchedule = fullSchedule.filter((s) => s.day_of_week === todayDow);
  const { isParticipating, participate, cancelParticipation } = useParticipation();
  const { profile } = useProfile(focusTrigger);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>

        {/* ── Tab bar (fixiert) ── */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'workouts' && styles.tabPillActive]}
            onPress={() => setActiveTab('workouts')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === 'workouts' && styles.tabLabelActive]}>
              Workouts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'plan' && styles.tabPillActive]}
            onPress={() => setActiveTab('plan')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === 'plan' && styles.tabLabelActive]}>
              Plan
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Scrollbarer Inhalt ── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header scrollt mit */}
          <View style={styles.header}>
            {todaySchedule.length === 0 ? (
              <View style={styles.todayCard}>
                <View style={styles.todayCardInfo}>
                  <Text style={styles.todayCardName}>Heute kein Studiotraining</Text>
                </View>
                <TouchableOpacity onPress={() => setActiveTab('workouts')} activeOpacity={0.7}>
                  <Text style={styles.freeTrainingLink}>Freies Training starten</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.todayList}>
                {todaySchedule.map((session) => (
                  <TodaySessionCard
                    key={session.id}
                    session={session}
                    participating={isParticipating(session.id, todayDate)}
                    onParticipate={() => { void participate(session.id, todayDate, session.points_per_30min, session.duration_min, session.training_name, session.training_type); }}
                    onCancel={() => { void cancelParticipation(session.id, todayDate); }}
                  />
                ))}
              </View>
            )}
            <WeeklyVolumeCard refetchTrigger={focusTrigger} compact />
          </View>

          {activeTab === 'workouts' ? (
            <>
              <WorkoutCategoryRows disciplines={profile?.disciplines ?? []} />
              <Text style={styles.extraHeader}>Zusatztraining</Text>
              <ExtraTab />
            </>
          ) : (
            <StundenplanSection
              studioSchedule={fullSchedule}
              studioLoading={scheduleLoading}
              todayDow={todayDow}
              hasStudio={profile?.studio_id !== null && profile?.studio_id !== undefined}
            />
          )}
          <View style={styles.bottomPad} />
        </ScrollView>

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  container: {
    flex: 1,
  },
  header: {
    marginBottom: 16,
  },
  todayList: {
    paddingHorizontal: 16,
    gap: 8,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  tabPill: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabPillActive: {
    backgroundColor: colors.accentBlue,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },
  tabLabelActive: {
    color: colors.headerTextPrimary,
  },

  // Scroll area
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },

  // Extras section header
  extraHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 32,
    marginBottom: 8,
    paddingHorizontal: 16,
  },

  bottomPad: {
    height: 32,
  },

  // Today card
  todayCard: {
    marginHorizontal: 16,
    backgroundColor: colors.headerCard,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.headerBorder,
  },
  todayCardInfo: {
    flex: 1,
    gap: 4,
  },
  todayCardName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  todayCardMeta: {
    fontSize: 12,
    color: colors.headerTextSecondary,
    fontWeight: '400',
  },
  freeTrainingLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  participateBtn: {
    borderWidth: 1,
    borderColor: colors.headerBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  participateBtnActive: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  participateBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },
  participateBtnTextActive: {
    color: colors.headerTextPrimary,
  },
});
