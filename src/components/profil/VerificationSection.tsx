import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useVerification } from '../../hooks/useVerification';
import VerifiedBadge from '../common/VerifiedBadge';

interface RowProps {
  label: string;
  done: boolean;
  hint: string;
}

function StatusRow({ label, done, hint }: RowProps) {
  return (
    <View style={styles.row}>
      <Ionicons
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={done ? colors.accentBlue : colors.inactive}
      />
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
    </View>
  );
}

export function VerificationSection({ refetchTrigger = 0 }: { refetchTrigger?: number }) {
  const { flags, tier, loading, updateAddress, updatePhone } = useVerification(refetchTrigger);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);

  const handleSave = async (
    value: string,
    updater: (v: string) => Promise<{ error: string | null }>,
    setSaving: (v: boolean) => void,
    resetField: () => void,
  ) => {
    if (value.trim().length === 0) return;
    setSaving(true);
    await updater(value);
    setSaving(false);
    resetField();
  };

  if (loading) {
    return <View style={styles.card}><ActivityIndicator color={colors.accentBlue} /></View>;
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Verifizierung</Text>
        <VerifiedBadge tier={tier} showLabel />
      </View>

      <StatusRow label="E-Mail" done={flags.email_verified} hint={flags.email_verified ? 'Bestätigt' : 'Noch nicht bestätigt'} />
      <StatusRow label="Adresse" done={flags.address_verified} hint={flags.address_verified ? 'Bestätigt' : 'Adresse eingeben'} />
      <StatusRow label="Studio / Coach" done={flags.studio_verified || flags.coach_vouched} hint={flags.studio_verified || flags.coach_vouched ? 'Bestätigt' : 'Durch Studio oder Coach'} />
      <StatusRow label="Telefon" done={flags.phone_verified} hint="Bald verfügbar" />

      {!flags.address_verified && (
        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Strasse, PLZ, Ort"
            placeholderTextColor={colors.inactive}
          />
          <TouchableOpacity
              style={styles.saveButton}
              onPress={() => { void handleSave(address, updateAddress, setSavingAddress, () => setAddress('')); }}
              disabled={savingAddress}
            >
            <Text style={styles.saveText}>Speichern</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputGroup}>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Telefonnummer (optional)"
          placeholderTextColor={colors.inactive}
          keyboardType="phone-pad"
        />
        <TouchableOpacity
            style={styles.saveButton}
            onPress={() => { void handleSave(phone, updatePhone, setSavingPhone, () => setPhone('')); }}
            disabled={savingPhone}
          >
          <Text style={styles.saveText}>Speichern</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
    marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  rowHint: { fontSize: 12, color: colors.textSecondary },
  inputGroup: { flexDirection: 'row', gap: 8, marginTop: 8 },
  input: {
    flex: 1, height: 48, backgroundColor: colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, fontSize: 14, color: colors.text,
  },
  saveButton: {
    height: 48, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.headerBg,
    alignItems: 'center', justifyContent: 'center',
  },
  saveText: { color: colors.headerTextPrimary, fontSize: 14, fontWeight: '700' },
});
