import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ALL_DISCIPLINES } from '../../data/disciplines';
import type { Discipline } from '../../data/disciplines';

interface Props {
  selected: string[];
  saving: boolean;
  onToggle: (discipline: Discipline) => void;
  /** When true, renders without the card wrapper (for embedding inside another card) */
  inline?: boolean;
}

export default function DisciplinePickerCard({ selected, saving, onToggle, inline = false }: Props) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const unselected = ALL_DISCIPLINES.filter((d) => !selected.includes(d));

  const content = (
    <>
      <View style={styles.row}>
        {/* Selected discipline chips */}
        {selected.map((d) => (
          <TouchableOpacity
            key={d}
            style={styles.chip}
            onPress={() => onToggle(d as Discipline)}
            activeOpacity={0.75}
            disabled={saving}
          >
            <Text style={styles.chipLabel}>{d}</Text>
            <MaterialCommunityIcons name="close" size={13} color="#FFFFFF" style={styles.chipClose} />
          </TouchableOpacity>
        ))}

        {/* Add button — only shown when unselected disciplines exist */}
        {unselected.length > 0 && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setPickerVisible(true)}
            activeOpacity={0.75}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.accentBlue} />
            ) : (
              <MaterialCommunityIcons name="plus" size={18} color={colors.accentBlue} />
            )}
          </TouchableOpacity>
        )}

        {/* Empty state hint */}
        {selected.length === 0 && !saving && (
          <Text style={styles.emptyHint}>Disziplin hinzufügen</Text>
        )}
      </View>

      {/* Picker modal */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setPickerVisible(false)}
        >
          <View style={styles.picker}>
            {unselected.map((d) => (
              <TouchableOpacity
                key={d}
                style={styles.pickerItem}
                onPress={() => {
                  onToggle(d as Discipline);
                  setPickerVisible(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.pickerItemLabel}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );

  if (inline) return content;

  return <View style={styles.card}>{content}</View>;
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...cardShadow,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentBlue,
    borderRadius: 20,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 10,
    gap: 4,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  chipClose: {
    opacity: 0.8,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: colors.accentBlueMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHint: {
    fontSize: 13,
    color: colors.inactive,
    fontWeight: '400',
  },

  // Picker modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  picker: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
  },
  pickerItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
});
