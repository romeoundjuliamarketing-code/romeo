import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Pressable, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { availableChallengeAreas, playableChallengesForArea } from '../utils/challengeAvailability';
import { useProfile } from '../hooks/useProfile';
import { useSparringChallenge } from '../hooks/useSparringChallenge';
import ChallengeAreaPicker from '../components/challenge/ChallengeAreaPicker';
import ChallengeHeader from '../components/challenge/ChallengeHeader';
import ChallengeDeck, { DRAW_ANIMATION_MS } from '../components/challenge/ChallengeDeck';
import type { ChallengeDeckHandle } from '../components/challenge/ChallengeDeck';
import ChallengeBrowser from '../components/challenge/ChallengeBrowser';
import ChallengePrompt from '../components/challenge/ChallengePrompt';
import CardGameHint from '../components/challenge/CardGameHint';
import ChallengeRatingOverlay from '../components/challenge/ChallengeRatingOverlay';
import FocusedStatusBar from '../components/common/FocusedStatusBar';
import { useExitCardFeedback } from '../hooks/useExitCardFeedback';
import { CARD_ASPECT } from '../components/challenge/cardLayout';
import type { CardSize } from '../components/challenge/cardLayout';
import { colors } from '../theme/colors';

// The card takes this share of the screen width, up to a cap for large phones.
const CARD_WIDTH_SHARE = 0.74;
const MAX_GAME_CARD_WIDTH = 340;
const MIN_GAME_CARD_WIDTH = 150;
// Vertical room the deck needs beyond the card itself: the deckArea padding plus the
// two cards resting a few pixels below the top one.
const DECK_VERTICAL_RESERVE = 16 * 2 + 16;
// The draw button never gets narrower than this, even next to a small card.
const MIN_BUTTON_WIDTH = 240;

export default function SparringChallengeScreen(): React.ReactElement {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { profile } = useProfile();
  const { width: windowWidth } = useWindowDimensions();
  const [browserVisible, setBrowserVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [drawing, setDrawing] = useState(false);
  // Mirrors `drawing` synchronously: two taps in the same frame must not both draw.
  const drawingRef = useRef(false);
  const drawTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [drawKey, setDrawKey] = useState(0);
  const deckRef = useRef<ChallengeDeckHandle>(null);
  const [deckHeight, setDeckHeight] = useState<number | null>(null);

  // About three quarters of the width, but never taller than the room the deck area
  // really has — on short phones header, prompt, deck and button must all fit. The
  // deck waits for that measurement, so the card never jumps in size.
  const cardSize = useMemo<CardSize | null>(() => {
    if (deckHeight === null) return null;
    const byWidth  = Math.min(windowWidth * CARD_WIDTH_SHARE, MAX_GAME_CARD_WIDTH);
    const byHeight = (deckHeight - DECK_VERTICAL_RESERVE) * CARD_ASPECT;
    const width    = Math.round(Math.max(MIN_GAME_CARD_WIDTH, Math.min(byWidth, byHeight)));
    return { width, height: Math.round(width / CARD_ASPECT) };
  }, [deckHeight, windowWidth]);

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
    if (drawingRef.current || deckSize === 0) return;
    drawingRef.current = true;
    setDrawing(true);
    setDrawKey((k) => k + 1);
    draw();
    drawTimer.current = setTimeout(() => {
      drawingRef.current = false;
      setDrawing(false);
    }, DRAW_ANIMATION_MS + 40);
  }, [deckSize, draw]);

  const feedback = useExitCardFeedback(current);

  const areaCards = playableChallengesForArea(area);
  const deckEmpty = deckSize === 0;
  const hasCard   = current !== null;

  const status = !deckEmpty && remaining === 0 ? t('challenge.deckFinished') : null;
  const canPickArea = !loading && areaChosen && availableChallengeAreas().length >= 2;
  const buttonWidth = cardSize === null
    ? undefined
    : { width: Math.min(windowWidth - 32, Math.max(cardSize.width, MIN_BUTTON_WIDTH)) };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <FocusedStatusBar style="light" />
      <ChallengeHeader
        title={t('challenge.screen.title')}
        icon="chevron-back"
        iconLabel={t('common.back')}
        onPress={() => navigation.goBack()}
        right={canPickArea ? (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setPickerVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('challenge.screen.settings')}
            accessibilityHint={t('challenge.screen.changeDiscipline')}
          >
            <Ionicons name="settings-outline" size={22} color={colors.headerTextPrimary} />
          </TouchableOpacity>
        ) : undefined}
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
          <View style={styles.subBar}>
            <Text style={styles.areaLabel} numberOfLines={1} maxFontSizeMultiplier={1.4}>
              {t(`challenge.areas.${area}`)}
            </Text>
            <TouchableOpacity
              style={styles.collectionBtn}
              onPress={() => setBrowserVisible(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Ionicons name="albums-outline" size={16} color={colors.headerTextSecondary} />
              <Text style={styles.collectionLabel} maxFontSizeMultiplier={1.4}>{t('challenge.screen.collection')}</Text>
            </TouchableOpacity>
          </View>

          <ChallengePrompt revealed={hasCard} deckEmpty={deckEmpty} />

          <View style={styles.deckArea} onLayout={onDeckLayout}>
            {cardSize !== null ? (
              <ChallengeDeck
                ref={deckRef}
                card={current}
                drawKey={drawKey}
                size={cardSize}
                onDraw={handleDraw}
                disabled={deckEmpty || drawing}
              />
            ) : null}
          </View>

          <View style={styles.actions}>
            {status !== null ? <Text style={styles.status}>{status}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.drawBtn,
                hasCard ? styles.drawBtnSecondary : styles.drawBtnPrimary,
                buttonWidth,
                pressed && (hasCard ? styles.drawBtnSecondaryPressed : styles.drawBtnPrimaryPressed),
                deckEmpty && styles.btnDisabled,
              ]}
              // Through the deck, so the played card starts leaving in the same frame.
              onPress={() => deckRef.current?.draw()}
              disabled={deckEmpty || drawing}
              accessibilityRole="button"
              accessibilityState={{ disabled: deckEmpty || drawing }}
            >
              <Text style={styles.drawLabel} maxFontSizeMultiplier={1.4}>
                {hasCard ? t('challenge.screen.newCard') : t('challenge.screen.drawCard')}
              </Text>
            </Pressable>
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
          onRate={feedback.rate}
          onSkip={feedback.skip}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.gameBackground,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },

  // Discipline on the left, the quiet way into the card collection on the right.
  subBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingLeft: 16,
    paddingRight: 8,
    marginBottom: 16,
  },
  areaLabel: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.headerTextSecondary,
  },
  collectionBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  collectionLabel: {
    fontSize: 14,
    fontWeight: '600',
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  status: {
    marginBottom: 16,
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },
  drawBtn: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 16,
  },
  drawBtnPrimary: {
    backgroundColor: colors.accentBlue,
  },
  drawBtnPrimaryPressed: {
    backgroundColor: colors.accentBluePressed,
    transform: [{ scale: 0.98 }],
  },
  // After the reveal the card leads; drawing again steps back to a quieter surface.
  drawBtnSecondary: {
    backgroundColor: colors.gameSurface,
    borderWidth: 1,
    borderColor: colors.headerDotFuture,
  },
  drawBtnSecondaryPressed: {
    backgroundColor: colors.headerCard,
    transform: [{ scale: 0.98 }],
  },
  btnDisabled: {
    opacity: 0.5,
  },
  drawLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.headerTextPrimary,
    textAlign: 'center',
  },
});
