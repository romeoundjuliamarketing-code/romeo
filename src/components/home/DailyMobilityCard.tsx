import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

type Props = {
  isDone: boolean;
  isUrgent: boolean;
  onConfirm: () => void;
};

export default function DailyMobilityCard({ isDone, isUrgent, onConfirm }: Props): React.ReactElement {
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
  honesty: {
    fontSize: 11,
    color: colors.headerTextSecondary,
    fontWeight: '400',
    fontStyle: 'italic',
  },
});
