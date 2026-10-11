import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { SparringLocationLines } from '../../utils/sparringDetail';
import { useTranslation } from 'react-i18next';

// Where the sparring takes place: a small pin, the place in bold and the
// address / meeting-point kind below (already privacy-filtered by the caller).
export default function SparringLocationRow({ primary, secondary, distance = null }: SparringLocationLines & {
  /** Already formatted distance from the map search, when known. */
  distance?: string | null;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.row} accessible accessibilityLabel={t('sparring.locationRow.a11y', { place: [primary, secondary, distance].filter((v) => v !== null).join(', ') })}>
      <Ionicons name="location-sharp" size={18} color={colors.accentBlue} style={styles.pin} />
      <View style={styles.texts}>
        <Text style={styles.primary}>{primary}</Text>
        {(secondary !== null || distance !== null) && (
          <Text style={styles.secondary}>{[secondary, distance].filter((v) => v !== null).join(' · ')}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           8,
  },
  pin: {
    marginTop: 2,
  },
  texts: {
    flex: 1,
    gap:  2,
  },
  primary: {
    fontSize:   17,
    lineHeight: 22,
    fontWeight: '800',
    color:      colors.text,
  },
  secondary: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.textMuted,
  },
});
