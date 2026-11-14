import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { useLanguage } from '../../../i18n/language';
import { formatDate } from '../../../utils/formatDate';

interface Props {
  /** ISO time the creator subscription ends without renewal. */
  endsAt: string;
}

// Shown under the date when the private sparring lies after the end of a
// subscription that will not renew: the server cancels it at that point.
export default function SubscriptionEndNotice({ endsAt }: Props): React.ReactElement {
  const { t } = useTranslation();
  const { language } = useLanguage();
  return (
    <View style={styles.box} accessibilityRole="text">
      <Ionicons name="information-circle-outline" size={20} color={colors.accentBlueText} />
      <Text style={styles.text}>
        {t('sparring.flow.subscriptionEnds', { date: formatDate(endsAt, 'dateLong', language) })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.accentBlueTint,
  },
  text: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
});
