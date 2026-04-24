import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../../theme/colors';

// ─── Steps → Points logic ─────────────────────────────────────────────────────

export function stepsToPoints(steps: number): number {
  if (steps >= 25000) return 30;
  if (steps >= 20000) return 25;
  if (steps >= 15000) return 20;
  if (steps >= 10000) return 15;
  if (steps >= 5000) return 5;
  return 0;
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (steps: number, points: number) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function StepsInputModal({ visible, onClose, onConfirm }: Props) {
  const [input, setInput] = useState('');

  const parsed = parseInt(input.replace(/[^0-9]/g, ''), 10);
  const steps = isNaN(parsed) ? 0 : parsed;
  const points = stepsToPoints(steps);
  const canConfirm = steps >= 5000;

  function handleConfirm(): void {
    if (!canConfirm) return;
    onConfirm(steps, points);
    setInput('');
  }

  function handleClose(): void {
    setInput('');
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Schritte eingeben</Text>
          <Text style={styles.subtitle}>Wie viele Schritte hast du heute gemacht?</Text>

          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            keyboardType="number-pad"
            placeholder="z. B. 10000"
            placeholderTextColor={colors.textSecondary}
            maxLength={6}
            autoFocus
          />

          {/* Points preview */}
          <View style={styles.pointsRow}>
            {steps >= 5000 ? (
              <>
                <Text style={styles.pointsLabel}>Punkte:</Text>
                <Text style={styles.pointsValue}>+{points}p</Text>
              </>
            ) : (
              <Text style={styles.pointsHint}>
                {steps === 0 ? 'Ab 5.000 Schritten gibt es Punkte' : 'Mindestens 5.000 Schritte nötig'}
              </Text>
            )}
          </View>

          {/* Steps tier overview */}
          <View style={styles.tierList}>
            {STEPS_TIERS.map((tier) => (
              <View key={tier.label} style={styles.tierRow}>
                <Text style={[styles.tierLabel, steps >= tier.min && styles.tierLabelActive]}>
                  {tier.label}
                </Text>
                <Text style={[styles.tierPoints, steps >= tier.min && styles.tierPointsActive]}>
                  {tier.points}p
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
              <Text style={styles.cancelLabel}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              activeOpacity={0.8}
              disabled={!canConfirm}
            >
              <Text style={styles.confirmLabel}>Bestätigen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Tiers ────────────────────────────────────────────────────────────────────

const STEPS_TIERS: { label: string; min: number; points: number }[] = [
  { label: '5.000 Schritte',  min: 5000,  points: 5  },
  { label: '10.000 Schritte', min: 10000, points: 15 },
  { label: '15.000 Schritte', min: 15000, points: 20 },
  { label: '20.000 Schritte', min: 20000, points: 25 },
  { label: '25.000 Schritte', min: 25000, points: 30 },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    minHeight: 24,
  },
  pointsLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  pointsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  pointsHint: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  tierList: {
    gap: 6,
    marginBottom: 24,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  tierLabelActive: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  tierPoints: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  tierPointsActive: {
    color: colors.accentBlue,
    fontWeight: '700',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
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
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: colors.border,
  },
  confirmLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
});
