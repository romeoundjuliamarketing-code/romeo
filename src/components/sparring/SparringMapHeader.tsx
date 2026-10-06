import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useTranslation } from 'react-i18next';

interface Props {
  children: React.ReactNode;
  /** Set when the screen is opened as a full-screen modal (not the tab): shows a back button. */
  onBack?:  () => void;
}

// One warm surface on top of the map: mascot + "Finde dein Sparring", then
// the controls passed as children (category, search area, time filter). Kept
// as a single panel so the map is covered by one block instead of many pills.
export default function SparringMapHeader({ children, onBack }: Props): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.panel}>
      <View style={styles.titleRow}>
        {onBack !== undefined && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        <Image
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          source={require('../../../assets/logo-mark.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <Text style={styles.title} accessibilityRole="header">{t('map.header.title')}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.background,
    borderRadius:    20,
    padding:         8,
    gap:             8,
    shadowColor:     colors.dark,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.12,
    shadowRadius:    8,
    elevation:       4,
  },
  titleRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 8,
  },
  backBtn: {
    width:          32,
    height:         32,
    alignItems:     'center',
    justifyContent: 'center',
  },
  logo: {
    width:  32,
    height: 32,
  },
  title: {
    fontSize:      17,
    fontWeight:    '800',
    letterSpacing: -0.2,
    color:         colors.text,
  },
});
