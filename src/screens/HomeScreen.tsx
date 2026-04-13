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
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import HeroSection from '../components/home/HeroSection';
import RecommendedWorkoutCard from '../components/home/RecommendedWorkoutCard';
import { useWorkoutStats } from '../hooks/useWorkoutStats';

// ─── Types ────────────────────────────────────────────────────────────────────

type StatIcon = 'flame-outline' | 'star-outline' | 'barbell-outline' | 'trophy-outline';

type StatEntry = { label: string; value: string; unit: string; icon: StatIcon };

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [focusTrigger, setFocusTrigger] = useState(0);

  useFocusEffect(useCallback(() => {
    setFocusTrigger((n) => n + 1);
  }, []));

  const { completedDayIndices, totalPoints, totalWorkouts, streak } = useWorkoutStats(focusTrigger);

  const STATS: StatEntry[] = [
    { label: 'Streak',       value: String(streak),          unit: 'Tage',   icon: 'flame-outline'   },
    { label: 'Punkte',       value: String(totalPoints),     unit: 'XP',     icon: 'star-outline'    },
    { label: 'Workouts',     value: String(totalWorkouts),   unit: 'gesamt', icon: 'barbell-outline' },
    { label: 'Gruppenplatz', value: '#3',                    unit: 'Rang',   icon: 'trophy-outline'  },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <HeroSection completedDayIndices={completedDayIndices} streak={streak} />

        {/* ── Stats section (light) ── */}
        <View style={styles.lightSection}>
          <RecommendedWorkoutCard refetchTrigger={focusTrigger} />

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
        </View>
      </ScrollView>
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
  },

  // Light section below the dark hero
  lightSection: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
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
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});
