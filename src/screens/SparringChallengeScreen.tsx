import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { areaLabel, challengesForArea } from '../data/sparringChallenges';
import { useProfile } from '../hooks/useProfile';
import { useSparringChallenge } from '../hooks/useSparringChallenge';
import ChallengeAreaTabs from '../components/challenge/ChallengeAreaTabs';
import ChallengeDeck, { DRAW_ANIMATION_MS } from '../components/challenge/ChallengeDeck';
import ChallengeBrowser from '../components/challenge/ChallengeBrowser';
import { useCardSize } from '../components/challenge/cardLayout';
import { colors } from '../theme/colors';

export default function SparringChallengeScreen(): React.ReactElement {
  const navigation = useNavigation();
  const { profile } = useProfile();
  const [browserVisible, setBrowserVisible] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const drawTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardSize = useCardSize();

  const {
    area,
    setArea,
    current,
    deckSize,
    remaining,
    draw,
    toggleDone,
    isDone,
    doneCount,
    loading,
  } = useSparringChallenge(profile?.disciplines ?? []);

  useEffect(() => () => {
    if (drawTimer.current !== null) clearTimeout(drawTimer.current);
  }, []);

  // Blocks a second draw while the card is still moving, so rapid taps cannot
  // burn through the deck.
  const handleDraw = useCallback((): void => {
    if (drawing || deckSize === 0) return;
    setDrawing(true);
    draw();
    drawTimer.current = setTimeout(() => setDrawing(false), DRAW_ANIMATION_MS + 40);
  }, [drawing, deckSize, draw]);

  const areaCards = challengesForArea(area);
  const deckEmpty = deckSize === 0;
  const hasCard   = current !== null;
  const cardDone  = current !== null && isDone(current.id);

  const counter = deckEmpty
    ? null
    : remaining === 0
      ? `Deck durchgespielt · ${doneCount} geschafft`
      : `${remaining} ${remaining === 1 ? 'Karte' : 'Karten'} übrig · ${doneCount} geschafft`;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
        >
          <Ionicons name="chevron-back" size={26} color={colors.headerTextPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sparrings-Challenge</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accentBlue} />
        </View>
      ) : (
        <View style={styles.body}>
          <ChallengeAreaTabs area={area} onSelect={setArea} />

          <View style={styles.deckArea}>
            <ChallengeDeck card={current} done={cardDone} empty={deckEmpty} size={cardSize} />
          </View>

          <View style={styles.actions}>
            {counter !== null ? <Text style={styles.counter}>{counter}</Text> : null}

            {hasCard ? (
              <>
                <TouchableOpacity
                  style={[styles.primaryBtn, cardDone && styles.primaryBtnDone]}
                  onPress={() => { if (current !== null) toggleDone(current.id); }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: cardDone }}
                >
                  <Ionicons
                    name={cardDone ? 'checkmark-circle' : 'checkmark'}
                    size={20}
                    color={cardDone ? colors.accentBlue : colors.headerTextPrimary}
                  />
                  <Text style={[styles.primaryLabel, cardDone && styles.primaryLabelDone]}>
                    Geschafft
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryBtn, drawing && styles.btnBusy]}
                  onPress={handleDraw}
                  activeOpacity={0.8}
                  disabled={drawing}
                  accessibilityRole="button"
                >
                  <Ionicons name="shuffle" size={18} color={colors.headerTextPrimary} />
                  <Text style={styles.secondaryLabel}>Neue Karte</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.primaryBtn, (deckEmpty || drawing) && styles.btnBusy]}
                onPress={handleDraw}
                activeOpacity={0.85}
                disabled={deckEmpty || drawing}
                accessibilityRole="button"
              >
                <Text style={styles.primaryLabel}>Karte ziehen</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => setBrowserVisible(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.linkLabel}>Alle Karten ansehen</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ChallengeBrowser
        visible={browserVisible}
        cards={areaCards}
        areaTitle={areaLabel(area)}
        onClose={() => setBrowserVisible(false)}
        isDone={isDone}
        onToggleDone={toggleDone}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  deckArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  actions: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  counter: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },

  primaryBtn: {
    width: '100%',
    maxWidth: 320,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.accentBlue,
  },
  primaryBtnDone: {
    backgroundColor: colors.accentBlueSoft,
    borderWidth: 1,
    borderColor: colors.accentBlue,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  primaryLabelDone: {
    color: colors.accentBlue,
  },

  secondaryBtn: {
    width: '100%',
    maxWidth: 320,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.headerBorder,
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '600',
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
    textDecorationLine: 'underline',
  },
});
