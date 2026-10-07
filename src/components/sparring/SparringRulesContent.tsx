import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import {
  SPARRING_RULES,
  SPARRING_RULES_INTRO,
  SPARRING_RULES_PREAMBLE,
} from '../../data/sparringRules';
import { useLocalized } from '../../i18n/language';

// Full Sparr-Grundregeln text. Shared by SparringRulesScreen and the rules
// overlay inside SparringRulesConsentSheet — render it inside a ScrollView.
export default function SparringRulesContent(): React.ReactElement {
  const tx = useLocalized();
  return (
    <>
      <Text style={styles.preamble}>{tx(SPARRING_RULES_PREAMBLE)}</Text>

      {/* Core principle — framed above the numbered rules, not one of them. */}
      <View style={styles.introCard}>
        <Text style={styles.introTitle}>{tx(SPARRING_RULES_INTRO.title)}</Text>
        {SPARRING_RULES_INTRO.paragraphs.map((paragraph) => (
          <Text key={paragraph.de} style={styles.introBody}>{tx(paragraph)}</Text>
        ))}
      </View>

      {SPARRING_RULES.map((rule) => (
        <View key={rule.number} style={styles.rule}>
          <View style={styles.ruleHeader}>
            <View style={styles.numberBadge}>
              <Text style={styles.numberText}>{rule.number}</Text>
            </View>
            <Text style={styles.ruleTitle}>{tx(rule.title)}</Text>
          </View>
          <Text style={styles.ruleBody}>{tx(rule.body)}</Text>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
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
