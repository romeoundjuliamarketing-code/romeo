import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { colors } from '../../theme/colors';
import { useDropInBooking } from '../../hooks/useDropInBooking';
import type { StudioSchedule } from '../../types/database.types';

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function getNextDates(dayOfWeek: number, count: number): string[] {
  const results: string[] = [];
  const today = new Date();
  // day_of_week: 0=Mo ... 6=So; JS: 0=Su ... 6=Sa
  const jsDay = dayOfWeek === 6 ? 0 : dayOfWeek + 1;

  for (let offset = 0; results.length < count; offset++) {
    const candidate = new Date(today);
    candidate.setDate(today.getDate() + offset);
    if (candidate.getDay() === jsDay) {
      results.push(candidate.toISOString().split('T')[0]);
    }
  }
  return results;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

interface Props {
  visible:   boolean;
  studioId:  string;
  entry:     StudioSchedule | null;
  onClose:   () => void;
  onBooked:  () => void;
}

export default function DropInSheet({ visible, studioId, entry, onClose, onBooked }: Props): React.ReactElement {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { booking, bookDropIn } = useDropInBooking();

  const dates = entry !== null ? getNextDates(entry.day_of_week, 4) : [];

  React.useEffect(() => {
    if (visible && dates.length > 0) {
      setSelectedDate(dates[0]);
    }
  }, [visible]);

  async function handleConfirm(): Promise<void> {
    if (entry === null || selectedDate === null) return;
    const { error } = await bookDropIn(studioId, entry.id, selectedDate);
    if (error !== null) {
      Alert.alert('Fehler', error);
      return;
    }
    onBooked();
    onClose();
  }

  if (entry === null) return <></>;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          <Text style={styles.title}>Drop-in buchen</Text>

          <View style={styles.sessionCard}>
            <Text style={styles.sessionName}>{entry.training_name}</Text>
            <Text style={styles.sessionMeta}>
              {DAY_LABELS[entry.day_of_week]}  ·  {entry.start_time.slice(0, 5)}  ·  {entry.duration_min} Min.
            </Text>
          </View>

          <Text style={styles.dateLabel}>Datum wählen</Text>
          <View style={styles.dateRow}>
            {dates.map((date) => (
              <TouchableOpacity
                key={date}
                style={[styles.dateChip, selectedDate === date && styles.dateChipActive]}
                onPress={() => setSelectedDate(date)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateChipText, selectedDate === date && styles.dateChipTextActive]}>
                  {formatDate(date)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.hint}>
            Deine Anfrage geht direkt ans Studio. Nach Bestätigung erhältst du eine Benachrichtigung.
          </Text>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelLabel}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (selectedDate === null || booking) && styles.confirmBtnDisabled]}
              onPress={() => { void handleConfirm(); }}
              disabled={selectedDate === null || booking}
              activeOpacity={0.8}
            >
              {booking ? (
                <ActivityIndicator size="small" color={colors.headerTextPrimary} />
              ) : (
                <Text style={styles.confirmLabel}>Anfrage senden</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
  sessionCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  sessionName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sessionMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateChipActive: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  dateChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dateChipTextActive: {
    color: colors.headerTextPrimary,
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
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
