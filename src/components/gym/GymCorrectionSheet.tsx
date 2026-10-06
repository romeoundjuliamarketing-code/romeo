import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { suggestGymCorrection } from '../../hooks/useGyms';
import type { Gym } from '../../hooks/useGyms';
import { useBannedWords } from '../../hooks/useBannedWords';
import { checkText, filterErrorMessage } from '../../utils/contentFilter';
import { GYM_LIMITS } from '../../utils/gymSearch';
import { PrimaryButton } from '../profil/ProfileParts';
import SheetShell, { useMountedOnce } from '../common/SheetShell';
import LabeledInput from '../common/LabeledInput';

interface Props {
  gym:     Gym;
  visible: boolean;
  onClose: () => void;
}

// Mounted from the first opening on; each opening starts from the gym's data (key).
export default function GymCorrectionSheet(props: Props): React.ReactElement | null {
  const mounted = useMountedOnce(props.visible);
  const [openCount, setOpenCount] = useState(0);
  const [wasVisible, setWasVisible] = useState(props.visible);
  if (props.visible !== wasVisible) {
    setWasVisible(props.visible);
    if (props.visible) setOpenCount((n) => n + 1);
  }
  return mounted ? <CorrectionForm key={openCount} {...props} /> : null;
}

// Value only if the user really changed it.
const changed = (value: string, original: string): string | null =>
  value.trim() !== original.trim() && value.trim().length > 0 ? value.trim() : null;

// "Korrektur vorschlagen": proposals are stored for review and never change
// the shared gym entry directly. Only fields the user actually changed are sent.
function CorrectionForm({ gym, visible, onClose }: Props): React.ReactElement {
  const { bannedWords } = useBannedWords();
  const [name, setName] = useState(gym.name);
  const [city, setCity] = useState(gym.city);
  const [address, setAddress] = useState(gym.address ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send(): Promise<void> {
    const proposal = {
      name:    changed(name, gym.name),
      city:    changed(city, gym.city),
      address: changed(address, gym.address ?? ''),
      note:    note.trim().length > 0 ? note.trim() : null,
    };
    const texts = Object.values(proposal).filter((v): v is string => v !== null);
    if (texts.length === 0) {
      setError('Ändere ein Feld oder beschreibe kurz, was nicht stimmt.');
      return;
    }
    if (proposal.name !== null && proposal.name.length < 2) { setError('Der Name braucht mindestens 2 Zeichen.'); return; }
    if (proposal.city !== null && proposal.city.length < 2) { setError('Die Stadt braucht mindestens 2 Zeichen.'); return; }
    for (const text of texts) {
      const verdict = checkText(text, bannedWords);
      if (!verdict.ok) { setError(filterErrorMessage(verdict.category)); return; }
    }
    setSending(true);
    const result = await suggestGymCorrection({ gymId: gym.id, ...proposal });
    setSending(false);
    if (result.error !== null) { setError(result.error); return; }
    setSent(true);
  }

  return (
    <SheetShell visible={visible} title="Korrektur vorschlagen" onClose={onClose} busy={sending}>
      {sent ? (
        <View style={styles.done}>
          <Ionicons name="checkmark-circle" size={32} color={colors.accentBlue} />
          <Text style={styles.doneText}>Danke! Wir prüfen deinen Vorschlag, bevor sich der Eintrag ändert.</Text>
          <PrimaryButton icon="checkmark" label="Fertig" onPress={onClose} />
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
          <Text style={styles.hint}>Der Eintrag wird von allen geteilt. Dein Vorschlag wird erst nach einer Prüfung übernommen.</Text>
          <LabeledInput label="Name" value={name} onChange={setName} max={GYM_LIMITS.name} />
          <LabeledInput label="Stadt" value={city} onChange={setCity} max={GYM_LIMITS.city} />
          <LabeledInput label="Adresse" value={address} onChange={setAddress} max={GYM_LIMITS.address} />
          <LabeledInput label="Was stimmt nicht? (optional)" value={note} onChange={setNote} max={GYM_LIMITS.note} multiline />
          {error !== null && <Text style={styles.error}>{error}</Text>}
          <PrimaryButton icon="send" label="Vorschlag senden" loading={sending} onPress={() => { void send(); }} />
        </ScrollView>
      )}
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap:           16,
    paddingBottom: 16,
  },
  hint: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.textMuted,
  },
  error: {
    fontSize: 13,
    color:    colors.deleteRed,
  },
  done: {
    alignItems:      'center',
    gap:             16,
    paddingVertical: 24,
  },
  doneText: {
    fontSize:   15,
    lineHeight: 22,
    color:      colors.text,
    textAlign:  'center',
  },
});
