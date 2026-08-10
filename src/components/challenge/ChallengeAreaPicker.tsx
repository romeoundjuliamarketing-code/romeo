import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CHALLENGE_AREAS, challengesForArea } from '../../data/sparringChallenges';
import type { ChallengeArea } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';

interface Props {
  current:  ChallengeArea;
  onSelect: (area: ChallengeArea) => void;
  onClose?: () => void;
}

// The actual picker markup, shared between the inline (first choice) and the
// modal (re-open via the header button) presentation.
function AreaPickerContent({ current, onSelect }: Omit<Props, 'onClose'>): React.ReactElement {
  return (
    <View style={styles.content}>
      <Text style={styles.title}>Für welche Disziplin willst du Karten?</Text>

      <View style={styles.list}>
        {CHALLENGE_AREAS.map((entry) => {
          const active = entry.key === current;
          const count = challengesForArea(entry.key).length;
          return (
            <TouchableOpacity
              key={entry.key}
              style={[styles.row, active && styles.rowActive]}
              onPress={() => onSelect(entry.key)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>
                {entry.label}
              </Text>
              <Text style={[styles.rowCount, active && styles.rowCountActive]}>
                {count} {count === 1 ? 'Karte' : 'Karten'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// Discipline picker: renders inline for the mandatory first choice, or as a
// dismissible modal when reopened later from the header button.
export default function ChallengeAreaPicker({ current, onSelect, onClose }: Props): React.ReactElement {
  if (onClose === undefined) {
    return <AreaPickerContent current={current} onSelect={onSelect} />;
  }

  return (
    <Modal
      visible
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Schliessen"
          >
            <Ionicons name="close" size={26} color={colors.headerTextPrimary} />
          </TouchableOpacity>
        </View>
        <AreaPickerContent current={current} onSelect={onSelect} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalSafe: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    marginBottom: 24,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.headerTextPrimary,
  },
  list: {
    gap: 16,
  },
  row: {
    minHeight: 44,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    backgroundColor: colors.headerCard,
  },
  rowActive: {
    backgroundColor: colors.accentBlue,
  },
  rowLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  rowLabelActive: {
    color: colors.headerTextPrimary,
  },
  rowCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },
  rowCountActive: {
    color: colors.headerTextPrimary,
  },
});
