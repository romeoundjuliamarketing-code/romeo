import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { areaLabel } from '../../data/sparringChallenges';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import SparrLogo from '../common/SparrLogo';
import { CARD_RADIUS, cardShadow } from './cardLayout';
import type { CardSize } from './cardLayout';

interface Props {
  challenge:     SparringChallenge;
  size:          CardSize;
  done?:         boolean;
  onToggleDone?: () => void;
}

// Front of a challenge card: brand mark and sport on top, the task in the middle,
// category and success criteria at the bottom.
export default function ChallengeCard({
  challenge,
  size,
  done = false,
  onToggleDone,
}: Props): React.ReactElement {
  return (
    <View style={[styles.card, { width: size.width, height: size.height }, cardShadow]}>
      <View style={styles.frame}>
      <View style={styles.top}>
        <SparrLogo size={24} />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{areaLabel(challenge.area)}</Text>
        </View>
      </View>

      <View style={styles.difficultyRow}>
        <View style={styles.difficultyBadge}>
          <Text style={styles.difficultyText}>{challenge.difficulty}</Text>
        </View>
      </View>

      <View style={styles.middle}>
        <Text style={styles.title}>{challenge.title}</Text>
        <Text style={styles.instruction}>{challenge.instruction}</Text>
      </View>

      <View style={styles.bottom}>
        {challenge.focus.length > 0 ? (
          <Text style={styles.category}>{challenge.focus}</Text>
        ) : null}

        {challenge.successCriteria !== undefined ? (
          <Text style={styles.criteria}>Geschafft, wenn: {challenge.successCriteria}</Text>
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
              size={16}
              color={done ? colors.headerTextPrimary : colors.accentBlue}
            />
            <Text style={[styles.doneLabel, done && styles.doneLabelActive]}>Geschafft</Text>
          </TouchableOpacity>
        ) : done ? (
          <View style={styles.doneChip}>
            <Ionicons name="checkmark-circle" size={14} color={colors.accentBlue} />
            <Text style={styles.doneChipText}>Geschafft</Text>
          </View>
        ) : null}
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
  },
  // Printed inner frame — mirrors the double frame on the card back.
  frame: {
    flex: 1,
    borderRadius: CARD_RADIUS - 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badge: {
    borderRadius: 8,
    backgroundColor: colors.darkMuted,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.text,
  },

  difficultyRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  difficultyBadge: {
    borderRadius: 8,
    backgroundColor: colors.accentBlueSoft,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.accentBlue,
  },

  middle: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.text,
  },
  instruction: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  bottom: {
    gap: 8,
  },
  category: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
  criteria: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.text,
  },

  doneBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accentBlue,
  },
  doneBtnActive: {
    backgroundColor: colors.accentBlue,
  },
  doneLabel: {
    fontSize: 13,
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
    fontSize: 12,
    fontWeight: '700',
    color: colors.accentBlue,
  },
});
