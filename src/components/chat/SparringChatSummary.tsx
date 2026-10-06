import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import InvitationPreview from '../sparring/create/InvitationPreview';

export interface SparringSummaryData {
  discipline:  string;
  title:       string;
  scheduledAt: string;
  durationMin: number;
  address:     string;
  /** Linked gym or studio name, if any. */
  placeName:   string | null;
  notes:       string | null;
  accessNote:  string | null;
  signupCount: number;
  maxSlots:    number;
}

// Shown instead of the message list while a sparring chat is still empty:
// the meeting at a glance (same card as the create preview), then notes and
// access hint if the organizer wrote any. Only real data, missing parts are
// left out.
function SparringChatSummary({ data }: { data: SparringSummaryData }): React.ReactElement {
  const { t } = useTranslation();
  const left = Math.max(0, data.maxSlots - data.signupCount);
  const slotsText = left === 0 ? t('chat.summary.soldOut') : t('chat.summary.slotsLeft', { count: left });
  const notes = data.notes?.trim() ?? '';
  const access = data.accessNote?.trim() ?? '';

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <InvitationPreview
        badge={t('chat.summary.badge')}
        discipline={data.discipline}
        title={data.title}
        scheduledAtMs={new Date(data.scheduledAt).getTime()}
        gymName={data.placeName}
        address={data.address}
        atStudio={false}
        slotsText={slotsText}
        footnote={t('chat.summary.signedUp', { signupCount: data.signupCount, maxSlots: data.maxSlots })}
        durationMin={data.durationMin}
      />

      {notes.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.label}>{t('chat.summary.notes')}</Text>
          <Text style={styles.text}>{notes}</Text>
        </View>
      )}
      {access.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.label}>{t('chat.summary.access')}</Text>
          <Text style={styles.text}>{access}</Text>
        </View>
      )}

      <Text style={styles.invite}>{t('chat.summary.noMessages')}</Text>
    </ScrollView>
  );
}

export default React.memo(SparringChatSummary);

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  block: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 8,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  invite: {
    marginTop: 24,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
