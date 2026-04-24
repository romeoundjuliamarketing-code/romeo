import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface Props {
  currentWeight: number | null;
  hasEntryThisWeek: boolean;
  onSave: (kg: number) => Promise<{ error: string | null }>;
}

export default function QuickWeightEntry({ currentWeight, hasEntryThisWeek, onSave }: Props): React.ReactElement {
  const [modalVisible, setModalVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kg = parseFloat(inputValue.replace(',', '.'));
  const isValid = !isNaN(kg) && kg >= 30 && kg <= 300;

  function handleOpen(): void {
    setInputValue(currentWeight !== null ? String(currentWeight) : '');
    setError(null);
    setModalVisible(true);
  }

  async function handleSave(): Promise<void> {
    if (!isValid || saving) return;
    setSaving(true);
    const result = await onSave(kg);
    setSaving(false);
    if (result.error !== null) {
      setError(result.error);
      return;
    }
    setModalVisible(false);
    setInputValue('');
  }

  return (
    <>
      <TouchableOpacity style={styles.row} onPress={handleOpen} activeOpacity={0.7}>
        <View style={styles.iconWrap}>
          <Ionicons name="scale-outline" size={20} color={colors.accentBlue} />
        </View>
        <View style={styles.info}>
          <Text style={styles.label}>Gewicht diese Woche</Text>
          <Text style={styles.value}>
            {hasEntryThisWeek && currentWeight !== null
              ? `${currentWeight.toFixed(1)} kg`
              : 'Noch kein Eintrag'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.inactive} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Gewicht eintragen</Text>
            <Text style={styles.sheetSubtitle}>
              Wird für diese Woche gespeichert und beeinflusst deinen Ernährungsplan.
            </Text>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={inputValue}
                onChangeText={(v) => { setInputValue(v); setError(null); }}
                placeholder="z. B. 82.5"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                autoFocus
                maxLength={5}
              />
              <Text style={styles.unit}>kg</Text>
            </View>

            {error !== null && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            <View style={styles.buttons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelLabel}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (!isValid || saving) && styles.saveBtnDisabled]}
                onPress={() => { void handleSave(); }}
                disabled={!isValid || saving}
                activeOpacity={0.8}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.saveLabel}>Speichern</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  value: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.inactive,
  },

  // Modal
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  unit: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    width: 32,
  },
  errorText: {
    fontSize: 13,
    color: colors.deleteRed,
    fontWeight: '500',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: colors.border,
  },
  saveLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
