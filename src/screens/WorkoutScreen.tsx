import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Workout'>;

function getCategoryLabel(category: Props['route']['params']['category']): string {
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

function getDifficultyLabel(difficulty?: Props['route']['params']['difficulty']): string {
  switch (difficulty) {
    case 'leicht':
      return 'Leicht';
    case 'mittel':
      return 'Mittel';
    case 'schwer':
      return 'Schwer';
    default:
      return 'Offen';
  }
}

export default function WorkoutScreen({ route, navigation }: Props) {
  const { title, subtitle, category, exercises, duration, difficulty, equipment, pointsPer30Min, earnedPoints } = route.params;

  function handleStartTraining() {
    navigation.navigate('Timer', { workoutTitle: title, exercises, earnedPoints, category });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonLabel}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.category}>{getCategoryLabel(category)}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.meta}>{(duration ?? 'Dauer offen') + ' • ' + getDifficultyLabel(difficulty)}</Text>

        {(equipment?.length ?? 0) > 0 && (
          <Text style={styles.equipment}>Equipment: {equipment?.join(', ')}</Text>
        )}
        {typeof pointsPer30Min === 'number' && (
          <Text style={styles.points}>Punkte pro 30 Min: {pointsPer30Min}</Text>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {exercises.map((exercise, index) => (
          <View key={`${exercise.name}-${index}`} style={styles.card}>
            <Text style={styles.exerciseName}>{exercise.name}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaTag}>
                <Text style={styles.metaTagText}>Belastung: {exercise.duration}</Text>
              </View>
              <View style={styles.metaTag}>
                <Text style={styles.metaTagText}>Pause: {exercise.pause}</Text>
              </View>
            </View>

            {exercise.description ? <Text style={styles.description}>{exercise.description}</Text> : null}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.startButton} onPress={handleStartTraining} activeOpacity={0.8}>
          <Text style={styles.startButtonLabel}>Training starten</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.dark,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.headerCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  backButtonLabel: {
    color: colors.headerTextPrimary,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '600',
    marginTop: -1,
  },
  category: {
    color: colors.accentBlue,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: colors.headerTextPrimary,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.headerTextSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    fontWeight: '500',
  },
  meta: {
    color: colors.headerTextSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  equipment: {
    marginTop: 8,
    color: colors.headerTextSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  points: {
    marginTop: 4,
    color: colors.headerTextSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  exerciseName: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  metaTag: {
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaTagText: {
    color: colors.accentBlue,
    fontSize: 11,
    fontWeight: '600',
  },
  description: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  startButton: {
    backgroundColor: colors.dark,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonLabel: {
    color: colors.headerTextPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
