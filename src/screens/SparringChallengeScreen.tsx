import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { areaLabel, challengesForArea } from '../data/sparringChallenges';
import { useProfile } from '../hooks/useProfile';
import { useSparringChallenge } from '../hooks/useSparringChallenge';
import ChallengeAreaTabs from '../components/challenge/ChallengeAreaTabs';
import ChallengeDeck from '../components/challenge/ChallengeDeck';
import ChallengeBrowser from '../components/challenge/ChallengeBrowser';
import { colors } from '../theme/colors';

export default function SparringChallengeScreen(): React.ReactElement {
  const navigation = useNavigation();
  const { profile } = useProfile();
  const [browserVisible, setBrowserVisible] = useState(false);

  const {
    area,
    setArea,
    current,
    deckSize,
    draw,
    toggleDone,
    isDone,
    doneCount,
    loading,
  } = useSparringChallenge(profile?.disciplines ?? []);

  const areaCards = challengesForArea(area);
  const deckEmpty = deckSize === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
        >
          <Ionicons name="chevron-back" size={24} color={colors.headerTextPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sparrings-Challenge</Text>
        <View style={styles.backBtn} />
      </View>

      <ChallengeAreaTabs area={area} onSelect={setArea} />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accentBlue} />
        </View>
      ) : (
        <View style={styles.content}>
          <ChallengeDeck
            card={current}
            done={current !== null && isDone(current.id)}
            onToggleDone={() => { if (current !== null) toggleDone(current.id); }}
            empty={deckEmpty}
          />

          <Text style={styles.deckMeta}>
            {deckSize} {deckSize === 1 ? 'Karte' : 'Karten'} · {doneCount} erledigt
          </Text>

          <TouchableOpacity
            style={[styles.drawBtn, deckEmpty && styles.drawBtnDisabled]}
            onPress={() => { draw(); }}
            activeOpacity={0.8}
            disabled={deckEmpty}
            accessibilityRole="button"
          >
            <Text style={styles.drawLabel}>
              {current === null ? 'Karte ziehen' : 'Neue Karte ziehen'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.browseBtn}
            onPress={() => setBrowserVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Text style={styles.browseLabel}>Alle Karten ansehen</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.headerTextSecondary} />
          </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 16,
  },
  deckMeta: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },
  drawBtn: {
    width: '100%',
    maxWidth: 320,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawBtnDisabled: {
    opacity: 0.4,
  },
  drawLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  browseLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },
});
