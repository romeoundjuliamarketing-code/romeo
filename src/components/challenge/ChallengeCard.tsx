import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { challengePosition } from '../../data/sparringChallenges';
import { useTranslation } from 'react-i18next';
import { useLocalized } from '../../i18n/language';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import SparrLogo from '../common/SparrLogo';
import { CARD_RADIUS, cardShadow } from './cardLayout';
import type { CardSize } from './cardLayout';

function missionNumber(challenge: SparringChallenge): string {
  return `#${String(challengePosition(challenge)).padStart(3, '0')}`;
}

interface Props {
  challenge:     SparringChallenge;
  size:          CardSize;
  done?:         boolean;
  onToggleDone?: () => void;
  // Off inside the deck, where the whole card is a tap target for drawing.
  scrollable?:   boolean;
  // Off while the card rotates in 3D (ChallengeDeck) — a shadow without a shadowPath
  // forces an offscreen render that blurs during the flip.
  elevated?:     boolean;
  // Height follows the content (min. one square card width) instead of the fixed
  // playing-card ratio. For screens that scroll the card as a whole.
  fitContent?:   boolean;
  // Static example (coach tour): no difficulty row, height follows the text,
  // small band.
  preview?:      boolean;
}

// Narrow cards (thumbnails in the feedback step) get a smaller type scale so the
// title does not break into single words.
const COMPACT_WIDTH = 280;

const DIFFICULTY_LEVEL: Record<SparringChallenge['difficulty'], number> = {
  leicht: 1,
  mittel: 2,
  schwer: 3,
};

// Front of a challenge card: a compact blue brand band over a warm off-white brief.
// Everything that identifies the card (mark, discipline, focus, number) lives in the
// band once; the body belongs to the mission alone.
export default function ChallengeCard({
  challenge,
  size,
  done = false,
  onToggleDone,
  scrollable = true,
  elevated = true,
  fitContent = false,
  preview = false,
}: Props): React.ReactElement {
  const { t } = useTranslation();
  const tx = useLocalized();
  const compact = preview || size.width < COMPACT_WIDTH;
  const level   = DIFFICULTY_LEVEL[challenge.difficulty];
  const focus   = tx(challenge.focus);
  const meta    = focus.length > 0
    ? `${t(`challenge.areas.${challenge.area}`)} · ${focus}`
    : t(`challenge.areas.${challenge.area}`);

  const brief = (
    <>
      {!preview && <View
        style={styles.levelRow}
        accessible
        accessibilityLabel={t('challenge.card.difficulty', { level: t(`challenge.difficulty.${challenge.difficulty}`) })}
      >
        <View style={styles.levelBars}>
          {[1, 2, 3].map((step) => (
            <View key={step} style={[styles.levelBar, step <= level && styles.levelBarOn]} />
          ))}
        </View>
        <Text style={styles.levelText}>{t(`challenge.difficulty.${challenge.difficulty}`)}</Text>
      </View>}

      <Text style={[styles.title, compact && styles.titleCompact]}>{tx(challenge.title)}</Text>
      {/* Inside the deck the brief cannot scroll (the card is a tap target), so a very
          long text ellipsizes here and stays readable in full under "Alle Karten ansehen". */}
      <Text
        style={[
          styles.instruction,
          !scrollable && !fitContent && styles.instructionDeck,
          compact && styles.instructionCompact,
        ]}
        numberOfLines={scrollable || fitContent ? undefined : 9}
      >
        {tx(challenge.instruction)}
      </Text>
    </>
  );

  const doneButton = onToggleDone !== undefined ? (
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
      <Text style={[styles.doneLabel, done && styles.doneLabelActive]}>{t('challenge.card.done')}</Text>
    </TouchableOpacity>
  ) : null;

  const sizeStyle = preview
    ? { width: size.width }
    : fitContent
    ? { width: size.width, minHeight: size.width }
    : { width: size.width, height: size.height };

  return (
    <View style={[styles.card, sizeStyle, elevated && cardShadow]}>
      <View style={styles.band}>
        {/* Cropped by the band edge — texture behind the text, not a second logo. */}
        <View style={styles.watermark} pointerEvents="none">
          <SparrLogo size={112} opacity={0.1} />
        </View>

        <SparrLogo size={compact ? 32 : 40} />
        <Text style={styles.meta} numberOfLines={preview ? 1 : 2}>{meta}</Text>
        <View style={styles.numberWrap}>
          {done ? (
            <Ionicons name="checkmark-circle" size={16} color={colors.headerTextPrimary} />
          ) : null}
          <Text style={styles.number}>{missionNumber(challenge)}</Text>
        </View>
      </View>

      {fitContent || preview ? (
        <>
          <View style={styles.bodyContent}>{brief}</View>
          {doneButton}
        </>
      ) : (
        <View style={styles.body}>
          {scrollable ? (
            <ScrollView
              style={styles.bodyFill}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {brief}
            </ScrollView>
          ) : (
            <View style={[styles.bodyFill, styles.bodyContent]}>{brief}</View>
          )}
          {doneButton}
        </View>
      )}
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

  // ── Brand band ─────────────────────────────────────────────────────────────
  band: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: colors.accentBlue,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    right: -32,
    top: -24,
  },
  meta: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.headerTextPrimary,
  },
  numberWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  number: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.headerTextPrimary,
  },

  // ── Brief ──────────────────────────────────────────────────────────────────
  body: {
    flex: 1,
  },
  bodyFill: {
    flex: 1,
  },
  bodyContent: {
    padding: 24,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  levelBar: {
    width: 4,
    height: 12,
    borderRadius: 2,
    backgroundColor: colors.hairline,
  },
  levelBarOn: {
    backgroundColor: colors.accentBlue,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  title: {
    marginTop: 8,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: colors.text,
  },
  titleCompact: {
    fontSize: 21,
    lineHeight: 26,
  },
  instruction: {
    marginTop: 16,
    fontSize: 19,
    lineHeight: 27,
    color: colors.text,
  },
  // Fixed-size deck card that cannot scroll: one step smaller so the longest missions
  // still fit in full.
  instructionDeck: {
    fontSize: 17,
    lineHeight: 24,
  },
  instructionCompact: {
    fontSize: 15,
    lineHeight: 21,
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
    marginHorizontal: 24,
    marginBottom: 24,
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
});
