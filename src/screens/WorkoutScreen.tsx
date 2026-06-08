import React, { useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Workout'>;

// All workouts follow the same round structure
const ROUNDS = 3;

function getCategoryLabel(category: Props['route']['params']['category']): string {
  const map: Record<string, string> = {
    schlagkraft:  'Schlagkraft',
    trittkraft:   'Trittkraft',
    ausdauer:     'Ausdauer',
    schulter:     'Schulter',
    nackenhals:   'Nacken & Hals',
    griffkraft:   'Griffkraft',
    beinarbeit:   'Beinarbeit',
    koordination: 'Koordination',
    mobilitaet:   'Mobilität',
    bjj:          'BJJ',
    k1:           'K1',
    mma:          'MMA',
    ringen:       'Ringen',
  };
  return map[category] ?? category;
}

function getDifficultyLabel(difficulty?: Props['route']['params']['difficulty']): string {
  const map: Record<string, string> = { leicht: 'Leicht', mittel: 'Mittel', schwer: 'Schwer' };
  return difficulty !== undefined ? (map[difficulty] ?? difficulty) : 'Offen';
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkoutScreen({ route, navigation }: Props) {
  const { user } = useAuth();
  const {
    title, subtitle, category, exercises,
    duration, difficulty, equipment, earnedPoints, trainingType,
  } = route.params;

  const startedAt = useRef<number>(Date.now());
  const [logging, setLogging] = useState(false);
  const [done, setDone] = useState(false);

  // Derive format from first exercise (all exercises share same timing)
  const firstEx = exercises[0];
  const workDuration = firstEx?.duration ?? '60s';
  const workPause    = firstEx?.pause    ?? '30s';

  async function handleComplete(): Promise<void> {
    if (user === null || logging || done) return;
    setLogging(true);

    const today  = todayIso();
    const points = earnedPoints ?? 0;

    const isCustom = category === 'eigene';
    const { error: logErr } = await supabase.from('workout_logs').insert({
      user_id:       user.id,
      date:          today,
      source:        isCustom ? 'custom' : 'module',
      completed:     true,
      points,
      title,
      training_type: isCustom ? (trainingType ?? 'eigene') : category,
      category:      isCustom ? 'Eigene' : 'Spezifisch',
      duration_min:  Math.max(1, Math.round((Date.now() - startedAt.current) / 60000)),
    });

    if (logErr !== null) {
      setLogging(false);
      Alert.alert('Fehler', 'Bitte versuche es erneut.');
      return;
    }

    if (points > 0) {
      const { error: pointsErr } = await supabase.rpc('add_workout_points', {
        p_user_id: user.id,
        p_date:    today,
        p_points:  points,
      });
      if (pointsErr !== null) console.warn('add_workout_points failed', pointsErr.message);
    }

    setLogging(false);
    setDone(true);
    setTimeout(() => navigation.popToTop(), 1500);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* ── Dark header ────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={18} color={colors.headerTextPrimary} />
        </TouchableOpacity>

        <Text style={styles.categoryLabel}>{getCategoryLabel(category)}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle !== undefined && subtitle.length > 0 && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}

        {/* Meta: duration · difficulty · exercise count */}
        <Text style={styles.meta}>
          {duration ?? 'Offen'} · {getDifficultyLabel(difficulty)} · {exercises.length} Übungen
        </Text>

        {/* Format + equipment chips */}
        <View style={styles.chipsRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{ROUNDS} Runden</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{workDuration} / {workPause}</Text>
          </View>
          {(equipment ?? []).map((eq) => (
            <View key={eq} style={[styles.chip, styles.chipEquip]}>
              <Text style={[styles.chipText, styles.chipEquipText]}>{eq}</Text>
            </View>
          ))}
        </View>

        {/* Points badge */}
        {(earnedPoints ?? 0) > 0 && (
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsBadgeText}>+{earnedPoints}p</Text>
          </View>
        )}
      </View>

      {/* ── Exercise list ───────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {exercises.map((exercise, index) => (
          <View key={`${exercise.name}-${index}`} style={styles.card}>
            <Text style={styles.exerciseNumber}>
              {String(index + 1).padStart(2, '0')}
            </Text>
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              {exercise.description !== undefined && exercise.description.length > 0 && (
                <Text style={styles.exerciseDesc}>{exercise.description}</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.completeBtn, done && styles.completeBtnDone]}
          onPress={() => { void handleComplete(); }}
          disabled={done || logging}
          activeOpacity={0.8}
        >
          {logging ? (
            <ActivityIndicator color={colors.headerTextPrimary} />
          ) : (
            <Text style={styles.completeBtnLabel}>
              {done ? 'Gespeichert' : 'Workout absolviert'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    backgroundColor: colors.dark,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.headerCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  categoryLabel: {
    color: colors.accentBlue,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: colors.headerTextPrimary,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
    marginBottom: 4,
  },
  subtitle: {
    color: colors.headerTextSecondary,
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 8,
  },
  meta: {
    color: colors.headerTextSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
  },

  // Chips row
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.headerCard,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    color: colors.headerTextPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  chipEquip: {
    backgroundColor: 'rgba(74,144,217,0.2)',
  },
  chipEquipText: {
    color: colors.accentBlue,
  },

  // Points badge
  pointsBadge: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: colors.accentBlue,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pointsBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Scroll / exercise list
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 10,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  exerciseNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    paddingTop: 2,
    minWidth: 24,
  },
  exerciseInfo: {
    flex: 1,
    gap: 6,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 21,
  },
  exerciseDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Footer
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 32,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  completeBtn: {
    backgroundColor: colors.dark,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnDone: {
    backgroundColor: colors.accentBlue,
  },
  completeBtnLabel: {
    color: colors.headerTextPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
