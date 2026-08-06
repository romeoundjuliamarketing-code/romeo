import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { areaLabel } from '../../data/sparringChallenges';
import type { ChallengeDifficulty, SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import { CARD_RADIUS, cardShadow } from './cardLayout';
import type { CardSize } from './cardLayout';

const DIFFICULTY_LEVEL: Record<ChallengeDifficulty, number> = {
  leicht: 1,
  mittel: 2,
  schwer: 3,
};

// Three bars, filled by level — keeps difficulty on the blue accent instead of
// introducing a second signal colour.
function DifficultyBadge({ difficulty }: { difficulty: ChallengeDifficulty }): React.ReactElement {
  const level = DIFFICULTY_LEVEL[difficulty];
  return (
    <View style={styles.difficultyBadge}>
      <View style={styles.difficultyBars}>
        {[1, 2, 3].map((step) => (
          <View
            key={step}
            style={[styles.difficultyBar, step <= level && styles.difficultyBarFilled]}
          />
        ))}
      </View>
      <Text style={styles.difficultyLabel}>{difficulty}</Text>
    </View>
  );
}

interface Props {
  challenge:     SparringChallenge;
  size:          CardSize;
  done?:         boolean;
  onToggleDone?: () => void;
}

// Face of a challenge card. The middle section scrolls only when a long task
// actually exceeds the available space.
export default function ChallengeCard({
  challenge,
  size,
  done = false,
  onToggleDone,
}: Props): React.ReactElement {
  return (
    <View style={[styles.card, { width: size.width, height: size.height }, cardShadow]}>
      <View style={styles.top}>
        <Text style={styles.area}>{areaLabel(challenge.area)}</Text>
        <DifficultyBadge difficulty={challenge.difficulty} />
      </View>

      {challenge.focus.length > 0 ? (
        <View style={styles.focusRow}>
          <View style={styles.focusChip}>
            <Text style={styles.focusText}>{challenge.focus}</Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        style={styles.middle}
        contentContainerStyle={styles.middleContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Text style={styles.title}>{challenge.title}</Text>
        <Text style={styles.instruction}>{challenge.instruction}</Text>
      </ScrollView>

      <View style={styles.bottom}>
        {challenge.successCriteria !== undefined ? (
          <View style={styles.criteria}>
            <Text style={styles.criteriaLabel}>Geschafft, wenn</Text>
            <Text style={styles.criteriaText}>{challenge.successCriteria}</Text>
          </View>
        ) : null}

        {onToggleDone !== undefined ? (
          <TouchableOpacity
            style={[styles.doneBtn, done && styles.doneBtnActive]}
            onPress={onToggleDone}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: done }}
          >
            <Ionicons
              name={done ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={18}
              color={done ? colors.headerTextPrimary : colors.accentBlue}
            />
            <Text style={[styles.doneLabel, done && styles.doneLabelActive]}>Geschafft</Text>
          </TouchableOpacity>
        ) : done ? (
          <View style={styles.doneChip}>
            <Ionicons name="checkmark-circle" size={16} color={colors.accentBlue} />
            <Text style={styles.doneChipText}>Geschafft</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  area: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },

  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  difficultyBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  difficultyBar: {
    width: 3,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  difficultyBarFilled: {
    backgroundColor: colors.accentBlue,
  },
  difficultyLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
    color: colors.textSecondary,
  },

  focusRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  focusChip: {
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  focusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.accentBlue,
  },

  middle: {
    flex: 1,
    marginTop: 16,
  },
  middleContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.text,
  },
  instruction: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  bottom: {
    gap: 8,
  },
  criteria: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    gap: 4,
  },
  criteriaLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
  criteriaText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },

  doneBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accentBlue,
    paddingHorizontal: 16,
  },
  doneBtnActive: {
    backgroundColor: colors.accentBlue,
  },
  doneLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  doneLabelActive: {
    color: colors.headerTextPrimary,
  },

  doneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  doneChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accentBlue,
  },
});
