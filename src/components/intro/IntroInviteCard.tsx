import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

// Compact invitation of the intro's sparring step. Shows only what it is
// given: real data of a found sparring, or the clearly labelled local
// example. Purely presentational, no handlers, no ids.
export default function IntroInviteCard({ label, title, subtitle, dateLine, placeLine, example = false }: {
  /** Band text: the discipline, or "Beispiel · kein echtes Treffen". */
  label:     string;
  title:     string;
  subtitle:  string;
  dateLine:  string;
  placeLine: string;
  example?:  boolean;
}): React.ReactElement {
  return (
    <View style={[styles.card, example && styles.cardExample]}>
      <View style={styles.band}>
        {example && <Ionicons name="eye-outline" size={16} color={colors.accentBlueText} />}
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={20} color={colors.brandPrimary} />
          <Text style={styles.rowText}>{dateLine}</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="location-outline" size={20} color={colors.brandPrimary} />
          <Text style={styles.rowText}>{placeLine}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius:    16,
    borderWidth:     1.5,
    borderColor:     colors.hairline,
    backgroundColor: colors.card,
    overflow:        'hidden',
  },
  cardExample: { borderColor: colors.brandPrimary },
  band: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 16,
    paddingVertical:   8,
    backgroundColor:   colors.accentBlueTint,
  },
  label: {
    flex:          1,
    fontSize:      13,
    lineHeight:    18,
    fontWeight:    '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color:         colors.accentBlueText,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop:        16,
    paddingBottom:     16,
    gap:               8,
  },
  title: {
    fontSize:   20,
    lineHeight: 26,
    fontWeight: '800',
    color:      colors.text,
  },
  subtitle: {
    fontSize:   15,
    lineHeight: 21,
    color:      colors.textMuted,
  },
  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  rowText: {
    flex:       1,
    fontSize:   16,
    lineHeight: 22,
    color:      colors.text,
  },
});
