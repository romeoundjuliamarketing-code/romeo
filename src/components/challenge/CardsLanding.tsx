import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const BENEFITS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'layers-outline',
    title: 'Dein Repertoire erweitern',
    body: 'Probiere Angriffe und Vorbereitungen aus, zu denen du sonst selten greifst.',
  },
  {
    icon: 'eye-outline',
    title: 'Chancen erkennen und schaffen',
    body: 'Achte auf die Reaktion deines Partners und finde passende Gelegenheiten für deine Aufgabe.',
  },
  {
    icon: 'navigate-outline',
    title: 'Vorgaben umsetzen üben',
    body: 'Behalte einen konkreten Auftrag im laufenden Sparring im Blick – ähnlich wie eine Anweisung aus deiner Ecke.',
  },
];

// Compact entry above the card stage. Full width, so the headline never squeezes into
// a narrow column next to an illustration.
export function CardsHero(): React.ReactElement {
  return (
    <View style={styles.hero}>
      <Text style={styles.kicker}>SPARR KARTEN</Text>
      <Text style={styles.heroTitle} accessibilityRole="header">{'Deine nächste Runde.\nDeine nächste Aufgabe.'}</Text>
      <Text style={styles.heroBody}>Zieh eine Karte und setze die Übung im Sparring um.</Text>
      <View style={styles.disciplinePill}><Text style={styles.disciplineText}>Kickboxen / K1</Text></View>
    </View>
  );
}

const STEPS = ['Karte ziehen', 'Aufgabe verstehen', 'Im Sparring umsetzen'];

// Start button for everyone — the game route keeps its own access check — plus the
// three steps and the single way into the intro.
export function CardsStart({ onStart, onHowItWorks }: { onStart: () => void; onHowItWorks: () => void }): React.ReactElement {
  return (
    <View style={styles.start}>
      <TouchableOpacity style={styles.primaryButton} onPress={onStart} accessibilityRole="button">
        <Text style={styles.primaryButtonText}>Spiel starten</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.card} />
      </TouchableOpacity>
      <View style={styles.steps} accessible accessibilityLabel={STEPS.join(', dann ')}>
        {STEPS.map((step, i) => (
          <View key={step} style={styles.step}>
            {i > 0 ? <Ionicons name="arrow-forward" size={14} color={colors.accentBlueText} /> : null}
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity style={styles.howLink} onPress={onHowItWorks} accessibilityRole="button">
        <Text style={styles.howLinkText}>So funktioniert’s</Text>
      </TouchableOpacity>
    </View>
  );
}

export function CardsBenefits(): React.ReactElement {
  return (
    <View style={styles.benefits}>
      {BENEFITS.map((benefit) => (
        <View key={benefit.title} style={styles.benefitRow}>
          <View style={styles.benefitIcon}><Ionicons name={benefit.icon} size={24} color={colors.accentBlueText} /></View>
          <View style={styles.benefitCopy}>
            <Text style={styles.benefitTitle}>{benefit.title}</Text>
            <Text style={styles.bodyText}>{benefit.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function CardsOffer({ price, loading, onOpen }: { price: string | null; loading: boolean; onOpen: () => void }): React.ReactElement {
  return (
    <View style={styles.offer}>
      <Text style={styles.offerKicker}>DEIN ZUGANG</Text>
      <Text style={styles.offerTitle}>Das Kartenspiel freischalten</Text>
      <Text style={styles.offerBody}>Mit dem Karten-Abo erhältst du Zugang zum Kartenspiel. Wer auch eigene Sparrings erstellen will, nimmt das Paket. Die derzeit verfügbaren Karten sind für Kickboxen / K1.</Text>
      <Text style={styles.offerPrice}>{loading ? 'Angebot wird geladen …' : price ?? 'Preise im Angebot ansehen'}</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={onOpen} accessibilityRole="button">
        <Text style={styles.primaryButtonText}>Karten-Abo ansehen</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.card} />
      </TouchableOpacity>
      <Text style={styles.offerFootnote}>Abrechnung und Kauf erfolgen im nächsten Schritt. Käufe wiederherstellen ist dort ebenfalls möglich.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8 },
  kicker: { color: colors.accentBlueText, fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 2 },
  heroTitle: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 38 },
  heroBody: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 24 },
  disciplinePill: { alignSelf: 'flex-start', marginTop: 8, borderColor: colors.hairline, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4 },
  disciplineText: { color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  start: { gap: 16 },
  steps: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', rowGap: 4, columnGap: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepText: { color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
  howLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  howLinkText: { color: colors.accentBlueText, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  primaryButton: { minHeight: 48, backgroundColor: colors.accentBlue, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButtonText: { color: colors.card, fontFamily: 'Inter_700Bold', fontSize: 15 },
  benefits: { gap: 8 },
  benefitRow: { flexDirection: 'row', gap: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  benefitIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.accentBlueTint, alignItems: 'center', justifyContent: 'center' },
  benefitCopy: { flex: 1, gap: 8 },
  benefitTitle: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 17, lineHeight: 24 },
  bodyText: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 24 },
  offer: { backgroundColor: colors.dark, borderRadius: 24, padding: 24, gap: 16 },
  offerKicker: { color: colors.headerTextSecondary, fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 2 },
  offerTitle: { color: colors.card, fontFamily: 'Inter_700Bold', fontSize: 24, lineHeight: 32 },
  offerBody: { color: colors.headerTextPrimary, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 24 },
  offerPrice: { color: colors.card, fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 24 },
  offerFootnote: { color: colors.headerTextSecondary, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 20 },
});
