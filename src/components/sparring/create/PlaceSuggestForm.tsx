import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { TextAction } from '../../common/TextAction';
import TrustNoticeCard, { type TrustProblem } from '../trust/TrustNoticeCard';
import { useSparringTrustActions } from '../../../hooks/useSparringTrustActions';
import { openLocationSettings } from '../../../hooks/useDeviceFix';
import type { TrustAction } from '../../../utils/sparringTrust';

// "Ort nicht gefunden?": small form that sends a place suggestion for manual
// review. It never creates a usable place by itself.
function PlaceSuggestForm({ onAction }: { onAction: (a: TrustAction) => void }): React.ReactElement {
  const { t } = useTranslation();
  const { suggestPlace } = useSparringTrustActions();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<TrustProblem | null>(null);

  async function send(): Promise<void> {
    if (busy || name.trim().length === 0 || address.trim().length === 0) return;
    setBusy(true);
    setProblem(null);
    const outcome = await suggestPlace(name.trim(), address.trim(), note.trim().length > 0 ? note.trim() : null);
    setBusy(false);
    if (outcome.kind === 'ok') {
      setSent(true);
      setName('');
      setAddress('');
      setNote('');
      return;
    }
    setProblem(outcome);
  }

  function handleAction(a: TrustAction): void {
    if (a === 'retry') { void send(); return; }
    if (a === 'settings') { openLocationSettings(); return; }
    onAction(a);
  }

  if (!open) {
    return <TextAction label={t('sparringTrust.create.suggestTitle')} icon="help-circle-outline" onPress={() => setOpen(true)} />;
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{t('sparringTrust.create.suggestTitle')}</Text>
      <Text style={styles.body}>{t('sparringTrust.create.suggestBody')}</Text>
      <TextInput
        style={styles.field}
        value={name}
        onChangeText={setName}
        placeholder={t('sparringTrust.create.suggestName')}
        placeholderTextColor={colors.textMuted}
        maxLength={80}
        accessibilityLabel={t('sparringTrust.create.suggestName')}
      />
      <TextInput
        style={styles.field}
        value={address}
        onChangeText={setAddress}
        placeholder={t('sparringTrust.create.suggestAddress')}
        placeholderTextColor={colors.textMuted}
        maxLength={200}
        accessibilityLabel={t('sparringTrust.create.suggestAddress')}
      />
      <TextInput
        style={styles.field}
        value={note}
        onChangeText={setNote}
        placeholder={t('sparringTrust.create.suggestNote')}
        placeholderTextColor={colors.textMuted}
        maxLength={300}
        accessibilityLabel={t('sparringTrust.create.suggestNote')}
      />
      <TouchableOpacity style={styles.send} onPress={() => { void send(); }} disabled={busy} accessibilityRole="button">
        {busy ? <ActivityIndicator color={colors.headerTextPrimary} /> : (
          <Text style={styles.sendText}>{t('sparringTrust.create.suggestSend')}</Text>
        )}
      </TouchableOpacity>
      {sent && <Text style={styles.sent} accessibilityLiveRegion="polite">{t('sparringTrust.create.suggestSent')}</Text>}
      {problem !== null && <TrustNoticeCard problem={problem} onAction={handleAction} />}
    </View>
  );
}

export default PlaceSuggestForm;

const styles = StyleSheet.create({
  box: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  field: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.background,
    fontSize: 16,
    color: colors.text,
  },
  send: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  sent: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
});
