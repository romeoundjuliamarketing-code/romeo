import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

type ClarityValue = 1 | 2 | 3;

interface ClarityLevel {
  value: ClarityValue;
  icon:  React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
}

// Single source of truth for the three clarity levels — swapping these icons for
// penguin illustrations later only touches this array.
const CLARITY_LEVELS: ClarityLevel[] = [
  { value: 1, icon: 'emoticon-confused-outline', label: 'Unklar' },
  { value: 2, icon: 'emoticon-neutral-outline',  label: 'Geht so' },
  { value: 3, icon: 'emoticon-happy-outline',    label: 'Klar' },
];

const QUESTION_LABEL = 'Wie verständlich war die Aufgabe?';
const THANKS_LABEL   = 'Danke';
const THANKS_DURATION_MS = 1500;

interface Props {
  onRate: (clarity: ClarityValue) => void;
}

// One-line clarity rating shown after a card is marked as done. Selecting a
// level shows a brief "Danke" before the parent hides the row (once it calls
// onRate, which optimistically removes the card from the rated set).
export default function ChallengeClarityRating({ onRate }: Props): React.ReactElement {
  const [selected, setSelected] = useState<ClarityValue | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  const handleSelect = useCallback((value: ClarityValue): void => {
    if (selected !== null) return;
    setSelected(value);
    timerRef.current = setTimeout(() => onRate(value), THANKS_DURATION_MS);
  }, [selected, onRate]);

  return (
    <View style={styles.row}>
      <Text style={styles.question} numberOfLines={2}>
        {selected === null ? QUESTION_LABEL : THANKS_LABEL}
      </Text>
      <View style={styles.buttons}>
        {CLARITY_LEVELS.map((level) => (
          <TouchableOpacity
            key={level.value}
            style={styles.button}
            onPress={() => handleSelect(level.value)}
            activeOpacity={0.7}
            disabled={selected !== null}
            accessibilityRole="button"
            accessibilityLabel={level.label}
            accessibilityState={{ selected: selected === level.value }}
          >
            <MaterialCommunityIcons
              name={level.icon}
              size={24}
              color={selected === level.value ? colors.accentBlue : colors.headerTextSecondary}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 16,
    // Full width on purpose: the question needs more room than the button row below.
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  question: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
