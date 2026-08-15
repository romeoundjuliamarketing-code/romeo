import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ClarityValue } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import { useClarityChoice } from './clarityLevels';
import ClarityButtons from './ClarityButtons';

const QUESTION_LABEL = 'Wie verständlich war die Aufgabe?';
const THANKS_LABEL   = 'Danke';

interface Props {
  onRate: (clarity: ClarityValue) => void;
}

// One-line clarity rating shown after a card is marked as done. Selecting a level
// shows a brief confirmation before the parent hides the row.
export default function ChallengeClarityRating({ onRate }: Props): React.ReactElement {
  const { selected, choose } = useClarityChoice(onRate);

  return (
    <View style={styles.row}>
      <Text style={styles.question} numberOfLines={2}>
        {selected === null ? QUESTION_LABEL : THANKS_LABEL}
      </Text>
      <ClarityButtons
        selected={selected}
        onSelect={choose}
        iconSize={24}
        inactiveColor={colors.headerTextSecondary}
      />
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
});
