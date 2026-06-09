import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import PaywallCard from '../common/PaywallCard';

type StatIcon = 'fire' | 'star' | 'dumbbell' | 'trophy';

interface StatsTabProps {
  totalPoints: number;
  streak: number;
  totalWorkouts: number;
  rank: number | null;
  hasAccess: boolean;
  currentWeight: number | null;
  isNewWeek: boolean;
  onPressPoints: () => void;
  onPressStreak: () => void;
  onPressWorkouts: () => void;
  onPressWeightLog: () => void;
  onPressWeightHistory: () => void;
  onPressPaywall: () => void;
}

const STATS: { key: 'punkte' | 'streak' | 'workouts' | 'rang'; label: string; unit: string; icon: StatIcon }[] = [
  { key: 'streak',   label: 'Streak',   unit: 'Tage',   icon: 'fire'     },
  { key: 'punkte',   label: 'Punkte',   unit: 'XP',     icon: 'star'     },
  { key: 'workouts', label: 'Workouts', unit: 'gesamt', icon: 'dumbbell' },
  { key: 'rang',     label: 'Rang',     unit: 'Gruppe', icon: 'trophy'   },
];

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#0A0A0A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

export default function StatsTab({
  totalPoints,
  streak,
  totalWorkouts,
  rank,
  hasAccess,
  currentWeight,
  isNewWeek,
  onPressPoints,
  onPressStreak,
  onPressWorkouts,
  onPressWeightLog,
  onPressWeightHistory,
  onPressPaywall,
}: StatsTabProps): React.ReactElement {
  const statValues: Record<string, string> = {
    streak:   String(streak),
    punkte:   String(totalPoints),
    workouts: String(totalWorkouts),
    rang:     rank !== null ? `#${rank}` : '–',
  };

  if (!hasAccess) {
    return (
      <View style={styles.container}>
        <PaywallCard
          title="Stats & Punkte im Abo"
          message="Punkte, Rang und detaillierte Auswertungen sind nur mit einem aktiven Abo verfügbar."
          onPressCta={onPressPaywall}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats grid */}
      <View style={styles.statsGrid}>
        {STATS.map((stat) => {
          const isTappable = stat.key === 'punkte' || stat.key === 'streak' || stat.key === 'workouts';
          const onPress =
            stat.key === 'punkte'   ? onPressPoints
            : stat.key === 'streak'   ? onPressStreak
            : stat.key === 'workouts' ? onPressWorkouts
            : undefined;

          const cardContent = (
            <>
              <MaterialCommunityIcons
                name={stat.icon}
                size={22}
                color={colors.accentBlue}
                style={styles.statIcon}
              />
              <Text style={styles.statValue}>{statValues[stat.key]}</Text>
              <Text style={styles.statUnit}>{stat.unit}</Text>
              <View style={styles.statLabelRow}>
                <Text style={styles.statLabel}>{stat.label}</Text>
                {isTappable && (
                  <MaterialCommunityIcons name="chevron-right" size={14} color={colors.inactive} />
                )}
              </View>
            </>
          );

          if (isTappable && onPress !== undefined) {
            return (
              <TouchableOpacity
                key={stat.key}
                style={styles.statCard}
                onPress={onPress}
                activeOpacity={0.7}
              >
                {cardContent}
              </TouchableOpacity>
            );
          }
          return (
            <View key={stat.key} style={styles.statCard}>
              {cardContent}
            </View>
          );
        })}
      </View>

      {/* Weekly tracking section */}
      <View style={styles.trackingCard}>
        <Text style={styles.trackingSectionTitle}>Wochen-Tracking</Text>

        {/* Weekly body weight */}
        <TouchableOpacity
          style={[styles.trackingRow, isNewWeek && styles.trackingRowHighlight]}
          onPress={onPressWeightLog}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="scale-bathroom"
            size={20}
            color={isNewWeek ? colors.accentBlue : colors.inactive}
          />
          <View style={styles.trackingInfo}>
            <Text style={[styles.trackingLabel, isNewWeek && styles.trackingLabelHighlight]}>
              Gewicht
            </Text>
            {isNewWeek && (
              <Text style={styles.trackingHint}>Neuer Eintrag fällig</Text>
            )}
          </View>
          <Text style={[styles.trackingValue, currentWeight === null && styles.trackingValueEmpty]}>
            {currentWeight !== null ? `${currentWeight} kg` : 'Eintragen'}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.inactive} />
        </TouchableOpacity>

        {/* Weight history */}
        <TouchableOpacity
          style={styles.trackingRow}
          onPress={onPressWeightHistory}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="chart-line" size={20} color={colors.inactive} />
          <View style={styles.trackingInfo}>
            <Text style={styles.trackingLabel}>Gewichtsverlauf</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.inactive} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingBottom: 32,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    width: '48.5%',
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
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  // Tracking card
  trackingCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    ...cardShadow,
  },
  trackingSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  trackingRowHighlight: {
    backgroundColor: colors.accentBlueSoft,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderTopWidth: 0,
  },
  trackingInfo: {
    flex: 1,
    gap: 2,
  },
  trackingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  trackingLabelHighlight: {
    color: colors.accentBlue,
  },
  trackingHint: {
    fontSize: 11,
    color: colors.accentBlue,
    fontWeight: '500',
  },
  trackingValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  trackingValueEmpty: {
    color: colors.accentBlue,
    fontWeight: '600',
  },
});
