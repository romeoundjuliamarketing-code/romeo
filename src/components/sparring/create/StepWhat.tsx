import React, { useCallback } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet, type AccessibilityActionEvent } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { fonts } from '../../../theme/typography';
import { SPARRING_DISCIPLINES, MIN_MAX_SLOTS, type DraftErrors } from '../../../utils/sparringDraft';
import { StepTitle, SectionLabel, FieldError } from './FlowParts';

type GlyphName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const DISCIPLINE_ICONS: Record<(typeof SPARRING_DISCIPLINES)[number], GlyphName> = {
  'Boxen':          'boxing-glove',
  'K1 / Kickboxen': 'karate',
  'BJJ':            'kabaddi',
  'MMA':            'mixed-martial-arts',
  'Muay Thai':      'arm-flex',
  'Ringen':         'human-handsup',
  'Sonstiges':      'dots-horizontal-circle-outline',
};

const DisciplineTile = React.memo(function DisciplineTile({ name, icon, selected, onSelect }: {
  name:     string;
  icon:     GlyphName;
  selected: boolean;
  onSelect: (name: string) => void;
}): React.ReactElement {
  return (
    <Pressable
      style={({ pressed }) => [styles.tile, selected && styles.tileSelected, pressed && !selected && styles.tilePressed]}
      onPress={() => onSelect(name)}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={name}
    >
      <View style={styles.tileTop}>
        <MaterialCommunityIcons name={icon} size={24} color={selected ? colors.headerTextPrimary : colors.text} />
        {/* Ring vs. filled check: the choice reads without colour too. */}
        {selected ? (
          <View style={styles.check}>
            <Ionicons name="checkmark" size={16} color={colors.headerTextPrimary} />
          </View>
        ) : (
          <View style={styles.ring} />
        )}
      </View>
      <Text style={[styles.tileName, selected && styles.tileNameSelected]}>{name}</Text>
    </Pressable>
  );
});

function StepWhat({ discipline, maxSlots, errors, onDiscipline, onMaxSlots }: {
  discipline:   string | null;
  maxSlots:     number;
  errors:       DraftErrors;
  onDiscipline: (d: string) => void;
  onMaxSlots:   (n: number) => void;
}): React.ReactElement {
  const canDecrement = maxSlots > MIN_MAX_SLOTS;
  const decrement = useCallback(() => onMaxSlots(Math.max(MIN_MAX_SLOTS, maxSlots - 1)), [maxSlots, onMaxSlots]);
  const increment = useCallback(() => onMaxSlots(maxSlots + 1), [maxSlots, onMaxSlots]);

  function onAccessibilityAction(e: AccessibilityActionEvent): void {
    if (e.nativeEvent.actionName === 'increment') increment();
    if (e.nativeEvent.actionName === 'decrement' && canDecrement) decrement();
  }

  return (
    <View>
      <StepTitle text="Was steht an?" />

      <SectionLabel text="Disziplin" />
      <View style={styles.grid} accessibilityRole="radiogroup">
        {SPARRING_DISCIPLINES.map((d) => (
          <DisciplineTile
            key={d}
            name={d}
            icon={DISCIPLINE_ICONS[d]}
            selected={discipline === d}
            onSelect={onDiscipline}
          />
        ))}
      </View>
      <FieldError text={errors.discipline} />

      <View style={styles.rope} />

      <SectionLabel text="Plätze für Mitmachende" hint="Du als Gastgeber zählst nicht mit." />
      <View style={styles.counterRow}>
        <TouchableOpacity
          style={[styles.roundBtn, !canDecrement && styles.roundBtnDisabled]}
          onPress={decrement}
          disabled={!canDecrement}
          accessibilityRole="button"
          accessibilityLabel="Einen Platz weniger"
          accessibilityState={{ disabled: !canDecrement }}
        >
          <Ionicons name="remove" size={24} color={colors.text} />
        </TouchableOpacity>
        <View
          style={styles.counterValue}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Plätze für Mitmachende"
          accessibilityValue={{ text: `${maxSlots} ${maxSlots === 1 ? 'Platz' : 'Plätze'}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onAccessibilityAction}
        >
          <Text style={styles.counterNumber} maxFontSizeMultiplier={1.3}>{maxSlots}</Text>
          <Text style={styles.counterUnit}>{maxSlots === 1 ? 'Platz' : 'Plätze'}</Text>
        </View>
        <TouchableOpacity
          style={styles.roundBtn}
          onPress={increment}
          accessibilityRole="button"
          accessibilityLabel="Einen Platz mehr"
        >
          <Ionicons name="add" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      <FieldError text={errors.maxSlots} />
    </View>
  );
}

export default React.memo(StepWhat);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  tile: {
    width: '48.5%',
    minHeight: 96,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    justifyContent: 'space-between',
  },
  tilePressed: {
    backgroundColor: colors.hairline,
  },
  tileSelected: {
    backgroundColor: colors.dark,
  },
  tileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  ring: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.fieldBorder,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileName: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    textTransform: 'uppercase',
    color: colors.text,
  },
  tileNameSelected: {
    color: colors.headerTextPrimary,
  },
  // Thin "rope" between the two sections.
  rope: {
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.hairline,
    marginVertical: 32,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  roundBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtnDisabled: {
    opacity: 0.35,
  },
  counterValue: {
    minWidth: 104,
    alignItems: 'center',
  },
  counterNumber: {
    fontFamily: fonts.display,
    fontSize: 72,
    lineHeight: 76,
    color: colors.text,
  },
  counterUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
