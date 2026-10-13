import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';

// Small pill at the bottom of a scroll area: signals more content below and
// scrolls there on tap.
function ScrollMoreHint({ onPress }: { onPress: () => void }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      style={styles.pill}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t('sparring.flow.scrollMore')}
    >
      <Text style={styles.text}>{t('sparring.flow.scrollMore')}</Text>
      <Ionicons name="chevron-down" size={16} color={colors.headerTextPrimary} />
    </TouchableOpacity>
  );
}

export default React.memo(ScrollMoreHint);

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: colors.dark,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.headerTextPrimary,
  },
});
