import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  KeyboardAvoidingView, Platform, TextInput, Alert,
} from 'react-native';
import { colors } from '../../theme/colors';

type ResultType = 'win' | 'loss' | 'draw';
type MethodType = 'ko' | 'tko' | 'submission' | 'decision';

type AddFightSheetProps = {
  visible:  boolean;
  onClose:  () => void;
  onSaved:  () => void;
  addFight: (data: {
    result:        ResultType;
    method:        MethodType | null;
    opponent_name: string | null;
    organization:  string | null;
    fight_date:    string | null;
  }) => Promise<{ error: string | null }>;
};

const RESULTS: { key: ResultType; label: string }[] = [
  { key: 'win',  label: 'Sieg'          },
  { key: 'loss', label: 'Niederlage'    },
  { key: 'draw', label: 'Unentschieden' },
];

const METHODS: { key: MethodType; label: string }[] = [
  { key: 'ko',         label: 'KO'          },
  { key: 'tko',        label: 'TKO'         },
  { key: 'submission', label: 'Submission'  },
  { key: 'decision',   label: 'Entscheidung' },
];

function parseDateInput(input: string): string | null {
  const match = input.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match === null) return null;
  const d = match[1].padStart(2, '0');
  const m = match[2].padStart(2, '0');
  const y = match[3];
  const ts = new Date(`${y}-${m}-${d}T00:00:00`);
  if (isNaN(ts.getTime())) return null;
  return `${y}-${m}-${d}`;
}

export default function AddFightSheet({ visible, onClose, onSaved, addFight }: AddFightSheetProps): React.ReactElement {
  const [result,   setResult]   = useState<ResultType>('win');
  const [method,   setMethod]   = useState<MethodType | null>(null);
  const [opponent, setOpponent] = useState('');
  const [org,      setOrg]      = useState('');
  const [dateStr,  setDateStr]  = useState('');
  const [saving,   setSaving]   = useState(false);

  function handleClose(): void {
    setResult('win'); setMethod(null); setOpponent(''); setOrg(''); setDateStr('');
    onClose();
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    const fightDate = dateStr.trim().length > 0 ? parseDateInput(dateStr) : null;
    if (dateStr.trim().length > 0 && fightDate === null) {
      Alert.alert('Ungültiges Datum', 'Bitte im Format TT.MM.JJJJ eingeben.');
      setSaving(false);
      return;
    }
    const res = await addFight({
      result,
      method,
      opponent_name: opponent.trim().length > 0 ? opponent.trim() : null,
      organization:  org.trim().length > 0      ? org.trim()      : null,
      fight_date:    fightDate,
    });
    setSaving(false);
    if (res.error !== null) { Alert.alert('Fehler', res.error); return; }
    handleClose();
    onSaved();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Kampf eintragen</Text>

          <Text style={styles.fieldLabel}>Ergebnis</Text>
          <View style={styles.chipRow}>
            {RESULTS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.chip, result === key && styles.chipActive]}
                onPress={() => setResult(key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, result === key && styles.chipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Methode (optional)</Text>
          <View style={styles.methodRow}>
            {METHODS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.methodChip, method === key && styles.chipActive]}
                onPress={() => setMethod((prev) => prev === key ? null : key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, method === key && styles.chipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Gegner (optional)"
            placeholderTextColor={colors.inactive}
            value={opponent}
            onChangeText={setOpponent}
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="Organisation (optional, z. B. WAKO)"
            placeholderTextColor={colors.inactive}
            value={org}
            onChangeText={setOrg}
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="Datum (optional, TT.MM.JJJJ)"
            placeholderTextColor={colors.inactive}
            value={dateStr}
            onChangeText={setDateStr}
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
            onSubmitEditing={() => { void handleSave(); }}
          />

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={() => { void handleSave(); }}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnLabel}>{saving ? 'Speichern...' : 'Eintragen'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  fieldLabel:     { fontSize: 13, fontWeight: '600', color: colors.inactive },
  chipRow:        { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive:     { backgroundColor: colors.accentBlue, borderColor: colors.accentBlue },
  chipText:       { fontSize: 13, fontWeight: '600', color: colors.text },
  chipTextActive: { color: '#FFFFFF' },
  methodRow:      { flexDirection: 'row', gap: 8 },
  methodChip: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnLabel:    { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
