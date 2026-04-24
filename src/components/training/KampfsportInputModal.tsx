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

// ─── Types ────────────────────────────────────────────────────────────────────

export type KampfsportIntensity = 'leicht' | 'mittel' | 'intensiv';

// ─── Calculation ──────────────────────────────────────────────────────────────

const INTENSITY_FACTOR: Record<KampfsportIntensity, number> = {
  leicht: 15,
  mittel: 25,
  intensiv: 35,
};

const INTENSITY_LABEL: Record<KampfsportIntensity, string> = {
  leicht: 'Leicht',
  mittel: 'Mittel',
  intensiv: 'Intensiv',
};

type CalcResult = {
  intensity: KampfsportIntensity;
  points: number;
};

export function calcKampfsport(
  totalMin: number,
  roundMin: number,
  pauseMin: number,
): CalcResult | null {
  if (totalMin <= 0 || roundMin <= 0 || pauseMin <= 0) return null;
  const workRatio = roundMin / (roundMin + pauseMin);
  const intensity: KampfsportIntensity =
    workRatio < 0.6 ? 'leicht' : workRatio <= 0.75 ? 'mittel' : 'intensiv';
  const factor = INTENSITY_FACTOR[intensity];
  const realWork = totalMin * workRatio;
  const points = Math.max(1, Math.floor(realWork / 30)) * factor;
  return { intensity, points };
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  category: string;
  onClose: () => void;
  onConfirm: (totalMin: number, points: number, intensity: KampfsportIntensity) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function KampfsportInputModal({ visible, category, onClose, onConfirm }: Props) {
  const [totalInput, setTotalInput] = useState('');
  const [roundInput, setRoundInput] = useState('');
  const [pauseInput, setPauseInput] = useState('');

  const totalMin = parseInt(totalInput, 10);
  const roundMin = parseInt(roundInput, 10);
  const pauseMin = parseInt(pauseInput, 10);

  const result: CalcResult | null =
    !isNaN(totalMin) && !isNaN(roundMin) && !isNaN(pauseMin)
      ? calcKampfsport(totalMin, roundMin, pauseMin)
      : null;

  const canConfirm = result !== null;

  function handleConfirm(): void {
    if (!canConfirm || result === null) return;
    onConfirm(totalMin, result.points, result.intensity);
    reset();
  }

  function handleClose(): void {
    reset();
    onClose();
  }

  function reset(): void {
    setTotalInput('');
    setRoundInput('');
    setPauseInput('');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>{category}</Text>
          <Text style={styles.subtitle}>Gib deine Session-Details ein</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Gesamtdauer</Text>
              <TextInput
                style={styles.input}
                value={totalInput}
                onChangeText={setTotalInput}
                keyboardType="number-pad"
                placeholder="Min"
                placeholderTextColor={colors.textSecondary}
                maxLength={4}
                autoFocus
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Rundendauer</Text>
              <TextInput
                style={styles.input}
                value={roundInput}
                onChangeText={setRoundInput}
                keyboardType="number-pad"
                placeholder="Min"
                placeholderTextColor={colors.textSecondary}
                maxLength={3}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Pausendauer</Text>
              <TextInput
                style={styles.input}
                value={pauseInput}
                onChangeText={setPauseInput}
                keyboardType="number-pad"
                placeholder="Min"
                placeholderTextColor={colors.textSecondary}
                maxLength={3}
              />
            </View>
          </View>

          <View style={styles.resultBox}>
            {result !== null ? (
              <>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Intensität</Text>
                  <Text style={styles.resultValue}>{INTENSITY_LABEL[result.intensity]}</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Punkte</Text>
                  <Text style={styles.resultPoints}>+{result.points}p</Text>
                </View>
              </>
            ) : (
              <Text style={styles.resultHint}>Alle Felder ausfüllen um Punkte zu sehen</Text>
            )}
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
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  inputGroup: {
    flex: 1,
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  resultBox: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 8,
    minHeight: 56,
    justifyContent: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  resultValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  resultPoints: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  resultHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
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
