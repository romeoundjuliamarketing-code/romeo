import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

// Static legal notice (Impressum) per § 5 DDG. Content mirrors Impressum-Sparr.md.
const CONTACT_EMAIL = 'romeoundjuliamarketing@gmail.com';

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function ImpressumScreen(): React.ReactElement {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={18} color={colors.headerTextPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Impressum</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Section title="Angaben gemäß § 5 DDG">
          <Text style={styles.bodyText}>Romeo Georgiadis</Text>
          <Text style={styles.bodyText}>Rahrdumer Schweiz 38</Text>
          <Text style={styles.bodyText}>26441 Jever</Text>
          <Text style={styles.bodyText}>Deutschland</Text>
        </Section>

        <Section title="Kontakt">
          <TouchableOpacity onPress={() => { void Linking.openURL(`mailto:${CONTACT_EMAIL}`); }} activeOpacity={0.7}>
            <Text style={styles.linkText}>{CONTACT_EMAIL}</Text>
          </TouchableOpacity>
        </Section>

        <Section title="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
          <Text style={styles.bodyText}>Romeo Georgiadis</Text>
          <Text style={styles.bodyText}>Rahrdumer Schweiz 38</Text>
          <Text style={styles.bodyText}>26441 Jever</Text>
        </Section>

        <Section title="Verbraucherstreitbeilegung">
          <Text style={styles.bodyText}>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.dark,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.headerCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.headerTextPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 48,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  linkText: {
    fontSize: 15,
    color: colors.accentBlue,
    lineHeight: 22,
    fontWeight: '600',
  },
});
