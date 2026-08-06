import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { areaLabel } from '../../data/sparringChallenges';
import type { ChallengeDifficulty, SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';

const screenWidth = Dimensions.get('window').width;

export const CARD_WIDTH  = Math.min(screenWidth - 64, 320);
export const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.45);

const DIFFICULTY_COLOR: Record<ChallengeDifficulty, string> = {
  leicht: colors.difficultyGreen,
  mittel: colors.accentBlue,
  schwer: colors.deleteRed,
};

interface Props {
  challenge:     SparringChallenge;
  done?:         boolean;
  onToggleDone?: () => void;
}

// The face of a challenge card. Used both for the drawn card and inside the browser.
export default function ChallengeCard({ challenge, done = false, onToggleDone }: Props): React.ReactElement {
  const pressScale = useSharedValue(1);

  const doneStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handleToggle = (): void => {
    pressScale.value = withSequence(
      withTiming(0.88, { duration: 90 }),
      withTiming(1, { duration: 140 }),
    );
    onToggleDone?.();
  };

  return (
    <View style={styles.card}>
      <View style={[styles.stripe, { backgroundColor: DIFFICULTY_COLOR[challenge.difficulty] }]} />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.area}>{areaLabel(challenge.area)}</Text>
          <View style={styles.focusChip}>
            <Text style={styles.focusText}>{challenge.focus}</Text>
          </View>
        </View>

        <Text style={styles.title}>{challenge.title}</Text>
        <Text style={styles.instruction}>{challenge.instruction}</Text>

        <View style={styles.spacer} />

        <View style={styles.bottomRow}>
          <Text style={[styles.difficulty, { color: DIFFICULTY_COLOR[challenge.difficulty] }]}>
            {challenge.difficulty}
          </Text>
          {onToggleDone !== undefined ? (
            <Animated.View style={doneStyle}>
              <TouchableOpacity
                style={[styles.doneBtn, done && styles.doneBtnActive]}
                onPress={handleToggle}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={done ? 'Als offen markieren' : 'Als erledigt markieren'}
              >
                <Ionicons
                  name={done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={done ? colors.card : colors.textSecondary}
                />
                <Text style={[styles.doneLabel, done && styles.doneLabelActive]}>
                  {done ? 'Erledigt' : 'Erledigt?'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  stripe: {
    height: 8,
    width: '100%',
  },
  body: {
    flex: 1,
    padding: 24,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  area: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  focusChip: {
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  focusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  title: {
    marginTop: 24,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  instruction: {
    marginTop: 16,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  spacer: {
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  difficulty: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  doneBtnActive: {
    backgroundColor: colors.difficultyGreen,
    borderColor: colors.difficultyGreen,
  },
  doneLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  doneLabelActive: {
    color: colors.card,
  },
});
