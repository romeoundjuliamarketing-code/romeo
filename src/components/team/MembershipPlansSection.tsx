import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useStudioMembershipPlansEditor } from '../../hooks/useStudioMembershipPlansEditor';
import { formatPrice, billingIntervalLabel } from '../../utils/formatPrice';

interface Props {
  studioId: string;
}

// Parses a euro amount string entered by staff (e.g. "29", "29,50", "29.50")
// and returns the value in cents, or null if the input is invalid.
function parseEurosToCents(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  const parsed = parseFloat(normalized);
  if (isNaN(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

// Staff component for viewing and managing studio membership plans.
export default function MembershipPlansSection({ studioId }: Props): React.ReactElement {
  const { plans, loading, saving, addPlan, deactivatePlan } = useStudioMembershipPlansEditor(studioId);

  const [formVisible, setFormVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [minTermInput, setMinTermInput] = useState('');
  const [descInput, setDescInput] = useState('');

  function resetForm(): void {
    setNameInput('');
    setPriceInput('');
    setInterval('monthly');
    setMinTermInput('');
    setDescInput('');
    setFormVisible(false);
  }

  async function handleAdd(): Promise<void> {
    const priceCents = parseEurosToCents(priceInput);
    if (nameInput.trim().length === 0) {
      Alert.alert('Fehler', 'Bitte einen Namen eingeben.');
      return;
    }
    if (priceCents === null) {
      Alert.alert('Fehler', 'Ungültiger Preis. Beispiel: 29 oder 29,50');
      return;
    }
    const minTerm = minTermInput.trim().length > 0 ? parseInt(minTermInput, 10) : 0;
    if (isNaN(minTerm) || minTerm < 0) {
      Alert.alert('Fehler', 'Ungültige Mindestlaufzeit.');
      return;
    }
    const { error } = await addPlan({
      name:            nameInput.trim(),
      priceCents,
      billingInterval: interval,
      minTermMonths:   minTerm,
      description:     descInput.trim().length > 0 ? descInput.trim() : null,
    });
    if (error !== null) {
      Alert.alert('Fehler', error);
      return;
    }
    resetForm();
  }

  async function handleDeactivate(id: string, name: string): Promise<void> {
    Alert.alert(
      'Tarif deaktivieren',
      `"${name}" wirklich deaktivieren? Er wird für neue Anmeldungen nicht mehr angezeigt.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Deaktivieren',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deactivatePlan(id);
            if (error !== null) Alert.alert('Fehler', error);
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Mitgliedschafts-Tarife</Text>

      {loading ? (
        <ActivityIndicator color={colors.accentBlue} style={styles.loader} />
      ) : (
        <>
          {plans.length === 0 && !formVisible && (
            <Text style={styles.emptyText}>Noch keine Tarife angelegt.</Text>
          )}

          {plans.map((plan) => (
            <View key={plan.id} style={[styles.planRow, !plan.is_active && styles.planRowInactive]}>
              <View style={styles.planInfo}>
                <Text style={[styles.planName, !plan.is_active && styles.planNameInactive]}>
                  {plan.name}
                  {!plan.is_active ? '  (inaktiv)' : ''}
                </Text>
                <Text style={styles.planPrice}>
                  {formatPrice(plan.price_cents)} / {billingIntervalLabel(plan.billing_interval)}
                </Text>
                {plan.min_term_months > 0 && (
                  <Text style={styles.planMeta}>
                    Mindestlaufzeit: {plan.min_term_months} {plan.min_term_months === 1 ? 'Monat' : 'Monate'}
                  </Text>
                )}
              </View>
              {plan.is_active && (
                <TouchableOpacity
                  onPress={() => { void handleDeactivate(plan.id, plan.name); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="close-circle-outline" size={20} color={colors.deleteRed} />
                </TouchableOpacity>
              )}
            </View>
          ))}

          {formVisible ? (
            <View style={styles.form}>
              <Text style={styles.formLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="z. B. Standard, Premium..."
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.formLabel}>Preis (Euro)</Text>
              <TextInput
                style={styles.input}
                value={priceInput}
                onChangeText={setPriceInput}
                placeholder="z. B. 29 oder 29,50"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />

              <Text style={styles.formLabel}>Abrechnungsintervall</Text>
              <View style={styles.intervalRow}>
                {(['monthly', 'yearly'] as const).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.intervalChip, interval === opt && styles.intervalChipActive]}
                    onPress={() => setInterval(opt)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.intervalLabel, interval === opt && styles.intervalLabelActive]}>
                      {billingIntervalLabel(opt)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Mindestlaufzeit (Monate, optional)</Text>
              <TextInput
                style={styles.input}
                value={minTermInput}
                onChangeText={setMinTermInput}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
              />

              <Text style={styles.formLabel}>Beschreibung (optional)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={descInput}
                onChangeText={setDescInput}
                placeholder="Leistungen, Besonderheiten..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <View style={styles.formBtnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={resetForm} activeOpacity={0.8}>
                  <Text style={styles.cancelLabel}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={() => { void handleAdd(); }}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.card} />
                  ) : (
                    <Text style={styles.saveLabel}>Speichern</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setFormVisible(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="plus" size={18} color={colors.accentBlue} />
              <Text style={styles.addLabel}>Neuen Tarif anlegen</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  loader: {
    marginVertical: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planRowInactive: {
    opacity: 0.5,
  },
  planInfo: {
    flex: 1,
    gap: 2,
  },
  planName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  planNameInactive: {
    color: colors.textSecondary,
  },
  planPrice: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  planMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  form: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  inputMultiline: {
    height: 72,
  },
  intervalRow: {
    flexDirection: 'row',
    gap: 8,
  },
  intervalChip: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intervalChipActive: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  intervalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  intervalLabelActive: {
    color: colors.card,
  },
  formBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.card,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  addLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accentBlue,
  },
});
