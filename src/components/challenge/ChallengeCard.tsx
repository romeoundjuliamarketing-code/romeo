import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { areaLabel, challengesForArea } from '../../data/sparringChallenges';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import SparrLogo from '../common/SparrLogo';
import { CARD_RADIUS, cardShadow } from './cardLayout';
import type { CardSize } from './cardLayout';

// Position of the card inside its own deck — presentation only, derived from the data.
function missionNumber(challenge: SparringChallenge): string {
  const index = challengesForArea(challenge.area).findIndex((c) => c.id === challenge.id);
  return `#${String(index + 1).padStart(3, '0')}`;
}

interface Props {
  challenge:     SparringChallenge;
  size:          CardSize;
  done?:         boolean;
  onToggleDone?: () => void;
}

// Front of a challenge card: a blue mission header over a warm off-white brief.
export default function ChallengeCard({
  challenge,
  size,
  done = false,
  onToggleDone,
}: Props): React.ReactElement {
  const headerHeight  = Math.round(size.height * 0.3);
  const watermarkSize = Math.round(size.width * 0.85);
  const number        = missionNumber(challenge);

  return (
    <View style={[styles.card, { width: size.width, height: size.height }, cardShadow]}>
      <View style={[styles.header, { height: headerHeight }]}>
        <View style={styles.watermark} pointerEvents="none">
          <SparrLogo size={watermarkSize} opacity={0.12} />
        </View>

        <View style={styles.headerTop}>
          <SparrLogo size={22} />
          <Text style={styles.number}>{number}</Text>
        </View>

        <View style={styles.headerBottom}>
          <View style={styles.sportBadge}>
            <Text style={styles.sportText}>{areaLabel(challenge.area)}</Text>
          </View>
          {challenge.focus.length > 0 ? (
            <Text style={styles.category} numberOfLines={1}>{challenge.focus}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{challenge.difficulty}</Text>
          </View>

          <Text style={styles.title}>{challenge.title}</Text>
          <Text style={styles.instruction}>{challenge.instruction}</Text>

          {challenge.successCriteria !== undefined ? (
            <View style={styles.successBox}>
              <Text style={styles.successLabel}>Geschafft, wenn</Text>
              <Text style={styles.successText}>{challenge.successCriteria}</Text>
            </View>
          ) : null}
        </ScrollView>

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
        ) : null}

        <View style={styles.footer}>
          <SparrLogo size={14} opacity={0.55} />
          <Text style={styles.footerText} numberOfLines={1}>
            {challenge.focus.length > 0 ? `${challenge.focus} · ${number}` : number}
          </Text>
          {done ? (
            <Ionicons name="checkmark-circle" size={14} color={colors.accentBlue} />
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
    borderWidth: 2,
    borderColor: colors.dark,
    overflow: 'hidden',
  },

  // ── Mission header ─────────────────────────────────────────────────────────
  header: {
    backgroundColor: colors.accentBlue,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  number: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.headerTextPrimary,
  },
  headerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sportBadge: {
    backgroundColor: colors.background,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  sportText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.text,
  },
  category: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.headerTextPrimary,
  },

  // ── Brief ──────────────────────────────────────────────────────────────────
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: 8,
  },
  levelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  levelText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.accentBlue,
  },
  title: {
    marginTop: 8,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.text,
  },
  instruction: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  successBox: {
    marginTop: 16,
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 8,
    padding: 8,
    gap: 4,
  },
  successLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.accentBlue,
  },
  successText: {
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
    marginBottom: 8,
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

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  footerText: {
    flex: 1,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
});
