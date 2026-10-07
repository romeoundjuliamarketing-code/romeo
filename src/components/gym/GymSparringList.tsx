import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { useLanguage } from '../../i18n/language';
import { localeFor } from '../../utils/language';
import { disciplineLabel } from '../../utils/disciplineLabel';
import { sparringDisplayTitle } from '../../utils/sparringDisplayTitle';
import type { AppLanguage } from '../../utils/language';
import { formatDate } from '../../utils/formatDate';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { GymSparring, LoadStatus } from '../../hooks/useGyms';
import { PrimaryButton } from '../profil/ProfileParts';

const MONTHS: Record<AppLanguage, string[]> = {
  de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

function slotsLabel(free: number | null): string | null {
  if (free === null) return null;
  if (free === 0) return i18n.t('gym.sparringList.full');
  return i18n.t('gym.sparringList.slotsFree', { count: free });
}

// Upcoming sparrings at a gym. The organizer is always named: a meeting in a
// gym is not an offer of the gym itself.
export default function GymSparringList({ sparrings, status, retry, onOpen, onOpenOrganizer, onPlan }: {
  sparrings:       GymSparring[];
  status:          LoadStatus;
  retry:           () => void;
  onOpen:          (sparringId: string) => void;
  onOpenOrganizer: (userId: string) => void;
  onPlan:          () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { language } = useLanguage();
  if (status === 'loading' && sparrings.length === 0) return <ActivityIndicator color={colors.accentBlue} />;
  if (status === 'error' && sparrings.length === 0) {
    return (
      <View style={styles.state}>
        <Text style={styles.muted}>{t('gym.sparringList.loadError')}</Text>
        <TouchableOpacity style={styles.retry} onPress={retry} accessibilityRole="button">
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  // Empty: one light blue block in which message and action belong together.
  if (sparrings.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{t('gym.sparringList.empty')}</Text>
        <PrimaryButton icon="add" label={t('gym.sparringList.plan')} onPress={onPlan} />
      </View>
    );
  }

  return (
    <View>
      {sparrings.map((s, i) => {
        const d = new Date(s.scheduled_at);
        const time = formatDate(d, 'time', language);
        const weekday = new Intl.DateTimeFormat(localeFor(language), { weekday: 'short' }).format(d);
        const organizer = s.organizer?.name ?? t('gym.sparringList.organizerFallback');
        const slots = slotsLabel(s.free_slots);
        return (
          <View key={s.id} style={[styles.row, i > 0 && styles.rowBorder]}>
            <TouchableOpacity
              style={styles.main}
              onPress={() => onOpen(s.id)}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={t('gym.sparringList.openOnMap', { title: sparringDisplayTitle(s.title, language), date: formatDate(d, 'date', language), time })}
            >
              <View style={styles.date}>
                <Text style={styles.day}>{d.getDate()}</Text>
                <Text style={styles.month}>{MONTHS[language][d.getMonth()]}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.title} numberOfLines={2}>{sparringDisplayTitle(s.title, language)}</Text>
                <Text style={styles.muted}>{t('gym.sparringList.when', { weekday, time, discipline: disciplineLabel(s.discipline, language) })}</Text>
                {slots !== null && (
                  <Text style={[styles.slots, s.free_slots === 0 && styles.slotsFull]}>{slots}</Text>
                )}
                {s.access_note !== null && s.access_note.length > 0 && (
                  <Text style={styles.note}>{t('gym.sparringList.access', { note: s.access_note })}</Text>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onOpenOrganizer(s.created_by)} hitSlop={8} accessibilityRole="link" style={styles.organizer}>
              <Text style={styles.muted}>
                <Trans i18nKey="gym.sparringList.organizedBy" values={{ name: organizer }} components={{ strong: <Text style={styles.organizerName} /> }} />
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    gap: 8,
  },
  empty: {
    gap:             12,
    padding:         16,
    borderRadius:    16,
    backgroundColor: colors.accentBlueTint,
  },
  emptyText: {
    fontSize:   16,
    lineHeight: 22,
    fontWeight: '600',
    color:      colors.text,
  },
  slots: {
    fontSize:   14,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },
  slotsFull: {
    color: colors.textMuted,
  },
  retry: {
    minHeight:      44,
    justifyContent: 'center',
    alignSelf:      'flex-start',
  },
  retryText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },
  row: {
    paddingVertical: 12,
    gap:             4,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  main: {
    flexDirection: 'row',
    gap:           16,
  },
  date: {
    width:      48,
    alignItems: 'center',
  },
  day: {
    fontFamily: fonts.display,
    fontSize:   32,
    lineHeight: 34,
    color:      colors.text,
  },
  month: {
    fontSize:   13,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },
  flex: {
    flex: 1,
    gap:  4,
  },
  title: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.text,
  },
  muted: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.textMuted,
  },
  note: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.text,
  },
  organizer: {
    marginLeft: 64,
    minHeight:  32,
    justifyContent: 'center',
  },
  organizerName: {
    fontWeight: '700',
    color:      colors.text,
  },
});
