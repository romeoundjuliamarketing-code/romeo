import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useRecommendedWorkout } from '../../hooks/useRecommendedWorkout';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const DIFFICULTY_LABEL: Record<string, string> = {
  leicht: 'Leicht',
  mittel: 'Mittel',
  schwer: 'Schwer',
};

interface Props {
  refetchTrigger?: number;
}

export default function RecommendedWorkoutCard({ refetchTrigger = 0 }: Props) {
  const navigation = useNavigation<Nav>();
  const { recommendation, loading } = useRecommendedWorkout(refetchTrigger);

  if (loading || recommendation === null) return null;

  const { workout, reason } = recommendation;
  const earnedPoints = workout.maxPoints ?? Math.floor(workout.durationMin / 30) * workout.pointsPerUnit;

  function handlePress(): void {
    navigation.navigate('Workout', {
      title:        workout.title,
      subtitle:     workout.subtitle,
      category:     workout.category,
      exercises:    workout.exercises,
      duration:     `${workout.durationMin} Min`,
      difficulty:   workout.difficulty,
      equipment:    workout.equipment,
      pointsPer30Min: workout.pointsPerUnit,
      earnedPoints,
    });
  }

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.85}>
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.badge}>
          <Ionicons name="flash-outline" size={12} color={colors.accentBlue} />
          <Text style={styles.badgeText}>Empfohlen</Text>
        </View>
        <Text style={styles.reason}>{reason}</Text>
      </View>

      {/* Workout info */}
      <Text style={styles.title}>{workout.title}</Text>
      <Text style={styles.subtitle}>{workout.subtitle}</Text>

      {/* Meta row */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={13} color={colors.inactive} />
          <Text style={styles.metaText}>{workout.durationMin} Min</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <Ionicons name="bar-chart-outline" size={13} color={colors.inactive} />
          <Text style={styles.metaText}>{DIFFICULTY_LABEL[workout.difficulty]}</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <Ionicons name="star-outline" size={13} color={colors.inactive} />
          <Text style={styles.metaText}>{earnedPoints} Punkte</Text>
        </View>
      </View>

      {/* CTA */}
      <View style={styles.cta}>
        <Text style={styles.ctaText}>Training starten</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.accentBlue} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentBlue,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  reason: {
    fontSize: 12,
    color: colors.inactive,
    fontWeight: '500',
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.inactive,
    fontWeight: '400',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.inactive,
    fontWeight: '500',
  },
  metaDivider: {
    width: 1,
    height: 10,
    backgroundColor: colors.border,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentBlue,
  },
});
