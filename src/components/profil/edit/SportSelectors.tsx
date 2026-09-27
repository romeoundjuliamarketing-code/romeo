import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { ALL_DISCIPLINES } from '../../../data/disciplines';
import { disciplineIcon } from '../../../data/disciplineBadges';
import { STANCES, stanceLabel } from '../../../utils/stance';
import type { Stance } from '../../../utils/stance';

// ─── Disciplines ─────────────────────────────────────────────────────────────

// Selected sports as badges (tap × to remove, 44 pt target), "Sportart
// hinzufügen" reveals the remaining ones inline — no extra sheet.
export function DisciplineSelector({ selected, onChange }: {
  selected: string[];
  onChange: (next: string[]) => void;
}): React.ReactElement {
  const [adding, setAdding] = useState(false);
  const remaining = ALL_DISCIPLINES.filter((d) => !selected.includes(d));

  return (
    <View style={styles.group}>
      <Text style={styles.label}>Disziplinen</Text>
      <View style={styles.badges}>
        {selected.map((d) => (
          <View key={d} style={styles.selectedBadge}>
            <MaterialCommunityIcons name={disciplineIcon(d)} size={16} color={colors.accentBlue} />
            <Text style={styles.selectedText}>{d}</Text>
            <TouchableOpacity
              style={styles.remove}
              onPress={() => onChange(selected.filter((x) => x !== d))}
              accessibilityRole="button"
              accessibilityLabel={`${d} entfernen`}
            >
              <Ionicons name="close" size={16} color={colors.card} />
            </TouchableOpacity>
          </View>
        ))}
        {selected.length === 0 && <Text style={styles.hint}>Noch keine Sportart gewählt.</Text>}
      </View>

      {remaining.length > 0 && (
        adding ? (
          <View style={styles.badges}>
            {remaining.map((d) => (
              <TouchableOpacity
                key={d}
                style={styles.option}
                onPress={() => { onChange([...selected, d]); if (remaining.length === 1) setAdding(false); }}
                accessibilityRole="button"
                accessibilityLabel={`${d} hinzufügen`}
              >
                <MaterialCommunityIcons name={disciplineIcon(d)} size={16} color={colors.accentBlue} />
                <Text style={styles.optionText}>{d}</Text>
                <Ionicons name="add" size={16} color={colors.text} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.doneBtn} onPress={() => setAdding(false)} accessibilityRole="button">
              <Text style={styles.doneText}>Fertig</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addBtn} onPress={() => setAdding(true)} accessibilityRole="button">
            <Ionicons name="add-circle-outline" size={20} color={colors.accentBlue} />
            <Text style={styles.addText}>Sportart hinzufügen</Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );
}

// ─── Stance ──────────────────────────────────────────────────────────────────

// Which foot leads — the standard meaning of each stance.
const STANCE_HINT: Record<Stance, string> = {
  orthodox: 'Linker Fuß vorn',
  southpaw: 'Rechter Fuß vorn',
  switch:   'Wechselnd',
};

export function StanceSelector({ value, onChange }: {
  value:    Stance | null;
  onChange: (next: Stance | null) => void;
}): React.ReactElement {
  return (
    <View style={styles.group}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Auslage</Text>
        <Text style={styles.optional}>optional</Text>
      </View>
      <View style={styles.tiles}>
        {STANCES.map((s) => {
          const selected = value === s;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.tile, selected && styles.tileActive]}
              onPress={() => onChange(selected ? null : s)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${stanceLabel(s)}, ${STANCE_HINT[s]}`}
            >
              <View style={styles.tileHead}>
                <Text style={[styles.tileTitle, selected && styles.tileTitleActive]}>{stanceLabel(s)}</Text>
                {selected && <Ionicons name="checkmark-circle" size={18} color={colors.accentBlue} />}
              </View>
              <Text style={[styles.tileHint, selected && styles.tileHintActive]}>{STANCE_HINT[s]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
  hint: {
    fontSize: 14,
    color:    colors.textMuted,
  },
  badges: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  selectedBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    paddingLeft:     16,
    minHeight:       44,
    borderRadius:    12,
    backgroundColor: colors.dark,
  },
  selectedText: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color:         colors.card,
  },
  remove: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
  },
  option: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 16,
    minHeight:         44,
    borderRadius:      12,
    borderWidth:       1.5,
    borderColor:       colors.hairline,
    backgroundColor:   colors.card,
  },
  optionText: {
    fontSize:   14,
    fontWeight: '700',
    color:      colors.text,
  },
  doneBtn: {
    minHeight:         44,
    paddingHorizontal: 16,
    justifyContent:    'center',
  },
  doneText: {
    fontSize:   14,
    fontWeight: '700',
    color:      colors.text,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    alignSelf:     'flex-start',
    gap:           8,
    minHeight:     44,
  },
  addText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.text,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  tile: {
    flexGrow:          1,
    flexBasis:         96,
    minHeight:         64,
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      12,
    borderWidth:       1.5,
    borderColor:       colors.hairline,
    backgroundColor:   colors.card,
    justifyContent:    'center',
    gap:               4,
  },
  tileActive: {
    borderColor: colors.accentBlue,
    borderWidth: 2,
  },
  tileHead: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            4,
  },
  tileTitle: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.text,
  },
  tileTitleActive: {
    fontWeight: '900',
  },
  tileHint: {
    fontSize: 12,
    color:    colors.textMuted,
  },
  tileHintActive: {
    color: colors.text,
  },
});
