import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useTrialBooking } from '../../hooks/useTrialBooking';
import { nextDateForWeekday } from '../../utils/scheduleDates';
import type { StudioSchedule } from '../../types/database.types';

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

interface Props {
  visible: boolean;
  studioId: string;
  schedule: StudioSchedule[];
  onClose: () => void;
  onBooked: () => void;
}

// Formats a DB time string "HH:MM:SS" → "HH:MM"
function formatTime(t: string): string {
  return t.slice(0, 5);
}

export default function TrialBookingSheet({
  visible,
  studioId,
  schedule,
  onClose,
  onBooked,
}: Props) {
  const { bookTrial } = useTrialBooking();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    schedule.length > 0 ? 0 : null,
  );
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const hasSchedule = schedule.length > 0;

  async function handleConfirm(): Promise<void> {
    let scheduleId: string | null = null;
    let requestedDate: string;

    if (hasSchedule && selectedIndex !== null) {
      const entry = schedule[selectedIndex];
      scheduleId = entry.id;
      requestedDate = nextDateForWeekday(entry.day_of_week);
    } else {
      // Fallback: no schedule entries, use tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const y = tomorrow.getFullYear();
      const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      requestedDate = `${y}-${m}-${day}`;
    }

    setLoading(true);
    const { error } = await bookTrial({
      studioId,
      scheduleId,
      requestedDate,
      note: note.trim().length > 0 ? note.trim() : null,
    });
    setLoading(false);

    if (error !== null) {
      Alert.alert('Fehler', error);
      return;
    }

    setNote('');
    setSelectedIndex(schedule.length > 0 ? 0 : null);
    onBooked();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <Text style={styles.heading}>Probetraining buchen</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {hasSchedule ? (
            <>
              <Text style={styles.label}>Einheit auswählen</Text>
              {schedule.map((entry, idx) => {
                const selected = selectedIndex === idx;
                return (
                  <TouchableOpacity
                    key={entry.id}
                    style={[styles.sessionRow, selected && styles.sessionRowActive]}
                    onPress={() => setSelectedIndex(idx)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.sessionLeft}>
                      <Text style={[styles.sessionName, selected && styles.sessionNameActive]}>
                        {entry.training_name}
                      </Text>
                      <Text style={[styles.sessionMeta, selected && styles.sessionMetaActive]}>
                        {DAY_LABELS[entry.day_of_week]}  ·  {formatTime(entry.start_time)}  ·  {entry.duration_min} Min.
                      </Text>
                    </View>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.accentBlue} />
                    )}
                  </TouchableOpacity>
                );
              })}
              {selectedIndex !== null && (
                <View style={styles.dateBadge}>
                  <Ionicons name="calendar-outline" size={14} color={colors.accentBlue} />
                  <Text style={styles.dateBadgeText}>
                    Nächster Termin: {nextDateForWeekday(schedule[selectedIndex].day_of_week)
                      .split('-').reverse().join('.')}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.noScheduleBanner}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.noScheduleText}>
                Kein Stundenplan vorhanden. Deine Anfrage wird ohne feste Einheit gesendet.
              </Text>
            </View>
          )}

          <Text style={styles.label}>Nachricht (optional)</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Erfahrung, Fragen, Hinweise..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity
            style={[
              styles.confirmBtn,
              (loading || (hasSchedule && selectedIndex === null)) && styles.confirmBtnDisabled,
            ]}
            onPress={() => { void handleConfirm(); }}
            disabled={loading || (hasSchedule && selectedIndex === null)}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={styles.confirmBtnText}>Anfrage senden</Text>
            )}
          </TouchableOpacity>

          <View style={styles.bottomPad} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.mapOverlay,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '88%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 8,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginBottom: 8,
  },
  sessionRowActive: {
    borderColor: colors.accentBlue,
    backgroundColor: colors.accentBlueSoft,
  },
  sessionLeft: {
    flex: 1,
    gap: 2,
  },
  sessionName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  sessionNameActive: {
    color: colors.accentBlue,
  },
  sessionMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sessionMetaActive: {
    color: colors.accentBlue,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.accentBlue,
  },
  noScheduleBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginTop: 8,
  },
  noScheduleText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  noteInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    height: 80,
    textAlignVertical: 'top',
  },
  confirmBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
  },
  bottomPad: {
    height: 16,
  },
});
