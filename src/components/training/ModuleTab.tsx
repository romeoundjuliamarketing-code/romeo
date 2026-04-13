import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import type { RootStackParamList } from '../../navigation/types';
import type { Workout } from '../../data/workouts';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Workout'>;

type Props = {
  workouts: Workout[];
};

function formatCategory(category: Workout['category']): string {
  switch (category) {
    case 'schlagkraft':
      return 'Schlagkraft';
    case 'trittkraft':
      return 'Trittkraft';
    case 'ausdauer':
      return 'Ausdauer';
    case 'schulter':
      return 'Schulter';
    case 'beinarbeit':
      return 'Beinarbeit';
    case 'koordination':
      return 'Koordination';
    case 'mobilitaet':
      return 'Mobilitaet';
  }
}

function getDifficultyLabel(value: Workout['difficulty']): string {
  switch (value) {
    case 'leicht':
      return 'Leicht';
    case 'mittel':
      return 'Mittel';
    case 'schwer':
      return 'Schwer';
  }
}

export default function ModuleTab({ workouts }: Props) {
  const navigation = useNavigation<NavigationProp>();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {workouts.map((workout) => (
        <TouchableOpacity
          key={workout.id}
          style={styles.card}
          onPress={() =>
            navigation.navigate('Workout', {
              title: workout.title,
              subtitle: workout.subtitle,
              category: workout.category,
              exercises: workout.exercises,
              duration: `${workout.durationMin} Min`,
              difficulty: workout.difficulty,
              equipment: workout.equipment,
              pointsPer30Min: workout.pointsPerUnit,
              earnedPoints: workout.maxPoints ?? Math.floor(workout.durationMin / 30) * workout.pointsPerUnit,
            })
          }
          activeOpacity={0.7}
        >
          <View style={styles.cardBody}>
            <Text style={styles.cardCategory}>{formatCategory(workout.category)}</Text>
            <Text style={styles.cardTitle}>{workout.title}</Text>
            <Text style={styles.cardSubtitle}>{workout.subtitle}</Text>
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="clock-outline" size={13} color={colors.inactive} />
              <Text style={styles.metaText}>{workout.durationMin} Min</Text>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.metaText}>{getDifficultyLabel(workout.difficulty)}</Text>
            </View>
            <Text style={styles.pointsLabel}>
              {workout.maxPoints !== undefined
                ? `max. ${workout.maxPoints} Pts`
                : `${workout.pointsPerUnit} Pts / 30 Min`}
            </Text>
          </View>
          <View style={styles.arrowWrap}>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.inactive} />
          </View>
        </TouchableOpacity>
      ))}

      {workouts.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Keine Workouts in dieser Kategorie gefunden.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingRight: 16,
    paddingLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: colors.accentBlue,
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
  cardBody: {
    flex: 1,
  },
  cardCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accentBlue,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.inactive,
    marginBottom: 8,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.inactive,
    fontWeight: '500',
  },
  metaDot: {
    fontSize: 12,
    color: colors.inactive,
    lineHeight: 12,
  },
  pointsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accentBlue,
    marginTop: 4,
  },
  arrowWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    marginTop: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyStateText: {
    color: colors.inactive,
    fontSize: 14,
    fontWeight: '500',
  },
});
