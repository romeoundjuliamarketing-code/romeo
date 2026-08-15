import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import { CLARITY_LEVELS } from './clarityLevels';
import type { ClarityValue } from './clarityLevels';

const HEADING_LABEL = 'Kurz gefragt';
const THANKS_LABEL  = 'Danke';
const SKIP_LABEL    = 'Überspringen';
const THANKS_DURATION_MS = 1500;

interface Props {
  challenge: SparringChallenge;
  onRate:    (clarity: ClarityValue) => void;
  onSkip:    () => void;
}

// Full-screen prompt asking how clear the card just put aside was. Shown occasionally
// after a draw (see SparringChallengeScreen), separate from the inline rating row
// that appears after a card is marked done.
export default function ChallengeRatingOverlay({ challenge, onRate, onSkip }: Props): React.ReactElement {
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
    <Modal
      visible
      animationType="fade"
      transparent
      onRequestClose={onSkip}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.heading}>{HEADING_LABEL}</Text>
          <Text style={styles.question} numberOfLines={3}>
            {selected === null
              ? `Wie verständlich war „${challenge.title}“?`
              : THANKS_LABEL}
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
                  size={40}
                  color={selected === level.value ? colors.accentBlue : colors.textSecondary}
                />
                <Text style={[styles.buttonLabel, selected === level.value && styles.buttonLabelActive]}>
                  {level.label}
                </Text>
              </TouchableOpacity>
            ))}
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
  button: {
    minWidth: 64,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  buttonLabelActive: {
    color: colors.accentBlue,
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
});
