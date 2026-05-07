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
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { CreateSparringParams } from '../../hooks/useSparringActions';

const DISCIPLINES = ['Boxen', 'K1 / Kickboxen', 'BJJ', 'MMA', 'Muay Thai', 'Ringen', 'Sonstiges'];

interface Props {
  visible: boolean;
  studioId: string;
  onClose: () => void;
  onCreate: (params: CreateSparringParams) => Promise<void>;
}

function nextDay18h(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return d;
}

export default function CreateSparringSheet({ visible, studioId, onClose, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [discipline, setDiscipline] = useState(DISCIPLINES[0]);
  const [address, setAddress] = useState('');
  const [scheduledAt, setScheduledAt] = useState<Date>(nextDay18h);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [durationMin, setDurationMin] = useState('90');
  const [maxSlots, setMaxSlots] = useState('10');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  function formatDate(d: Date): string {
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatTime(d: Date): string {
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  async function handleCreate(): Promise<void> {
    if (title.trim().length === 0) {
      Alert.alert('Titel fehlt', 'Bitte gib einen Titel ein.');
      return;
    }
    if (address.trim().length === 0) {
      Alert.alert('Adresse fehlt', 'Bitte gib die Adresse des Sparrings ein.');
      return;
    }
    const dur = parseInt(durationMin, 10);
    const slots = parseInt(maxSlots, 10);
    if (isNaN(dur) || dur < 1) {
      Alert.alert('Ungültige Dauer', 'Bitte gib eine gültige Dauer in Minuten ein.');
      return;
    }
    if (isNaN(slots) || slots < 1) {
      Alert.alert('Ungültige Plätze', 'Bitte gib mindestens 1 Platz ein.');
      return;
    }

    setLoading(true);
    await onCreate({
      studioId,
      title: title.trim(),
      discipline,
      address: address.trim(),
      scheduledAt: scheduledAt.toISOString(),
      durationMin: dur,
      maxSlots: slots,
      notes,
    });
    setLoading(false);
    setTitle('');
    setAddress('');
    setDiscipline(DISCIPLINES[0]);
    setNotes('');
    setDurationMin('90');
    setMaxSlots('10');
    setScheduledAt(nextDay18h());
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Sparring planen</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <Text style={styles.label}>Titel</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="z.B. Offenes Boxsparring"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.label}>Kampfsport</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.pillRow}>
              {DISCIPLINES.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.pill, discipline === d && styles.pillActive]}
                  onPress={() => setDiscipline(d)}
                >
                  <Text style={[styles.pillText, discipline === d && styles.pillTextActive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.label}>Adresse</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Straße, Hausnummer, Stadt"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.label}>Datum</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.inputText}>{formatDate(scheduledAt)}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={scheduledAt}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={(_, date) => {
                setShowDatePicker(false);
                if (date !== undefined) {
                  const merged = new Date(date);
                  merged.setHours(scheduledAt.getHours(), scheduledAt.getMinutes());
                  setScheduledAt(merged);
                }
              }}
            />
          )}

          <Text style={styles.label}>Uhrzeit</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowTimePicker(true)}>
            <Text style={styles.inputText}>{formatTime(scheduledAt)}</Text>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={scheduledAt}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, date) => {
                setShowTimePicker(false);
                if (date !== undefined) {
                  const merged = new Date(scheduledAt);
                  merged.setHours(date.getHours(), date.getMinutes());
                  setScheduledAt(merged);
                }
              }}
            />
          )}

          <View style={styles.twoCol}>
            <View style={styles.colItem}>
              <Text style={styles.label}>Dauer (Min.)</Text>
              <TextInput
                style={styles.input}
                value={durationMin}
                onChangeText={setDurationMin}
                keyboardType="numeric"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.colItem}>
              <Text style={styles.label}>Max. Plätze</Text>
              <TextInput
                style={styles.input}
                value={maxSlots}
                onChangeText={setMaxSlots}
                keyboardType="numeric"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          <Text style={styles.label}>Hinweise (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Level, Ausrüstung, Hinweise..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={styles.btnText}>Veröffentlichen</Text>
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
    backgroundColor: 'rgba(0,0,0,0.45)',
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
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputText: {
    fontSize: 15,
    color: colors.text,
  },
  multiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.card,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  colItem: {
    flex: 1,
  },
  btn: {
    backgroundColor: colors.accentBlue,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
  },
  bottomPad: {
    height: 16,
  },
});
