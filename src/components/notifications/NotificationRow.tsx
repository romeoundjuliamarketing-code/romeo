import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { colors } from '../../theme/colors';
import { formatDate as formatDateLocalized } from '../../utils/formatDate';
import { useLanguage } from '../../i18n/language';
import type { AppLanguage } from '../../utils/language';
import type { AppNotification } from '../../types/database.types';

interface Props {
  item: AppNotification;
  onPress?: (item: AppNotification) => void;
}

// Formats a timestamptz ISO string as a short local date/time label.
function formatDate(iso: string, t: TFunction, language: AppLanguage): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return t('notifications.time.justNow');
  if (diffMin < 60) return t('notifications.time.minutesAgo', { count: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return t('notifications.time.hoursAgo', { count: diffH });
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7)    return t('notifications.time.daysAgo', { count: diffD });
  return formatDateLocalized(d, 'date', language);
}

export default function NotificationRow({ item, onPress }: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isUnread = item.read_at === null;
  return (
    <TouchableOpacity
      style={[styles.row, isUnread && styles.rowUnread]}
      activeOpacity={onPress !== undefined ? 0.7 : 1}
      disabled={onPress === undefined}
      onPress={() => onPress?.(item)}
    >
      {isUnread && <View style={styles.unreadDot} />}
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
        <Text style={styles.time}>{formatDate(item.created_at, t, language)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  rowUnread: {
    backgroundColor: colors.accentBlueSoft,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentBlue,
    marginTop: 6,
    marginRight: 8,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  time: {
    fontSize: 12,
    color: colors.inactive,
  },
});
