import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { TextAction } from '../../common/TextAction';
import { useLanguage } from '../../../i18n/language';
import { sparringDisplayTitle } from '../../../utils/sparringDisplayTitle';
import type { FeedbackDue } from '../../../hooks/useFeedbackDue';

// Compact Home prompt for an ended sparring that still awaits the answer.
export default function FeedbackDueCard({ due, onOpen }: {
  due: FeedbackDue;
  onOpen: (sparringId: string) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { language } = useLanguage();
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="checkmark-done-outline" size={24} color={colors.text} />
        <View style={styles.texts}>
          <Text style={styles.title}>{t('sparringTrust.feedback.promptTitle')}</Text>
          <Text style={styles.body}>
            {t('sparringTrust.feedback.promptBody', { title: sparringDisplayTitle(due.title, language) })}
          </Text>
        </View>
      </View>
      <TextAction label={t('sparringTrust.feedback.promptAction')} onPress={() => onOpen(due.id)} trailingIcon="chevron-forward" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 16,
    gap: 8,
  },
  row: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  texts: { flex: 1, gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
});
