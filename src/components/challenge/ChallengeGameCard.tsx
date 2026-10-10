import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { challengePosition } from '../../data/sparringChallenges';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { useLocalized } from '../../i18n/language';
import { colors } from '../../theme/colors';
import SparrLogo from '../common/SparrLogo';
import { CARD_RADIUS } from './cardLayout';
import type { CardSize } from './cardLayout';

interface Props {
  challenge: SparringChallenge;
  size:      CardSize;
}

const DIFFICULTY_LEVEL: Record<SparringChallenge['difficulty'], number> = {
  leicht: 1,
  mittel: 2,
  schwer: 3,
};

// Narrow cards (small phones) get one step smaller type.
const COMPACT_WIDTH = 240;
// Height of the fade that marks more text below the visible part.
const FADE_HEIGHT = 32;

// Face of a drawn card in the card game: warm off-white, the brief in the middle.
// The brief scrolls inside the fixed card when it is longer than the card, instead
// of being cut off or shrunk; a soft fade at the bottom shows there is more.
export default function ChallengeGameCard({ challenge, size }: Props): React.ReactElement {
  const { t } = useTranslation();
  const tx = useLocalized();
  const compact = size.width < COMPACT_WIDTH;
  const level   = DIFFICULTY_LEVEL[challenge.difficulty];
  const focus   = tx(challenge.focus);
  const area    = t(`challenge.areas.${challenge.area}`);
  const meta    = focus.length > 0 ? `${area} · ${focus}` : area;
  const success = challenge.successCriteria !== undefined ? tx(challenge.successCriteria) : '';

  const viewportRef = useRef(0);
  const contentRef  = useRef(0);
  const [moreBelow, setMoreBelow] = useState(false);

  const update = useCallback((offset: number): void => {
    const next = contentRef.current - viewportRef.current - offset > 4;
    setMoreBelow((prev) => (prev === next ? prev : next));
  }, []);

  const onLayout = useCallback((e: LayoutChangeEvent): void => {
    viewportRef.current = e.nativeEvent.layout.height;
    update(0);
  }, [update]);

  const onContentSizeChange = useCallback((_w: number, h: number): void => {
    contentRef.current = h;
    update(0);
  }, [update]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    update(e.nativeEvent.contentOffset.y);
  }, [update]);

  return (
    <View style={[styles.card, { width: size.width, height: size.height }]}>
      <View style={styles.top}>
        <SparrLogo size={20} />
        <Text style={styles.meta} numberOfLines={2} maxFontSizeMultiplier={1.4}>{meta}</Text>
        <Text style={styles.number} maxFontSizeMultiplier={1.4}>
          {`#${String(challengePosition(challenge)).padStart(3, '0')}`}
        </Text>
      </View>

      <View style={styles.body}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          onLayout={onLayout}
          onContentSizeChange={onContentSizeChange}
          onScroll={onScroll}
          scrollEventThrottle={32}
          bounces={false}
          indicatorStyle="black"
          persistentScrollbar
        >
          <Text style={[styles.title, compact && styles.titleCompact]}>{tx(challenge.title)}</Text>
          <Text style={[styles.instruction, compact && styles.instructionCompact]}>
            {tx(challenge.instruction)}
          </Text>
          {success.length > 0 ? (
            <View style={styles.success}>
              <Text style={styles.successLabel}>{t('challenge.card.successCriteria')}</Text>
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}
        </ScrollView>

        {moreBelow ? (
          <Svg style={styles.fade} width={size.width} height={FADE_HEIGHT} pointerEvents="none">
            <Defs>
              <LinearGradient id="gameCardFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
                <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={size.width} height={FADE_HEIGHT} fill="url(#gameCardFade)" />
          </Svg>
        ) : null}
      </View>

      <View
        style={styles.footer}
        accessible
        accessibilityLabel={t('challenge.card.difficulty', { level: t(`challenge.difficulty.${challenge.difficulty}`) })}
      >
        <View style={styles.levelBars}>
          {[1, 2, 3].map((step) => (
            <View key={step} style={[styles.levelBar, step <= level && styles.levelBarOn]} />
          ))}
        </View>
        <Text style={styles.levelText} maxFontSizeMultiplier={1.4}>
          {t(`challenge.difficulty.${challenge.difficulty}`)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },

  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  meta: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  number: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.textMuted,
  },

  body: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: colors.text,
  },
  titleCompact: {
    fontSize: 19,
    lineHeight: 24,
  },
  instruction: {
    marginTop: 16,
    fontSize: 19,
    lineHeight: 28,
    fontWeight: '500',
    color: colors.text,
  },
  instructionCompact: {
    fontSize: 17,
    lineHeight: 25,
  },
  success: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.fieldBorder,
    gap: 8,
  },
  successLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  successText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  fade: {
    position: 'absolute',
    left: 0,
    bottom: 0,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
});
