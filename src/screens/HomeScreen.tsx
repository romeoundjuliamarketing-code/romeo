import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusRefetch } from '../hooks/useFocusRefetch';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import HeroSection from '../components/home/HeroSection';
import type { HeroNetworkPatternHandle } from '../components/home/HeroNetworkPattern';
import WaterBottleCard from '../components/home/WaterBottleCard';
import WeightCheckInModal from '../components/home/WeightCheckInModal';
import PaywallCard from '../components/common/PaywallCard';
import { useWorkoutStats } from '../hooks/useWorkoutStats';
import { useSchedule } from '../hooks/useSchedule';
import { useParticipation } from '../hooks/useParticipation';
import { useDailyStretch } from '../hooks/useDailyStretch';
import { useDailyMobility } from '../hooks/useDailyMobility';
import { useProfile } from '../hooks/useProfile';
import { useAnnouncement } from '../hooks/useAnnouncement';
import { useWaterTracking } from '../hooks/useWaterTracking';
import { useWeight } from '../hooks/useWeight';
import { useNotifications } from '../hooks/useNotifications';
import { useProximitySparringNotifications } from '../hooks/useProximitySparringNotifications';
import { useNotificationFeed } from '../hooks/useNotificationFeed';
import ConfettiOverlay from '../components/ernaehrung/ConfettiOverlay';
import { useEntitlement } from '../hooks/useEntitlement';
import type { RootStackParamList } from '../navigation/types';
import type { StudioSchedule } from '../types/database.types';

const WEIGHT_DISMISSED_KEY = 'weight_checkin_dismissed';
const PREWORKOUT_KEY = 'preworkout_enabled';

// ─── Types ────────────────────────────────────────────────────────────────────

type StatIcon = 'flame-outline' | 'star-outline' | 'barbell-outline' | 'trophy-outline';

type StatEntry = { label: string; value: string; unit: string; icon: StatIcon };

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [focusTrigger,    setFocusTrigger]    = useState(0);
  const [showConfetti,    setShowConfetti]    = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const weightCheckTriggered = useRef(false);
  // Lets the ScrollView pause the hero's breathe animation while scrolling
  const networkPatternRef = useRef<HeroNetworkPatternHandle>(null);

  useFocusRefetch(() => setFocusTrigger((n) => n + 1));

  const { isNewWeek, loading: weightLoading, logWeight } = useWeight(focusTrigger);
  const { profile } = useProfile(focusTrigger);
  const { announcement, deleteAnnouncement } = useAnnouncement(focusTrigger);
  const { entitlement } = useEntitlement(focusTrigger);
  const { completedDayIndices, totalPoints, totalWorkouts, streak, rank, refetch: refetchStats } = useWorkoutStats(focusTrigger);
  // JS getDay(): 0=Sun … 6=Sat → 0=Mon … 6=Sun
  const todayDow = (new Date().getDay() + 6) % 7;
  const { schedule } = useSchedule(todayDow, profile?.studio_id ?? null);
  const { scheduleTrainingReminders } = useNotifications();
  useProximitySparringNotifications();
  const { unreadCount: unreadNotificationCount } = useNotificationFeed(focusTrigger);
  const { isParticipating, participate, cancelParticipation } = useParticipation();
  const { isDone: stretchDone, isUrgent: stretchUrgent, logStretch } = useDailyStretch();
  const { isDone: mobilityDone, isUrgent: mobilityUrgent, logMobility } = useDailyMobility();
  // Show weight check-in modal on Mondays when no entry exists for this week
  useEffect(() => {
    if (weightLoading) return;
    if (!isNewWeek) return;
    if (todayDow !== 0) return; // only on Mondays (0 = Mon in remapped week)
    if (weightCheckTriggered.current) return;

    async function maybeShow(): Promise<void> {
      const dismissed = await AsyncStorage.getItem(WEIGHT_DISMISSED_KEY);
      const todayIso = new Date().toISOString().split('T')[0];
      if (dismissed === todayIso) return;
      weightCheckTriggered.current = true;
      setTimeout(() => setShowWeightModal(true), 600);
    }

    void maybeShow();
  }, [weightLoading, isNewWeek]);

  useEffect(() => {
    if (schedule.length > 0) {
      void (async () => {
        const stored = await AsyncStorage.getItem(PREWORKOUT_KEY);
        await scheduleTrainingReminders(schedule, stored === 'true');
      })();
    }
  }, [schedule, scheduleTrainingReminders]);

  async function handleWeightSubmit(kg: number): Promise<void> {
    setShowWeightModal(false);
    await logWeight(kg);
  }

  async function handleWeightLater(): Promise<void> {
    setShowWeightModal(false);
    const todayIso = new Date().toISOString().split('T')[0];
    await AsyncStorage.setItem(WEIGHT_DISMISSED_KEY, todayIso);
  }

  const { amountMl, goalMl, hydrationMode, setHydrationMode, addWater, loading: waterLoading } = useWaterTracking(
    () => setShowConfetti(true),
    focusTrigger,
  );

  const todaySessionDate = new Date().toISOString().split('T')[0];

  async function handleSessionParticipate(session: StudioSchedule): Promise<void> {
    await participate(
      session.id,
      todaySessionDate,
      session.points_per_30min,
      session.duration_min,
      session.training_name,
      session.training_type,
    );
    refetchStats();
    // Re-schedule notifications so only confirmed sessions get reminders
    const stored = await AsyncStorage.getItem(PREWORKOUT_KEY);
    await scheduleTrainingReminders(schedule, stored === 'true');
  }

  async function handleSessionCancel(session: StudioSchedule): Promise<void> {
    await cancelParticipation(session.id, todaySessionDate);
    refetchStats();
    // Remove reminders for the cancelled session
    const stored = await AsyncStorage.getItem(PREWORKOUT_KEY);
    await scheduleTrainingReminders(schedule, stored === 'true');
  }

  const STATS: StatEntry[] = [
    { label: 'Streak',       value: String(streak),          unit: 'Tage',   icon: 'flame-outline'   },
    { label: 'Punkte',       value: String(totalPoints),     unit: 'XP',     icon: 'star-outline'    },
    { label: 'Workouts',     value: String(totalWorkouts),   unit: 'gesamt', icon: 'barbell-outline' },
    { label: 'Gruppenplatz', value: rank !== null ? `#${rank}` : '–', unit: 'Rang', icon: 'trophy-outline' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={() => networkPatternRef.current?.notifyScroll()}
      >
        <View style={styles.content}>
        <HeroSection
          networkPatternRef={networkPatternRef}
          name={profile?.name ?? null}
          announcement={announcement}
          isCoach={profile?.is_coach ?? false}
          onDeleteAnnouncement={() => { void deleteAnnouncement(); }}
          completedDayIndices={completedDayIndices}
          streak={streak}
          todaySessions={schedule}
          isSessionParticipating={isParticipating}
          onSessionParticipate={(s) => { void handleSessionParticipate(s); }}
          onSessionCancel={(s) => { void handleSessionCancel(s); }}
          stretchDone={stretchDone}
          stretchUrgent={stretchUrgent}
          onStretch={() => { void logStretch().then(refetchStats); }}
          mobilityDone={mobilityDone}
          mobilityUrgent={mobilityUrgent}
          onMobility={() => { void logMobility().then(refetchStats); }}
          onNotificationsPress={() => { navigation.navigate('Notifications'); }}
          unreadNotificationCount={unreadNotificationCount}
        />

        {/* ── Stats section (light) ── */}
        <View style={styles.lightSection}>
          <View style={styles.waterCardWrap}>
            <WaterBottleCard
              amountMl={amountMl}
              goalMl={goalMl}
              hydrationMode={hydrationMode}
              onHydrationModeChange={(mode) => { void setHydrationMode(mode); }}
              loading={waterLoading}
              onAdd250={() => { void addWater(250); }}
              onAdd500={() => { void addWater(500); }}
              focusTrigger={focusTrigger}
            />
          </View>

          {entitlement.hasAccess ? (
            <>
              <Text style={styles.sectionTitle}>Deine Stats</Text>
              <View style={styles.statsGrid}>
                {STATS.map((stat) => (
                  <View key={stat.label} style={styles.statCard}>
                    <Ionicons
                      name={stat.icon}
                      size={22}
                      color={colors.accentBlue}
                      style={styles.statIcon}
                    />
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statUnit}>{stat.unit}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <PaywallCard
              title="Punkte & Stats im Abo"
              message="Punkte, Rang und Leistungs-Statistiken sind nur mit einem aktiven Abo verfügbar."
              onPressCta={() => navigation.navigate('Paywall')}
            />
          )}

        </View>
        </View>
      </ScrollView>

      <WeightCheckInModal
        visible={showWeightModal}
        onSubmit={(kg) => { void handleWeightSubmit(kg); }}
        onLater={() => { void handleWeightLater(); }}
      />

      <ConfettiOverlay
        visible={showConfetti}
        onComplete={() => setShowConfetti(false)}
      />
    </SafeAreaView>
  );
}


// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_RADIUS = 16;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.headerBg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },

  // Light section below the dark hero
  lightSection: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
    marginBottom: 16,
  },
  waterCardWrap: {
    marginBottom: 24,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: colors.card,
    borderRadius: CARD_RADIUS,
    padding: 16,
    width: '47.5%',
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.headerBg,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  statIcon: {
    marginBottom: 8,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  statUnit: {
    fontSize: 11,
    color: colors.inactive,
    fontWeight: '500',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});
