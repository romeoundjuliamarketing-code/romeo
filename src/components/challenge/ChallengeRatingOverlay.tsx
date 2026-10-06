import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import type { ClarityValue, SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import { useClarityChoice } from './clarityLevels';
import ClarityButtons from './ClarityButtons';

const HEADING_LABEL = 'Kurz gefragt';
const THANKS_LABEL  = 'Danke';
const SKIP_LABEL    = 'Überspringen';
const SKIP_ALL_LABEL = 'Alle überspringen';

interface Props {
  challenge:  SparringChallenge;
  onRate:     (clarity: ClarityValue) => void;
  onSkip:     () => void;
  // Position in a run of questions, e.g. "Karte 2 von 5". Replaces the heading.
  progress?:  string;
  // Ends the whole run at once. Only offered when there is more than one question.
  onSkipAll?: () => void;
}

// Full-screen prompt asking how clear a played card was. The deck asks about every
// card of the visit, one after another, when the player leaves the game.
export default function ChallengeRatingOverlay({
  challenge,
  onRate,
  onSkip,
  progress,
  onSkipAll,
}: Props): React.ReactElement {
  const { selected, choose } = useClarityChoice(onRate);

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      onRequestClose={onSkip}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.heading}>{progress ?? HEADING_LABEL}</Text>
          <Text style={styles.question} numberOfLines={3}>
            {selected === null
              ? `Wie verständlich war „${challenge.title}“?`
              : THANKS_LABEL}
          </Text>

          <View style={styles.buttons}>
            <ClarityButtons
              selected={selected}
              onSelect={choose}
              iconSize={40}
              inactiveColor={colors.textSecondary}
              showLabels
            />
          </View>

          {selected === null ? (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={onSkip}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.skipLabel}>{SKIP_LABEL}</Text>
            </TouchableOpacity>
          ) : null}

          {selected === null && onSkipAll !== undefined ? (
            <TouchableOpacity
              style={styles.skipAllButton}
              onPress={onSkipAll}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.skipAllLabel}>{SKIP_ALL_LABEL}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: colors.mapOverlay,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: colors.card,
  },
  heading: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  question: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  buttons: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 24,
  },
  skipButton: {
    marginTop: 24,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  skipLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  skipAllButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  skipAllLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
