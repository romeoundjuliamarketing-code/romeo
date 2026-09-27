import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';

// Same list as before (stored verbatim in profiles.weight_class) — no automatic
// assignment from the weight.
export const WEIGHT_CLASSES = [
  'Strawweight',
  'Flyweight',
  'Bantamweight',
  'Featherweight',
  'Lightweight',
  'Welterweight',
  'Middleweight',
  'Light Heavyweight',
  'Heavyweight',
  'Super Heavyweight',
] as const;

export default function WeightClassSelect({ value, onChange }: {
  value:    string;
  onChange: (next: string) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.group}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Gewichtsklasse</Text>
        <Text style={styles.optional}>optional</Text>
      </View>
      <TouchableOpacity
        style={[styles.box, open && styles.boxOpen]}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Gewichtsklasse${value.length > 0 ? `: ${value}` : ', nicht gewählt'}`}
      >
        <Text style={[styles.value, value.length === 0 && styles.placeholder]} numberOfLines={1}>
          {value.length > 0 ? value : 'Wählen'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </TouchableOpacity>
      {open && (
        <View style={styles.list}>
          {value.length > 0 && (
            <TouchableOpacity style={styles.item} onPress={() => { onChange(''); setOpen(false); }} accessibilityRole="button">
              <Text style={styles.itemMuted}>Keine Angabe</Text>
            </TouchableOpacity>
          )}
          {WEIGHT_CLASSES.map((wc) => {
            const selected = value === wc;
            return (
              <TouchableOpacity
                key={wc}
                style={[styles.item, selected && styles.itemActive]}
                onPress={() => { onChange(wc); setOpen(false); }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.itemText, selected && styles.itemTextActive]}>{wc}</Text>
                {selected && <Ionicons name="checkmark" size={18} color={colors.accentBlue} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           8,
  },
  label: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.text,
  },
  optional: {
    fontSize: 13,
    color:    colors.textMuted,
  },
  box: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    minHeight:         52,
    paddingHorizontal: 16,
    borderRadius:      12,
    borderWidth:       1.5,
    borderColor:       colors.hairline,
    backgroundColor:   colors.card,
    gap:               8,
  },
  boxOpen: {
    borderColor: colors.accentBlue,
  },
  value: {
    flex:     1,
    fontSize: 16,
    color:    colors.text,
  },
  placeholder: {
    color: colors.textSecondary,
  },
  list: {
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     colors.hairline,
    backgroundColor: colors.card,
    overflow:        'hidden',
  },
  item: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    minHeight:         44,
    paddingHorizontal: 16,
  },
  itemActive: {
    backgroundColor: colors.background,
  },
  itemText: {
    fontSize: 15,
    color:    colors.text,
  },
  itemTextActive: {
    fontWeight: '800',
  },
  itemMuted: {
    fontSize: 15,
    color:    colors.textMuted,
  },
});
