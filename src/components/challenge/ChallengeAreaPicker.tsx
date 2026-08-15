import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { CHALLENGE_AREAS, challengesForArea } from '../../data/sparringChallenges';
import type { ChallengeArea } from '../../data/sparringChallenges';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import ChallengeHeader from './ChallengeHeader';

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
              <Text style={styles.rowLabel}>
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
      <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
        <ChallengeHeader
          title="Disziplin"
          icon="close"
          iconLabel="Schliessen"
          onPress={onClose}
        />
        <AreaPickerContent current={current} onSelect={onSelect} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalSafe: {
    flex: 1,
    backgroundColor: colors.dark,
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
  rowCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },
  rowCountActive: {
    color: colors.headerTextPrimary,
  },
});
