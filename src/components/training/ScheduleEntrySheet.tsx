import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../../theme/colors';

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const STUDIO_TRAINING_TYPES = ['BJJ', 'K1', 'MMA', 'Ringen'] as const;

function isValidTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [h, m] = value.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export interface ScheduleEntryValues {
  day_of_week:      number;
  training_name:    string;
  start_time:       string;
  duration_min:     number;
  points_per_30min: number;
  training_type:    string;
  coach_name:       string | null;
}

interface Props {
  visible:         boolean;
  initialDay:      number;
  onClose:         () => void;
  onConfirm:       (entry: ScheduleEntryValues) => void;
  showCoachFields?: boolean;  // extra fields for studio schedule editing
}

export default function ScheduleEntrySheet({ visible, initialDay, onClose, onConfirm, showCoachFields = false }: Props): React.ReactElement {
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [name, setName] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [trainingType, setTrainingType] = useState('');
  const [coachName, setCoachName] = useState('');

  const [timeError, setTimeError] = useState(false);
  const [durationError, setDurationError] = useState(false);

  // Reset form when sheet opens
  React.useEffect(() => {
    if (visible) {
      setSelectedDay(initialDay);
      setName('');
      setTime('');
      setDuration('');
      setTrainingType('');
      setCoachName('');
      setTimeError(false);
      setDurationError(false);
    }
  }, [visible, initialDay]);

  function handleConfirm(): void {
    const timeValid = isValidTime(time);
    const durationNum = parseInt(duration, 10);
    const durationValid = !isNaN(durationNum) && durationNum > 0;

    setTimeError(!timeValid);
    setDurationError(!durationValid);

    if (!timeValid || !durationValid || name.trim().length === 0) return;

    onConfirm({
      day_of_week:      selectedDay,
      training_name:    name.trim(),
      start_time:       time,
      duration_min:     durationNum,
      points_per_30min: 35,
      training_type:    showCoachFields ? trainingType : 'training',
      coach_name:       showCoachFields ? (coachName.trim() || null) : null,
    });
  }

  const canConfirm =
    name.trim().length > 0 &&
    time.length > 0 &&
    duration.length > 0 &&
    (!showCoachFields || trainingType.trim().length > 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          <Text style={styles.title}>Einheit hinzufügen</Text>

          {/* Day selector */}
          <View style={styles.dayRow}>
            {DAY_NAMES.map((label, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.dayChip, selectedDay === i && styles.dayChipActive]}
                onPress={() => setSelectedDay(i)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayChipText, selectedDay === i && styles.dayChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Bezeichnung</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="z. B. K1 Technik"
              placeholderTextColor={colors.textSecondary}
              maxLength={60}
              returnKeyType="next"
            />
          </View>

          {/* Time + Duration row */}
          <View style={styles.row}>
            <View style={[styles.field, styles.fieldHalf]}>
              <Text style={styles.label}>Uhrzeit</Text>
              <TextInput
                style={[styles.input, timeError && styles.inputError]}
                value={time}
                onChangeText={(v) => { setTime(v); setTimeError(false); }}
                placeholder="18:00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                returnKeyType="next"
              />
              {timeError && <Text style={styles.errorText}>Format: HH:MM</Text>}
            </View>

            <View style={[styles.field, styles.fieldHalf]}>
              <Text style={styles.label}>Dauer (Min)</Text>
              <TextInput
                style={[styles.input, durationError && styles.inputError]}
                value={duration}
                onChangeText={(v) => { setDuration(v); setDurationError(false); }}
                placeholder="90"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                maxLength={4}
                returnKeyType="done"
              />
              {durationError && <Text style={styles.errorText}>Bitte Minuten angeben</Text>}
            </View>
          </View>

          {/* Coach-only fields */}
          {showCoachFields && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Trainingsart *</Text>
                <View style={styles.typeRow}>
                  {STUDIO_TRAINING_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeChip, trainingType === type && styles.typeChipActive]}
                      onPress={() => setTrainingType(type)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.typeChipText, trainingType === type && styles.typeChipTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Coach</Text>
                <TextInput
                  style={styles.input}
                  value={coachName}
                  onChangeText={setCoachName}
                  placeholder="Optional"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={40}
                  returnKeyType="next"
                />
              </View>
            </>
          )}

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelLabel}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!canConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmLabel}>Hinzufügen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // Day selector
  dayRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayChip: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipActive: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dayChipTextActive: {
    color: colors.headerTextPrimary,
  },

  // Fields
  field: {
    gap: 6,
  },
  fieldHalf: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 12,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  inputError: {
    borderColor: colors.deleteRed,
  },
  errorText: {
    fontSize: 11,
    color: colors.deleteRed,
    fontWeight: '500',
  },

  // Training type chips
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  typeChipTextActive: {
    color: colors.headerTextPrimary,
  },

  // Buttons
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
