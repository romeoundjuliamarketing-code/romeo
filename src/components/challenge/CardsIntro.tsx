import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';
import ChallengeCard from './ChallengeCard';
import { useStepEntrance } from './useStepEntrance';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const BENEFITS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'layers-outline',
    title: 'Neue Angriffe ausprobieren',
    body: 'Bring Abwechslung in dein Sparring und erweitere dein Repertoire.',
  },
  {
    icon: 'eye-outline',
    title: 'Chancen erkennen',
    body: 'Übe, die passende Situation für deine Aufgabe zu finden.',
  },
  {
    icon: 'navigate-outline',
    title: 'Vorgaben im Kampf umsetzen',
    body: 'Trainiere, einen konkreten Fokus unter Druck zu behalten – ähnlich wie bei einer Ansage aus deiner Ecke.',
  },
];

// Wide enough for the regular card type scale (ChallengeCard goes compact below 280).
const MAX_CARD_WIDTH = 288;

interface Props {
  card:            SparringChallenge | null;
  primaryLabel:    string;
  onPrimary:       () => void;
  // Omitted when the intro was opened on purpose — then there is nothing to skip.
  onSkip?:         () => void;
}

// One-screen introduction to the card game: a real card as the motif, three short
// benefits and one action. Scrolls as a whole, so nothing is cut off on small screens
// or with large system text, and the buttons never sit on top of content.
export default function CardsIntro({ card, primaryLabel, onPrimary, onSkip }: Props): React.ReactElement {
  const { width } = useWindowDimensions();
  const { cardStyle } = useStepEntrance();
  const cardWidth = Math.round(Math.min(width - 96, MAX_CARD_WIDTH));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.inner, cardStyle]}>
          <Text style={styles.kicker}>SPARR CARDS</Text>
          <Text style={styles.title} accessibilityRole="header">{'Eine Karte.\nEin neuer Fokus.'}</Text>

          {card !== null ? (
            <View style={styles.motif}>
              <View style={[styles.stackCard, styles.stackFar, { width: cardWidth }]} />
              <View style={[styles.stackCard, styles.stackNear, { width: cardWidth }]} />
              <ChallengeCard
                challenge={card}
                size={{ width: cardWidth, height: cardWidth }}
                scrollable={false}
                fitContent
              />
            </View>
          ) : null}

          <Text style={styles.lead}>
            Zieh eine Karte und setze die Übung im Sparring um. Dein Partner muss deine Karte nicht kennen.
          </Text>

          <View style={styles.benefits}>
            {BENEFITS.map((benefit) => (
              <View key={benefit.title} style={styles.benefitRow}>
                <Ionicons name={benefit.icon} size={24} color={colors.accentBlueText} />
                <View style={styles.benefitCopy}>
                  <Text style={styles.benefitTitle}>{benefit.title}</Text>
                  <Text style={styles.benefitBody}>{benefit.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.note}>Für Kickboxen / K1 · Kontrolliert und nach euren vereinbarten Regeln.</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={onPrimary} activeOpacity={0.85} accessibilityRole="button">
              <Text style={styles.primaryText}>{primaryLabel}</Text>
            </TouchableOpacity>
            {onSkip !== undefined ? (
              <TouchableOpacity style={styles.skipButton} onPress={onSkip} activeOpacity={0.7} accessibilityRole="button">
                <Text style={styles.skipText}>Überspringen</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  inner: { alignSelf: 'center', width: '100%', maxWidth: 520 },
  kicker: { color: colors.accentBlueText, fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 2 },
  title: { marginTop: 8, color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 38 },
  // Room at the top and right for the two cards peeking out behind the front card.
  motif: { alignSelf: 'center', marginTop: 32, marginBottom: 8, paddingTop: 8, paddingRight: 16 },
  stackCard: { position: 'absolute', top: 8, bottom: 0, left: 0, borderRadius: 24, borderWidth: 2, borderColor: colors.dark },
  stackFar: { backgroundColor: colors.cardStackFar, transform: [{ translateX: 16 }, { rotate: '6deg' }] },
  stackNear: { backgroundColor: colors.cardStackNear, transform: [{ translateX: 8 }, { rotate: '3deg' }] },
  lead: { marginTop: 24, color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 24 },
  benefits: { marginTop: 24, gap: 16 },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  benefitCopy: { flex: 1, gap: 4 },
  benefitTitle: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 16, lineHeight: 24 },
  benefitBody: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  note: { marginTop: 24, color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  actions: { marginTop: 24, gap: 8 },
  primaryButton: { minHeight: 48, borderRadius: 12, backgroundColor: colors.accentBlue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { color: colors.card, fontFamily: 'Inter_700Bold', fontSize: 15 },
  skipButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  skipText: { color: colors.accentBlueText, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});
