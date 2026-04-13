import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Timer'>;
type Phase = 'work' | 'rest' | 'done';

const WORK_SECONDS = 3 * 60;
const REST_SECONDS = 60;
const TOTAL_ROUNDS = 3;

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60).toString().padStart(2, '0');
  const seconds = (total % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export default function TimerScreen({ route, navigation }: Props) {
  const { exercises, workoutTitle, earnedPoints = 0, category } = route.params;
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>('work');
  const [round, setRound] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(WORK_SECONDS);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const savedRef = useRef(false);

  const currentExercise = useMemo(
    () => exercises[exerciseIndex] ?? null,
    [exerciseIndex, exercises]
  );

  useEffect(() => {
    if (phase === 'done') return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;
        if (phase === 'work') {
          if (round >= TOTAL_ROUNDS) {
            setPhase('done');
            return 0;
          }
          setPhase('rest');
          return REST_SECONDS;
        }
        setPhase('work');
        setRound((r) => r + 1);
        return WORK_SECONDS;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, round]);

  // Save workout log when training completes
  useEffect(() => {
    if (phase !== 'done' || savedRef.current || user === null) return;
    savedRef.current = true;

    supabase
      .rpc('add_workout_points', { p_user_id: user.id, p_date: todayIso(), p_points: earnedPoints })
      .then(({ error }) => {
        if (error !== null) setSaveError(true);
      });

    // Log category for recommendation engine
    if (category !== undefined) {
      supabase
        .from('training_category_log')
        .insert({ user_id: user.id, category })
        .then(() => undefined);
    }
  }, [phase, user, earnedPoints, category]);

  function handleNextExercise() {
    if (exercises.length === 0) return;
    setExerciseIndex((prev) => (prev + 1) % exercises.length);
  }

  function getPhaseLabel(): string {
    if (phase === 'work') return 'Runde laeuft';
    if (phase === 'rest') return 'Pause';
    return 'Training beendet';
  }

  if (phase === 'done') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.doneContainer}>
          <Text style={styles.doneTitle}>Geschafft!</Text>
          <Text style={styles.doneWorkout}>{workoutTitle}</Text>
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsBadgeValue}>+{earnedPoints}</Text>
            <Text style={styles.pointsBadgeLabel}>Punkte verdient</Text>
          </View>
          {saveError && (
            <Text style={styles.saveErrorText}>Punkte konnten nicht gespeichert werden.</Text>
          )}
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.popToTop()}
            activeOpacity={0.8}
          >
            <Text style={styles.doneButtonLabel}>Zurueck zur Uebersicht</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backButton}>
          <Text style={styles.backLabel}>Zurueck</Text>
        </TouchableOpacity>
        <Text style={styles.workoutTitle}>{workoutTitle}</Text>
        <Text style={styles.roundLabel}>Runde {Math.min(round, TOTAL_ROUNDS)} / {TOTAL_ROUNDS}</Text>
      </View>

      <View style={styles.timerBlock}>
        <Text style={styles.phaseLabel}>{getPhaseLabel()}</Text>
        <Text style={styles.timerValue}>{formatSeconds(secondsLeft)}</Text>
      </View>

      <View style={styles.exerciseCard}>
        <Text style={styles.sectionTitle}>Aktuelle Uebung</Text>
        <Text style={styles.exerciseName}>{currentExercise?.name ?? 'Keine Uebung vorhanden'}</Text>
        <Text style={styles.exerciseMeta}>
          {currentExercise ? `Belastung: ${currentExercise.duration} • Pause: ${currentExercise.pause}` : 'Bitte Trainingsdaten pruefen'}
        </Text>
        {currentExercise?.description ? <Text style={styles.exerciseDescription}>{currentExercise.description}</Text> : null}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNextExercise}
          disabled={exercises.length === 0}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonLabel}>Weiter</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    backgroundColor: colors.card,
  },
  backLabel: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  workoutTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    marginBottom: 4,
  },
  roundLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  timerBlock: {
    backgroundColor: colors.dark,
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 14,
  },
  phaseLabel: {
    color: colors.headerTextSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  timerValue: {
    color: colors.headerTextPrimary,
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: 1,
    lineHeight: 64,
  },
  exerciseCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  sectionTitle: {
    color: colors.accentBlue,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  exerciseName: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  exerciseMeta: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseDescription: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: 24,
  },
  nextButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonLabel: {
    color: colors.headerTextPrimary,
    fontSize: 16,
    fontWeight: '700',
  },

  // Done screen
  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  doneTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
    marginBottom: 8,
  },
  doneWorkout: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 40,
    textAlign: 'center',
  },
  pointsBadge: {
    backgroundColor: colors.dark,
    borderRadius: 20,
    paddingHorizontal: 40,
    paddingVertical: 24,
    alignItems: 'center',
    marginBottom: 40,
  },
  pointsBadgeValue: {
    fontSize: 52,
    fontWeight: '800',
    color: colors.accentBlue,
    letterSpacing: -2,
    lineHeight: 60,
  },
  pointsBadgeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextSecondary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  saveErrorText: {
    fontSize: 13,
    color: '#C0392B',
    marginBottom: 16,
    textAlign: 'center',
  },
  doneButton: {
    backgroundColor: colors.dark,
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonLabel: {
    color: colors.headerTextPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
