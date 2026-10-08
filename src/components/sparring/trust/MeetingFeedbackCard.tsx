import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { SPARRING_TRUST } from '../../../data/sparringConfig';
import { useLanguage } from '../../../i18n/language';
import { formatDate } from '../../../utils/formatDate';
import { useSparringTrustActions } from '../../../hooks/useSparringTrustActions';
import { openLocationSettings } from '../../../hooks/useDeviceFix';
import type { MeetingAnswer } from '../../../types/sparringTrust';
import type { TrustAction } from '../../../utils/sparringTrust';
import TrustNoticeCard, { type TrustProblem } from './TrustNoticeCard';
import type { TrustPanel } from './useTrustPanel';

const NOTE_MAX = 280;
const ANSWERS: MeetingAnswer[] = ['happened', 'cancelled', 'problem'];

// "Hat euer Sparring stattgefunden?" after the planned end. Success texts only
// appear after the server confirmed the answer; the unlock message only when
// the server reports that the radius was really unlocked.
export default function MeetingFeedbackCard({ panel, sparringId, sparringTitle: _title }: {
  panel: TrustPanel;
  sparringId: string;
  sparringTitle: string;
}): React.ReactElement | null {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { submitFeedback } = useSparringTrustActions();
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<TrustProblem | null>(null);
  const [done, setDone] = useState<{ unlocked: boolean } | null>(null);
  const [lastAnswer, setLastAnswer] = useState<MeetingAnswer | null>(null);
  const { state } = panel;
  if (state === null) return null;

  async function send(answer: MeetingAnswer): Promise<void> {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    setLastAnswer(answer);
    const trimmed = note.trim();
    const out = await submitFeedback(sparringId, answer, answer === 'problem' && trimmed.length > 0 ? trimmed : null);
    setBusy(false);
    if (out.kind === 'ok') {
      setDone({ unlocked: out.data.unlocked });
      panel.refetch();
      panel.onReachChanged();
    } else if (out.kind === 'refused') {
      setProblem({ kind: 'refused', refusal: out.refusal });
    } else if (out.kind === 'location') {
      setProblem({ kind: 'location', error: out.error });
    } else {
      setProblem({ kind: 'network' });
    }
  }

  function onAction(action: TrustAction): void {
    if (action === 'settings') openLocationSettings();
    else if (action === 'retry' && lastAnswer !== null) void send(lastAnswer);
  }

  if (done !== null) {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name={done.unlocked ? 'trophy-outline' : 'checkmark-circle-outline'} size={24} color={colors.text} />
          <View style={styles.texts}>
            {done.unlocked ? (
              <>
                <Text style={styles.heading}>{t('sparringTrust.unlock.title', { km: SPARRING_TRUST.radiusUnlockedKm })}</Text>
                <Text style={styles.body}>{t('sparringTrust.unlock.body')}</Text>
              </>
            ) : (
              <Text style={styles.body}>{t('sparringTrust.feedback.thanks')}</Text>
            )}
          </View>
        </View>
      </View>
    );
  }

  if (state.feedback_answer != null) {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="checkmark-circle-outline" size={24} color={colors.text} />
          <Text style={styles.text}>
            {t('sparringTrust.feedback.answered', { answer: t(`sparringTrust.feedback.${state.feedback_answer}` as const) })}
          </Text>
        </View>
      </View>
    );
  }

  if (state.can_feedback !== true) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.heading} accessibilityRole="header">{t('sparringTrust.feedback.question')}</Text>
      {state.feedback_closes_at !== undefined && (
        <Text style={styles.muted}>
          {t('sparringTrust.feedback.until', { time: formatDate(state.feedback_closes_at, 'dateTime', language) })}
        </Text>
      )}
      {ANSWERS.map((a) => (
        <TouchableOpacity
          key={a}
          style={[styles.answer, a === 'problem' && showNote && styles.answerActive]}
          disabled={busy}
          onPress={() => { if (a === 'problem') setShowNote(true); else void send(a); }}
          accessibilityRole="button"
        >
          <Text style={styles.answerText}>{t(`sparringTrust.feedback.${a}` as const)}</Text>
        </TouchableOpacity>
      ))}
      {showNote && (
        <>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            maxLength={NOTE_MAX}
            multiline
            placeholder={t('sparringTrust.feedback.notePlaceholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('sparringTrust.feedback.notePlaceholder')}
          />
          <TouchableOpacity style={styles.send} disabled={busy} onPress={() => { void send('problem'); }} accessibilityRole="button">
            {busy ? <ActivityIndicator color={colors.card} /> : <Text style={styles.sendText}>{t('sparringTrust.feedback.send')}</Text>}
          </TouchableOpacity>
        </>
      )}
      {problem !== null && <TrustNoticeCard problem={problem} onAction={onAction} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.background, borderRadius: 16, padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  texts: { flex: 1, gap: 8 },
  heading: { fontSize: 16, fontWeight: '800', color: colors.text },
  text: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.text },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  muted: { fontSize: 14, color: colors.textMuted },
  answer: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  answerActive: { borderColor: colors.accentBlue },
  answerText: { fontSize: 15, fontWeight: '600', color: colors.text },
  input: {
    minHeight: 80,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 16,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: 'top',
  },
  send: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontSize: 16, fontWeight: '700', color: colors.card },
});
