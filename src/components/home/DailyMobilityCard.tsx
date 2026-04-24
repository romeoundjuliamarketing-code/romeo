import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { MOBILITY_EXERCISES } from '../../data/mobilityWorkout';

type Props = {
  isDone: boolean;
  isUrgent: boolean;
  onConfirm: () => void;
};

export default function DailyMobilityCard({ isDone, isUrgent, onConfirm }: Props): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.card, isUrgent && !isDone && styles.cardUrgent, isDone && styles.cardDone]}>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={[styles.title, isDone && styles.titleDone]}>
            Hüfte & Mobilität
          </Text>
          <Text style={[styles.meta, isUrgent && !isDone && styles.metaUrgent]}>
            {isDone
              ? 'Erledigt · +10 Pts'
              : isUrgent
              ? 'Noch nicht erledigt · 10 Pts'
              : '10 Pts · ca. 14 Min · 12 Übungen'}
          </Text>
        </View>

        {isDone ? (
          <View style={styles.doneIcon}>
            <MaterialCommunityIcons name="check" size={18} color={colors.accentBlue} />
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.button, isUrgent && styles.buttonUrgent]}
            onPress={onConfirm}
            activeOpacity={0.7}
          >
            <Text style={[styles.buttonLabel, isUrgent && styles.buttonLabelUrgent]}>
              Erledigt
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Toggle exercise list */}
      <TouchableOpacity
        style={styles.toggleRow}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.toggleLabel}>
          {expanded ? 'Übungen ausblenden' : 'Übungen anzeigen'}
        </Text>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.headerTextSecondary}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.exerciseList}>
          {MOBILITY_EXERCISES.map((ex, index) => (
            <View key={ex.id} style={styles.exerciseRow}>
              <Text style={styles.exerciseIndex}>{index + 1}.</Text>
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{ex.title}</Text>
                <Text style={styles.exerciseReps}>{ex.reps}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {!isDone && (
        <Text style={styles.honesty}>
          Nur bestätigen, wenn du die Übungen tatsächlich gemacht hast.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  cardUrgent: {
    borderColor: '#E07B5A',
    backgroundColor: 'rgba(224,123,90,0.12)',
  },
  cardDone: {
    borderColor: colors.accentBlue,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  titleDone: {
    color: colors.headerTextSecondary,
  },
  meta: {
    fontSize: 12,
    color: colors.headerTextSecondary,
    fontWeight: '400',
  },
  metaUrgent: {
    color: '#E07B5A',
    fontWeight: '600',
  },
  doneIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    borderWidth: 1.5,
    borderColor: colors.accentBlue,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  buttonUrgent: {
    borderColor: '#E07B5A',
    backgroundColor: 'rgba(224,123,90,0.15)',
  },
  buttonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  buttonLabelUrgent: {
    color: '#E07B5A',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toggleLabel: {
    fontSize: 12,
    color: colors.headerTextSecondary,
    fontWeight: '500',
  },
  exerciseList: {
    gap: 8,
    paddingTop: 4,
  },
  exerciseRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  exerciseIndex: {
    fontSize: 12,
    color: colors.headerTextSecondary,
    fontWeight: '500',
    width: 20,
    paddingTop: 1,
  },
  exerciseInfo: {
    flex: 1,
    gap: 2,
  },
  exerciseName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextPrimary,
  },
  exerciseReps: {
    fontSize: 11,
    color: colors.headerTextSecondary,
    fontWeight: '400',
  },
  honesty: {
    fontSize: 11,
    color: colors.headerTextSecondary,
    fontWeight: '400',
    fontStyle: 'italic',
  },
});
