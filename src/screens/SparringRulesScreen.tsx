import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import {
  SPARRING_RULES,
  SPARRING_RULES_INTRO,
  SPARRING_RULES_PREAMBLE,
} from '../data/sparringRules';

// Full Sparr-Grundregeln, reachable from Einstellungen > Rechtliches and from
// the consent sheet shown before every sparring signup.
export default function SparringRulesScreen(): React.ReactElement {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={18} color={colors.headerTextPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sparr-Grundregeln</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.preamble}>{SPARRING_RULES_PREAMBLE}</Text>

        {/* Core principle — framed above the numbered rules, not one of them. */}
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>{SPARRING_RULES_INTRO.title}</Text>
          {SPARRING_RULES_INTRO.paragraphs.map((paragraph) => (
            <Text key={paragraph} style={styles.introBody}>{paragraph}</Text>
          ))}
        </View>

        {SPARRING_RULES.map((rule) => (
          <View key={rule.number} style={styles.rule}>
            <View style={styles.ruleHeader}>
              <View style={styles.numberBadge}>
                <Text style={styles.numberText}>{rule.number}</Text>
              </View>
              <Text style={styles.ruleTitle}>{rule.title}</Text>
            </View>
            <Text style={styles.ruleBody}>{rule.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor:   colors.dark,
    paddingHorizontal: 16,
    paddingTop:        8,
    paddingBottom:     24,
    gap:               16,
  },
  backBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: colors.headerCard,
    alignItems:      'center',
    justifyContent:  'center',
  },
  headerTitle: {
    color:      colors.headerTextPrimary,
    fontSize:   22,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop:        24,
    paddingBottom:     48,
  },
  preamble: {
    fontSize:     15,
    lineHeight:   22,
    color:        colors.text,
    marginBottom: 24,
  },
  introCard: {
    backgroundColor:   colors.accentBlueSoft,
    borderRadius:      16,
    padding:           16,
    gap:               8,
    marginBottom:      24,
    borderLeftWidth:   4,
    borderLeftColor:   colors.accentBlue,
  },
  introTitle: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.text,
  },
  introBody: {
    fontSize:   14,
    lineHeight: 21,
    color:      colors.text,
  },
  rule: {
    marginBottom: 24,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginBottom:  8,
  },
  numberBadge: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: colors.dark,
    alignItems:      'center',
    justifyContent:  'center',
  },
  numberText: {
    color:      colors.headerTextPrimary,
    fontSize:   13,
    fontWeight: '700',
  },
  ruleTitle: {
    flex:       1,
    fontSize:   16,
    fontWeight: '700',
    color:      colors.text,
  },
  ruleBody: {
    fontSize:   15,
    lineHeight: 22,
    color:      colors.text,
  },
});
