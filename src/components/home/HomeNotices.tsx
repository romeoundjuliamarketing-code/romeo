import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useTranslation } from 'react-i18next';

// Compact notice under the Home header, only rendered when there is real data
// behind it — never as an empty or sample state.

export function AnnouncementNotice({ message, canDelete, onDelete }: {
  message:   string;
  canDelete: boolean;
  onDelete:  () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={[styles.notice, styles.noticeInfo]}>
      <Ionicons name="megaphone-outline" size={20} color={colors.accentBlue} />
      <View style={styles.textBlock}>
        <Text style={styles.infoLabel}>{t('home.notices.announcement')}</Text>
        <Text style={styles.infoBody}>{message}</Text>
      </View>
      {canDelete && (
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('home.notices.delete')}
        >
          <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  noticeInfo: {
    backgroundColor: colors.card,
  },
  textBlock: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  infoBody: {
    marginTop: 2,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
});
