import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import { useLocalized } from '../../i18n/language';
import SparrLogo from '../common/SparrLogo';
import CardMotif from './CardMotif';
import { CARD_RADIUS } from './cardLayout';

const MOTIF_HEIGHT = 72;

interface Props {
  card:      SparringChallenge;
  width:     number;
  // Fixed height so all examples share one size; omitted while measuring.
  height?:   number;
  onLayout?: (e: LayoutChangeEvent) => void;
}

// Front of an example card on the Karten tab, built like a playing card: blue head
// band with category and difficulty, a motif for the category, then title and task
// on the light face and a small footer. Every text wraps; long content makes the
// card taller instead of being cut or shrunk.
export default function CardPreviewFace({ card, width, height, onLayout }: Props): React.ReactElement {
  const { t } = useTranslation();
  const tx = useLocalized();
  const focus = tx(card.focus);
  const category = focus.length > 0 ? focus : t(`challenge.areas.${card.area}`);

  return (
    <View style={[styles.shadow, { width }, height !== undefined && { height }]} onLayout={onLayout}>
      <View style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.category}>{category}</Text>
          <View style={styles.level}>
            <Text style={styles.levelText}>{t(`challenge.difficulty.${card.difficulty}`)}</Text>
          </View>
        </View>
        <View style={styles.motif}>
          <CardMotif focusDe={card.focus.de} height={MOTIF_HEIGHT} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{tx(card.title)}</Text>
          <Text style={styles.task}>{tx(card.instruction)}</Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('challenge.landing.exampleCard')}</Text>
          <View style={styles.mark}>
            <SparrLogo size={16} />
            <Text style={styles.markText}>SPARR</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Outer layer carries the short, soft shadow; the inner one clips the head band
  // to the rounded corners.
  shadow: {
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.card,
    ...Platform.select({
      ios:     { shadowColor: colors.dark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  // flexGrow (not flex) so the card keeps its content height while measured.
  card: {
    flexGrow: 1,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.cardFaceHeader,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  category: {
    flexShrink: 1,
    color: colors.headerTextPrimary,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  level: {
    borderWidth: 1,
    borderColor: colors.headerBorder,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  levelText: {
    color: colors.headerTextPrimary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  motif: {
    backgroundColor: colors.cardFaceMotif,
    paddingVertical: 8,
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    lineHeight: 28,
  },
  task: {
    color: colors.text,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  footerText: {
    flexShrink: 1,
    color: colors.textMuted,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  mark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markText: {
    color: colors.accentBlueText,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 2,
  },
});
