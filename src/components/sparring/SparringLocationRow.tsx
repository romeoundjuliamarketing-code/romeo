import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { SparringLocationLines } from '../../utils/sparringDetail';
import { useTranslation } from 'react-i18next';

// Where the sparring takes place: place first, address details below.
export default function SparringLocationRow({ primary, secondary }: SparringLocationLines): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.row} accessible accessibilityLabel={t('sparring.locationRow.a11y', { place: `${primary}${secondary !== null ? `, ${secondary}` : ''}` })}>
      <View style={styles.iconCircle}>
        <Ionicons name="location" size={18} color={colors.accentBlue} />
      </View>
      <View style={styles.texts}>
        <Text style={styles.primary}>{primary}</Text>
        {secondary !== null && <Text style={styles.secondary}>{secondary}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           16,
  },
  iconCircle: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: colors.accentBlueSoft,
    alignItems:      'center',
    justifyContent:  'center',
  },
  texts: {
    flex: 1,
  },
  primary: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.text,
  },
  secondary: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.textSecondary,
  },
});
