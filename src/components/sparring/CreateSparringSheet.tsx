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
import type { CreateSparringInput } from '../../hooks/useSparringActions';
import LocationPickerModal from './LocationPickerModal';

const DISCIPLINES = ['Boxen', 'K1 / Kickboxen', 'BJJ', 'MMA', 'Muay Thai', 'Ringen', 'Sonstiges'];

type CoachStudioInfo = {
  id: string;
  address: string;
  lat: number | null;
  lng: number | null;
};

type Props =
  | {
      visible: boolean;
      mode?: 'coach';
      studioId: string;
      coachStudio?: never;
      onClose: () => void;
      onCreate: (params: CreateSparringInput) => Promise<void>;
    }
  | {
      visible: boolean;
      mode: 'user';
      studioId?: never;
      /** When provided, shows the "Am Studio-Standort" checkbox for coaches */
      coachStudio?: CoachStudioInfo | null;
      onClose: () => void;
      onCreate: (params: CreateSparringInput) => Promise<void>;
    };

function nextDay18h(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return d;
}

export default function CreateSparringSheet(props: Props) {
  const { visible, onClose, onCreate } = props;
  const mode = props.mode ?? 'coach';
  const studioId = 'studioId' in props ? props.studioId : undefined;
  const isUserMode = mode === 'user';

  const coachStudio = 'coachStudio' in props ? props.coachStudio : null;
  const showAtStudioCheckbox =
    isUserMode && coachStudio !== null && coachStudio !== undefined && coachStudio.address.trim().length > 0;

  const [isAtStudio, setIsAtStudio] = useState(false);

  const [title, setTitle] = useState('');
  const [discipline, setDiscipline] = useState(DISCIPLINES[0]);
  const [scheduledAt, setScheduledAt] = useState<Date>(nextDay18h);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [durationMin, setDurationMin] = useState('90');
  const [maxSlots, setMaxSlots] = useState('10');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState('');
  // Coordinates from map picker — set when user picks a location on the map
  const [pickedCoord, setPickedCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

  function formatDate(d: Date): string {
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatTime(d: Date): string {
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  function handleToggleAtStudio(): void {
    if (coachStudio === null || coachStudio === undefined) return;
    const next = !isAtStudio;
    setIsAtStudio(next);
    if (next) {
      setAddress(coachStudio.address);
      setPickedCoord(
        coachStudio.lat !== null && coachStudio.lng !== null
          ? { lat: coachStudio.lat, lng: coachStudio.lng }
          : null,
      );
    } else {
      setAddress('');
      setPickedCoord(null);
    }
  }

  async function handleCreate(): Promise<void> {
    if (isUserMode) {
      if (address.trim().length === 0) {
        Alert.alert('Ort fehlt', 'Bitte gib einen Ort oder eine Adresse ein.');
        return;
      }
      const slotsUser = parseInt(maxSlots, 10);
      if (isNaN(slotsUser) || slotsUser < 1) {
        Alert.alert('Ungültige Plätze', 'Bitte gib mindestens 1 Platz ein.');
        return;
      }
    } else {
      if (title.trim().length === 0) {
        Alert.alert('Titel fehlt', 'Bitte gib einen Titel ein.');
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
    }

    const dur = isUserMode ? 90 : parseInt(durationMin, 10);
    const slots = parseInt(maxSlots, 10);
    const resolvedTitle = isUserMode ? `${discipline} – Sparring` : title.trim();

    const params: CreateSparringInput = isUserMode
      ? {
          address: address.trim(),
          ...(pickedCoord !== null ? { lat: pickedCoord.lat, lng: pickedCoord.lng } : {}),
          ...(isAtStudio && coachStudio !== null && coachStudio !== undefined
            ? { isAtStudio: true as const, atStudioId: coachStudio.id }
            : {}),
          title: resolvedTitle,
          discipline,
          scheduledAt: scheduledAt.toISOString(),
          durationMin: dur,
          maxSlots: slots,
          notes,
        }
      : { studioId: studioId as string, title: resolvedTitle, discipline, scheduledAt: scheduledAt.toISOString(), durationMin: dur, maxSlots: slots, notes };

    setLoading(true);
    await onCreate(params);
    setLoading(false);
    setTitle('');
    setAddress('');
    setPickedCoord(null);
    setIsAtStudio(false);
    setDiscipline(DISCIPLINES[0]);
    setNotes('');
    setDurationMin('90');
    setMaxSlots('10');
    setScheduledAt(nextDay18h());
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <LocationPickerModal
        visible={locationPickerVisible}
        onClose={() => setLocationPickerVisible(false)}
        onConfirm={(lat, lng, displayAddress) => {
          setPickedCoord({ lat, lng });
          setAddress(displayAddress);
          setLocationPickerVisible(false);
        }}
      />
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

          {!isUserMode && (
            <>
              <Text style={styles.label}>Titel</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="z.B. Offenes Boxsparring"
                placeholderTextColor={colors.textSecondary}
              />
            </>
          )}

          {isUserMode && (
            <>
              <Text style={styles.label}>Ort</Text>
              <View style={styles.locationRow}>
                <TextInput
                  style={[styles.input, styles.locationInput, isAtStudio && styles.inputDisabled]}
                  value={address}
                  editable={!isAtStudio}
                  onChangeText={(t) => {
                    if (isAtStudio) return;
                    setAddress(t);
                    // Manual edit clears the map-picked coordinates
                    if (pickedCoord !== null) setPickedCoord(null);
                  }}
                  placeholder="Adresse eingeben"
                  placeholderTextColor={colors.textSecondary}
                />
                <TouchableOpacity
                  style={[styles.mapPickBtn, isAtStudio && styles.mapPickBtnDisabled]}
                  onPress={() => { if (!isAtStudio) setLocationPickerVisible(true); }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="map-outline"
                    size={18}
                    color={pickedCoord !== null ? colors.card : colors.accentBlue}
                  />
                </TouchableOpacity>
              </View>
              {pickedCoord !== null && (
                <View style={styles.pickedBadge}>
                  <Ionicons name="location" size={13} color={colors.accentBlue} />
                  <Text style={styles.pickedBadgeText} numberOfLines={1}>{address}</Text>
                  <TouchableOpacity
                    onPress={() => { setPickedCoord(null); setAddress(''); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={15} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {showAtStudioCheckbox && (
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={handleToggleAtStudio}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, isAtStudio && styles.checkboxChecked]}>
                {isAtStudio && <Ionicons name="checkmark" size={14} color={colors.card} />}
              </View>
              <Text style={styles.checkboxLabel}>Am Studio-Standort</Text>
            </TouchableOpacity>
          )}

          {isUserMode && (
            <>
              <Text style={styles.label}>Max. Plätze</Text>
              <TextInput
                style={styles.input}
                value={maxSlots}
                onChangeText={setMaxSlots}
                keyboardType="numeric"
                placeholderTextColor={colors.textSecondary}
              />
            </>
          )}

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

          {!isUserMode && (
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
          )}

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

  // Location row
  locationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  locationInput: {
    flex: 1,
  },
  mapPickBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accentBlue,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pickedBadgeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: colors.accentBlue,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  mapPickBtnDisabled: {
    opacity: 0.35,
  },
});
