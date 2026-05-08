import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { CreateCustomWorkoutPayload } from '../../hooks/useCustomWorkouts';
import type { CustomExercise } from '../../types/database.types';

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'schlagkraft',  label: 'Schlagkraft' },
  { key: 'trittkraft',   label: 'Trittkraft' },
  { key: 'ausdauer',     label: 'Ausdauer' },
  { key: 'schulter',     label: 'Schulter' },
  { key: 'nackenhals',   label: 'Nacken & Hals' },
  { key: 'griffkraft',   label: 'Griffkraft' },
  { key: 'beinarbeit',   label: 'Beinarbeit' },
  { key: 'koordination', label: 'Koordination' },
  { key: 'mobilitaet',   label: 'Mobilität' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (payload: CreateCustomWorkoutPayload) => void;
}

function newExercise(): CustomExercise & { id: string } {
  return { id: String(Date.now()), name: '', duration: '60s', pause: '30s' };
}

export default function CustomWorkoutSheet({ visible, onClose, onSave }: Props): React.ReactElement {
  const [title, setTitle] = useState('');
  const [trainingType, setTrainingType] = useState('ausdauer');
  const [rounds, setRounds] = useState(3);
  const [durationMin, setDurationMin] = useState(30);
  const [exercises, setExercises] = useState<(CustomExercise & { id: string })[]>([newExercise()]);

  function handleClose(): void {
    setTitle('');
    setTrainingType('ausdauer');
    setRounds(3);
    setDurationMin(30);
    setExercises([newExercise()]);
    onClose();
  }

  function handleSave(): void {
    const validExercises = exercises.filter((e) => e.name.trim().length > 0);
    onSave({
      title: title.trim().length > 0 ? title.trim() : 'Mein Workout',
      training_type: trainingType,
      rounds,
      duration_min: durationMin,
      exercises: validExercises.map(({ name, duration, pause }) => ({ name, duration, pause })),
    });
    handleClose();
  }

  function addExercise(): void {
    setExercises((prev) => [...prev, newExercise()]);
  }

  function removeExercise(id: string): void {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  }

  function updateExercise(id: string, field: keyof CustomExercise, value: string): void {
    setExercises((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e));
  }

  const canSave = exercises.some((e) => e.name.trim().length > 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
            <Text style={styles.headerCancel}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Neues Workout</Text>
          <TouchableOpacity onPress={handleSave} disabled={!canSave} activeOpacity={0.7}>
            <Text style={[styles.headerSave, !canSave && styles.headerSaveDisabled]}>Speichern</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Title */}
          <Text style={styles.sectionLabel}>Workout-Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Mein Workout"
            placeholderTextColor={colors.inactive}
            value={title}
            onChangeText={setTitle}
            returnKeyType="done"
          />

          {/* Category */}
          <Text style={styles.sectionLabel}>Bereich</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[styles.chip, trainingType === c.key && styles.chipActive]}
                onPress={() => setTrainingType(c.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, trainingType === c.key && styles.chipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Rounds + Duration */}
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.sectionLabel}>Runden</Text>
              <View style={styles.stepper}>
                <TouchableOpacity onPress={() => setRounds((r) => Math.max(1, r - 1))} activeOpacity={0.7} style={styles.stepBtn}>
                  <Ionicons name="remove" size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.stepValue}>{rounds}</Text>
                <TouchableOpacity onPress={() => setRounds((r) => Math.min(20, r + 1))} activeOpacity={0.7} style={styles.stepBtn}>
                  <Ionicons name="add" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.halfField}>
              <Text style={styles.sectionLabel}>Dauer (Min.)</Text>
              <View style={styles.stepper}>
                <TouchableOpacity onPress={() => setDurationMin((d) => Math.max(5, d - 5))} activeOpacity={0.7} style={styles.stepBtn}>
                  <Ionicons name="remove" size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.stepValue}>{durationMin}</Text>
                <TouchableOpacity onPress={() => setDurationMin((d) => Math.min(180, d + 5))} activeOpacity={0.7} style={styles.stepBtn}>
                  <Ionicons name="add" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Exercises */}
          <Text style={styles.sectionLabel}>Übungen</Text>
          {exercises.map((exercise, index) => (
            <View key={exercise.id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseNumber}>{String(index + 1).padStart(2, '0')}</Text>
                {exercises.length > 1 && (
                  <TouchableOpacity onPress={() => removeExercise(exercise.id)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={20} color={colors.inactive} />
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Übungsname"
                placeholderTextColor={colors.inactive}
                value={exercise.name}
                onChangeText={(v) => updateExercise(exercise.id, 'name', v)}
                returnKeyType="done"
              />
              <View style={styles.row}>
                <View style={styles.halfField}>
                  <Text style={styles.fieldHint}>Arbeitszeit</Text>
                  <TextInput
                    style={[styles.input, styles.inputSmall]}
                    placeholder="60s"
                    placeholderTextColor={colors.inactive}
                    value={exercise.duration}
                    onChangeText={(v) => updateExercise(exercise.id, 'duration', v)}
                    returnKeyType="done"
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={styles.fieldHint}>Pause</Text>
                  <TextInput
                    style={[styles.input, styles.inputSmall]}
                    placeholder="30s"
                    placeholderTextColor={colors.inactive}
                    value={exercise.pause}
                    onChangeText={(v) => updateExercise(exercise.id, 'pause', v)}
                    returnKeyType="done"
                  />
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addBtn} onPress={addExercise} activeOpacity={0.7}>
            <Ionicons name="add" size={18} color={colors.accentBlue} />
            <Text style={styles.addBtnLabel}>Übung hinzufügen</Text>
          </TouchableOpacity>

          <View style={styles.bottomPad} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  headerCancel: { fontSize: 15, color: colors.inactive, fontWeight: '500' },
  headerSave: { fontSize: 15, color: colors.accentBlue, fontWeight: '700' },
  headerSaveDisabled: { opacity: 0.35 },

  scroll: { flex: 1 },
  content: { padding: 16, gap: 8 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inactive,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  inputSmall: { padding: 10, fontSize: 14 },

  chips: { gap: 8, paddingVertical: 4 },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.inactive },
  chipTextActive: { color: '#FFFFFF' },

  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  halfField: { flex: 1, gap: 4 },
  fieldHint: { fontSize: 11, color: colors.inactive, fontWeight: '500', marginBottom: 2 },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  stepBtn: { paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  stepValue: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text },

  exerciseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
    marginTop: 8,
  },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exerciseNumber: { fontSize: 13, fontWeight: '700', color: colors.inactive },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
  },
  addBtnLabel: { fontSize: 14, fontWeight: '600', color: colors.accentBlue },

  bottomPad: { height: 48 },
});
