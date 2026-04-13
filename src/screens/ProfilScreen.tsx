import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import TrainingDonutCard from '../components/profil/TrainingDonutCard';
import TeamPickerCard from '../components/profil/TeamPickerCard';
import { useWorkoutStats } from '../hooks/useWorkoutStats';
import { useStudio } from '../hooks/useStudio';

// ─── Static data ──────────────────────────────────────────────────────────────

const USER = {
  name: 'Romeo Georgiadis',
  initials: 'RG',
  memberSince: 'Mitglied seit Januar 2024',
};

type StatIcon = 'fire' | 'star' | 'dumbbell' | 'trophy';

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfilScreen() {
  const [focusTrigger, setFocusTrigger] = useState(0);

  useFocusEffect(useCallback(() => {
    setFocusTrigger((n) => n + 1);
  }, []));

  const { totalPoints, totalWorkouts, streak } = useWorkoutStats(focusTrigger);
  const { currentStudio, joinStudio, searchStudios } = useStudio(focusTrigger);

  const STATS: { label: string; value: string; unit: string; icon: StatIcon }[] = [
    { label: 'Streak',   value: String(streak),        unit: 'Tage',   icon: 'fire'     },
    { label: 'Punkte',   value: String(totalPoints),   unit: 'XP',     icon: 'star'     },
    { label: 'Workouts', value: String(totalWorkouts), unit: 'gesamt', icon: 'dumbbell' },
    { label: 'Rang',     value: '#3',                  unit: 'Gruppe', icon: 'trophy'   },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile header ── */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{USER.initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{USER.name}</Text>
            {currentStudio !== null && (
              <Text style={styles.profileMeta}>{currentStudio.name}, {currentStudio.city}</Text>
            )}
            <Text style={styles.profileMeta}>{USER.memberSince}</Text>
          </View>
        </View>

        {/* ── Stats grid ── */}
        <View style={styles.statsGrid}>
          {STATS.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <MaterialCommunityIcons
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

        {/* ── Team / Studio ── */}
        <TeamPickerCard
          currentStudio={currentStudio}
          onJoin={joinStudio}
          onSearch={searchStudios}
        />

        {/* ── Training distribution donut ── */}
        <TrainingDonutCard />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_RADIUS = 16;

const cardShadow = Platform.select({
  ios: {
    shadowColor: colors.headerBg,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },

  // Profile header card
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
    ...cardShadow,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.accentBlue,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  profileMeta: {
    fontSize: 13,
    color: colors.inactive,
    fontWeight: '400',
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: 16,
    width: '47.5%',
    ...cardShadow,
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
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});
