import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { availableChallengeAreas, playableChallengesForArea } from '../utils/challengeAvailability';
import type { SparringChallenge } from '../data/sparringChallenges';
import { useProfile } from '../hooks/useProfile';
import { useSparringChallenge } from '../hooks/useSparringChallenge';
import ChallengeAreaPicker from '../components/challenge/ChallengeAreaPicker';
import ChallengeHeader from '../components/challenge/ChallengeHeader';
import ChallengeDeck, { DRAW_ANIMATION_MS } from '../components/challenge/ChallengeDeck';
import ChallengeBrowser from '../components/challenge/ChallengeBrowser';
import CardGameHint from '../components/challenge/CardGameHint';
import ChallengeRatingOverlay from '../components/challenge/ChallengeRatingOverlay';
import { useExitCardFeedback } from '../hooks/useExitCardFeedback';
import { CARD_ASPECT, useCardSize } from '../components/challenge/cardLayout';
import type { CardSize } from '../components/challenge/cardLayout';

// Vertical room the deck needs beyond the card itself: the deckArea padding plus the
// stacked cards peeking out above the top card.
const DECK_VERTICAL_RESERVE = 16 * 2 + 8;
import { colors } from '../theme/colors';

export default function SparringChallengeScreen(): React.ReactElement {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { profile } = useProfile();
  const [browserVisible, setBrowserVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const drawTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenCardSize = useCardSize();
  const [deckHeight, setDeckHeight] = useState<number | null>(null);

  // The card is sized to the room the deck area really has, not to the window. The
  // deck is absolutely positioned, so a card taller than its area would draw over the
  // status line and the rating below (they grow and shrink while playing).
  const cardSize = useMemo<CardSize>(() => {
    if (deckHeight === null) return screenCardSize;
    const byHeight = Math.floor((deckHeight - DECK_VERTICAL_RESERVE) * CARD_ASPECT);
    const width    = Math.max(120, Math.min(screenCardSize.width, byHeight));
    return { width, height: Math.round(width / CARD_ASPECT) };
  }, [deckHeight, screenCardSize]);

  const onDeckLayout = useCallback((e: LayoutChangeEvent): void => {
    const next = Math.round(e.nativeEvent.layout.height);
    setDeckHeight((prev) => (prev === next ? prev : next));
  }, []);

  const {
    area,
    setArea,
    current,
    deckSize,
    remaining,
    draw,
    loading,
    areaChosen,
  } = useSparringChallenge(profile?.disciplines ?? []);

  useEffect(() => () => {
    if (drawTimer.current !== null) clearTimeout(drawTimer.current);
  }, []);

  // Blocks a second draw while the card is still moving, so rapid taps cannot burn
  // through the deck.
  const handleDraw = useCallback((): void => {
    if (drawing || deckSize === 0) return;
    setDrawing(true);
    draw();
    drawTimer.current = setTimeout(() => setDrawing(false), DRAW_ANIMATION_MS + 40);
  }, [drawing, deckSize, draw]);

  const feedback = useExitCardFeedback(current);

  const areaCards = playableChallengesForArea(area);
  const deckEmpty = deckSize === 0;
  const hasCard   = current !== null;

  const status = deckEmpty
    ? t('challenge.noCards')
    : remaining === 0
      ? t('challenge.deckFinished')
      : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ChallengeHeader
        title={t('challenge.screen.title')}
        icon="chevron-back"
        iconLabel={t('common.back')}
        onPress={() => navigation.goBack()}
        right={loading || !areaChosen || availableChallengeAreas().length < 2 ? undefined : (
          <TouchableOpacity
            style={styles.areaButton}
            onPress={() => setPickerVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('challenge.screen.changeDiscipline')}
          >
            <Text style={styles.areaButtonLabel} numberOfLines={1}>{t(`challenge.areas.${area}`)}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.headerTextPrimary} />
          </TouchableOpacity>
        )}
      />

      <CardGameHint />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accentBlue} />
        </View>
      ) : !areaChosen ? (
        <ChallengeAreaPicker current={area} onSelect={setArea} />
      ) : (
        <View style={styles.body}>
          <Text style={styles.missionLabel}>{t('challenge.screen.mission')}</Text>

          <View style={styles.deckArea} onLayout={onDeckLayout}>
            <ChallengeDeck
              card={current}
              size={cardSize}
              onPress={handleDraw}
              disabled={deckEmpty || drawing}
            />
          </View>

          <View style={styles.actions}>
            {status !== null ? <Text style={styles.status}>{status}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryBtn, (deckEmpty || drawing) && styles.btnBusy]}
              onPress={handleDraw}
              activeOpacity={0.85}
              disabled={deckEmpty || drawing}
              accessibilityRole="button"
            >
              <Text style={styles.primaryLabel}>{hasCard ? t('challenge.screen.newCard') : t('challenge.screen.drawCard')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => setBrowserVisible(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.linkLabel}>{t('challenge.screen.browseAll')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {browserVisible ? (
        <ChallengeBrowser
          visible
          cards={areaCards}
          areaTitle={t(`challenge.areas.${area}`)}
          onClose={() => setBrowserVisible(false)}
        />
      ) : null}

      {pickerVisible ? (
        <ChallengeAreaPicker
          current={area}
          onSelect={(next) => {
            setArea(next);
            setPickerVisible(false);
          }}
          onClose={() => setPickerVisible(false)}
        />
      ) : null}

      {feedback !== null ? (
        <ChallengeRatingOverlay
          key={feedback.card.id}
          challenge={feedback.card}
          progress={feedback.progress}
          onRate={feedback.rate}
          onSkip={feedback.skip}
          onSkipAll={feedback.skipAll}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  areaButton: {
    height: 44,
    maxWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingHorizontal: 8,
  },
  areaButtonLabel: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.headerTextPrimary,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  missionLabel: {
    marginTop: 16,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: colors.headerTextSecondary,
  },
  deckArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  actions: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  status: {
    marginBottom: 16,
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },

  primaryBtn: {
    width: '100%',
    maxWidth: 320,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.accentBlue,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },

  btnBusy: {
    opacity: 0.5,
  },

  linkBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },
});
