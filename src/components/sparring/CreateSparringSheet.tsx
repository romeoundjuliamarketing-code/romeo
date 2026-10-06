import React, { useState, useRef, useEffect } from 'react';
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
  InputAccessoryView,
  Keyboard,
  type KeyboardEvent,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { CreateSparringInput, UpdateSparringInput } from '../../hooks/useSparringActions';
import type { SparringWithMeta } from '../../hooks/useOpenSparrings';
import LocationPickerModal from './LocationPickerModal';
import { checkText, filterErrorMessage } from '../../utils/contentFilter';
import { useBannedWords } from '../../hooks/useBannedWords';
import GymPickerSheet from '../gym/GymPickerSheet';
import { useGym } from '../../hooks/useGyms';
import type { Gym } from '../../hooks/useGyms';
import { GYM_LIMITS } from '../../utils/gymSearch';

const DISCIPLINES = ['Boxen', 'K1 / Kickboxen', 'BJJ', 'MMA', 'Muay Thai', 'Ringen', 'Sonstiges'];
const NOTES_ACCESSORY_ID = 'sparring-notes-accessory';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ── Internal helper: FieldLabel ───────────────────────────────────────────────
type FieldLabelProps = {
  icon: IoniconsName;
  text: string;
  hint?: string;
};

function FieldLabel({ icon, text, hint }: FieldLabelProps) {
  return (
    <View style={fieldLabelStyles.row}>
      <Ionicons name={icon} size={14} color={colors.textSecondary} style={fieldLabelStyles.icon} />
      <Text style={fieldLabelStyles.label}>{text}</Text>
      {hint !== undefined && hint.length > 0 && (
        <Text style={fieldLabelStyles.hint}>{hint}</Text>
      )}
    </View>
  );
}

const fieldLabelStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 6,
    gap: 5,
  },
  icon: {
    marginTop: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  hint: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
    marginLeft: 4,
    opacity: 0.75,
  },
});

// ── Internal helper: Stepper ──────────────────────────────────────────────────
type StepperProps = {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  step?: number;
};

function Stepper({ value, onChange, min = 1, step = 1 }: StepperProps) {
  const numVal = parseInt(value, 10);
  const current = isNaN(numVal) ? min : numVal;

  function decrement(): void {
    const next = Math.max(min, current - step);
    onChange(String(next));
  }

  function increment(): void {
    onChange(String(current + step));
  }

  return (
    <View style={stepperStyles.row}>
      <TouchableOpacity
        style={[stepperStyles.btn, current <= min && stepperStyles.btnDisabled]}
        onPress={decrement}
        disabled={current <= min}
        activeOpacity={0.75}
      >
        <Ionicons name="remove" size={18} color={current <= min ? colors.textSecondary : colors.text} />
      </TouchableOpacity>
      <Text style={stepperStyles.value}>{current}</Text>
      <TouchableOpacity style={stepperStyles.btn} onPress={increment} activeOpacity={0.75}>
        <Ionicons name="add" size={18} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const stepperStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  btn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  value: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
});

// ── Main component ────────────────────────────────────────────────────────────

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
      /** Edit mode: prefilled from this sparring, saves via onSaveEdit. */
      editing?: SparringWithMeta | null;
      /** Resolves true when saved (the sheet then closes). */
      onSaveEdit?: (input: UpdateSparringInput) => Promise<boolean>;
      /** New sparring from a gym page: this gym is preselected as the place. */
      initialGym?: Gym | null;
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

  const editing = 'editing' in props ? (props.editing ?? null) : null;
  const onSaveEdit = 'onSaveEdit' in props ? props.onSaveEdit : undefined;
  const initialGym = 'initialGym' in props ? (props.initialGym ?? null) : null;
  const isEditMode = editing !== null;
  // The studio is the location of a studio sparring: not editable.
  const locationLocked = isAtStudio || (editing !== null && editing.studio_id !== null);

  const scrollRef = useRef<ScrollView>(null);
  // Tracks whether the multiline notes field currently holds focus, so the
  // keyboard listener only auto-scrolls when the deepest field is being edited.
  const notesFocusedRef = useRef(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // While the sheet is open, lift the scroll content by the keyboard height so
  // the focused field sits right above the keyboard; reset to normal on hide.
  useEffect(() => {
    if (!visible) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
      setKeyboardHeight(e.endCoordinates.height);
      if (notesFocusedRef.current) {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      }
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
      setKeyboardHeight(0);
    };
  }, [visible]);

  const { bannedWords } = useBannedWords();
  const [filterError, setFilterError] = useState<string | null>(null);

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
  // Optional gym as the place of the sparring (location only — the sparring
  // stays the organizer's own meeting) and a short access note.
  const [gym, setGym] = useState<Gym | null>(null);
  const [accessNote, setAccessNote] = useState('');
  const [gymTouched, setGymTouched] = useState(false);
  const [gymPickerVisible, setGymPickerVisible] = useState(false);
  const { gym: editingGym } = useGym(visible && editing !== null ? (editing.gym_id ?? null) : null);
  useEffect(() => {
    if (editingGym !== null && !gymTouched) setGym(editingGym);
  }, [editingGym, gymTouched]);

  function resetForm(): void {
    setTitle('');
    setAddress('');
    setPickedCoord(null);
    setIsAtStudio(false);
    setDiscipline(DISCIPLINES[0]);
    setNotes('');
    setDurationMin('90');
    setMaxSlots('10');
    setScheduledAt(nextDay18h());
    setFilterError(null);
    setGym(null);
    setAccessNote('');
    setGymTouched(false);
  }

  // Each opening starts from the sparring being edited, or from a fresh form.
  const prefilledForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!visible) return;
    if (editing !== null) {
      prefilledForRef.current = editing.id;
      setTitle(editing.title);
      setDiscipline(editing.discipline);
      setScheduledAt(new Date(editing.scheduled_at));
      setDurationMin(String(editing.duration_min));
      setMaxSlots(String(editing.max_slots));
      setNotes(editing.notes ?? '');
      setAddress(editing.address);
      setPickedCoord(editing.lat !== null && editing.lng !== null ? { lat: editing.lat, lng: editing.lng } : null);
      setIsAtStudio(false);
      setFilterError(null);
      setGym(null);
      setAccessNote(editing.access_note ?? '');
      setGymTouched(false);
    } else if (prefilledForRef.current !== null) {
      prefilledForRef.current = null;
      resetForm();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editing?.id]);

  function formatDate(d: Date): string {
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatTime(d: Date): string {
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  // Taking a gym fills the meeting point only from real data: stored
  // coordinates, else the stored address (geocoded on save like a typed one).
  // A city alone never becomes a supposedly exact location.
  async function handlePickGym(picked: Gym): Promise<boolean> {
    setGym(picked);
    setGymTouched(true);
    const gymAddress = picked.address?.trim() ?? '';
    if (gymAddress.length > 0) {
      setAddress(gymAddress);
      setPickedCoord(picked.lat !== null && picked.lng !== null ? { lat: picked.lat, lng: picked.lng } : null);
    }
    return true;
  }

  // Gym page entry: apply the gym once per opening, exactly like picking it.
  // The next opening without it starts from a fresh form again.
  const initialGymAppliedRef = useRef(false);
  const resetAfterGymRef = useRef(false);
  useEffect(() => {
    if (!visible) {
      if (initialGymAppliedRef.current) resetAfterGymRef.current = true;
      initialGymAppliedRef.current = false;
      return;
    }
    if (editing !== null) return;
    if (initialGym !== null) {
      if (initialGymAppliedRef.current) return;
      initialGymAppliedRef.current = true;
      resetAfterGymRef.current = false;
      void handlePickGym(initialGym);
    } else if (resetAfterGymRef.current) {
      resetAfterGymRef.current = false;
      resetForm();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editing?.id, initialGym?.id]);

  function clearGym(): void {
    setGym(null);
    setAccessNote('');
    setGymTouched(true);
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

    setFilterError(null);
    const fieldsToCheck = [title, notes, ...(isUserMode ? [address, accessNote] : [])];
    for (const field of fieldsToCheck) {
      const verdict = checkText(field, bannedWords);
      if (!verdict.ok) {
        setFilterError(filterErrorMessage(verdict.category));
        return;
      }
    }

    const dur = isUserMode && !isEditMode ? 90 : parseInt(durationMin, 10);
    const slots = parseInt(maxSlots, 10);
    const resolvedTitle = isUserMode
      ? (title.trim().length > 0 ? title.trim() : `${discipline} – Sparring`)
      : title.trim();

    if (editing !== null) {
      if (isNaN(dur) || dur < 15 || dur > 600) {
        Alert.alert('Ungültige Dauer', 'Die Dauer muss zwischen 15 und 600 Minuten liegen.');
        return;
      }
      if (scheduledAt.getTime() <= Date.now()) {
        Alert.alert('Termin in der Vergangenheit', 'Bitte wähle einen Termin in der Zukunft.');
        return;
      }
      // Unchanged address keeps the stored coordinates, a map pick brings its
      // own, a typed new address is geocoded.
      const sameAddress = address.trim() === editing.address.trim();
      const coords = pickedCoord ?? (sameAddress ? { lat: editing.lat, lng: editing.lng } : null);
      const input: UpdateSparringInput = {
        title:        resolvedTitle,
        notes,
        discipline,
        address:      locationLocked ? editing.address : address.trim(),
        lat:          locationLocked ? editing.lat : (coords?.lat ?? null),
        lng:          locationLocked ? editing.lng : (coords?.lng ?? null),
        geocode:      !locationLocked && coords === null,
        scheduledAt:  scheduledAt.toISOString(),
        durationMin:  dur,
        maxSlots:     slots,
        verifiedOnly: editing.verified_only,
      };
      // Only what the user touched: an untouched gym may still be loading.
      if (gymTouched) {
        const nextNote = gym !== null && accessNote.trim().length > 0 ? accessNote.trim() : null;
        const nextGymId = gym?.id ?? null;
        if (nextGymId !== (editing.gym_id ?? null) || nextNote !== (editing.access_note ?? null)) {
          input.gym = { gymId: nextGymId, accessNote: nextNote };
        }
      }
      if (onSaveEdit === undefined) return;
      setLoading(true);
      const saved = await onSaveEdit(input);
      setLoading(false);
      if (saved) onClose();
      return;
    }

    const params: CreateSparringInput = isUserMode
      ? {
          address: address.trim(),
          ...(pickedCoord !== null ? { lat: pickedCoord.lat, lng: pickedCoord.lng } : {}),
          ...(isAtStudio && coachStudio !== null && coachStudio !== undefined
            ? { isAtStudio: true as const, atStudioId: coachStudio.id }
            : {}),
          ...(gym !== null && !isAtStudio
            ? { gymId: gym.id, ...(accessNote.trim().length > 0 ? { accessNote: accessNote.trim() } : {}) }
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
    resetForm();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={NOTES_ACCESSORY_ID}>
          <View style={styles.accessoryBar}>
            <TouchableOpacity onPress={() => Keyboard.dismiss()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.accessoryDone}>Fertig</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
      <GymPickerSheet
        visible={gymPickerVisible}
        title="Gym als Ort wählen"
        currentGymId={gym?.id ?? null}
        onClose={() => setGymPickerVisible(false)}
        onSelect={handlePickGym}
      />
      <LocationPickerModal
        visible={locationPickerVisible}
        onClose={() => setLocationPickerVisible(false)}
        onConfirm={(lat, lng, displayAddress) => {
          setPickedCoord({ lat, lng });
          setAddress(displayAddress);
          setLocationPickerVisible(false);
        }}
      />
      <View style={styles.container}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.heading}>
              {isEditMode ? 'Sparring bearbeiten' : isUserMode ? 'Sparring anmelden' : 'Sparring planen'}
            </Text>
            {isUserMode && !isEditMode && (
              <Text style={styles.subHeading}>Plane dein eigenes Sparring</Text>
            )}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: keyboardHeight }}
        >

          {/* User mode: optional name field */}
          {isUserMode && (
            <>
              <FieldLabel icon="create-outline" text="Name" hint="Optional – sonst automatisch benannt" />
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="z.B. Lockeres Boxsparring"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="done"
                blurOnSubmit={true}
              />
            </>
          )}

          {/* Coach mode: required title field */}
          {!isUserMode && (
            <>
              <FieldLabel icon="create-outline" text="Titel" />
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="z.B. Offenes Boxsparring"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="done"
                blurOnSubmit={true}
              />
            </>
          )}

          {isUserMode && !locationLocked && (
            <>
              <FieldLabel icon="business-outline" text="Gym" hint="Optional" />
              {gym !== null ? (
                <View style={styles.gymBox}>
                  <View style={styles.gymBoxHead}>
                    <View style={styles.gymBoxText}>
                      <Text style={styles.gymName} numberOfLines={2}>{gym.name}</Text>
                      <Text style={styles.gymCity} numberOfLines={1}>{gym.city}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setGymPickerVisible(true)} hitSlop={8} accessibilityRole="button">
                      <Text style={styles.gymAction}>Ändern</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={clearGym} hitSlop={8} accessibilityRole="button" accessibilityLabel="Gym entfernen">
                      <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {(gym.address === null || gym.address.trim().length === 0) && (
                    <Text style={styles.lockedHint}>Für dieses Gym ist keine Adresse hinterlegt. Gib den Treffpunkt unten an.</Text>
                  )}
                  <TextInput
                    style={styles.input}
                    value={accessNote}
                    onChangeText={(t) => { setAccessNote(t); setGymTouched(true); }}
                    placeholder="Zugang, z. B. Gäste nach Absprache (optional)"
                    placeholderTextColor={colors.textSecondary}
                    maxLength={GYM_LIMITS.accessNote}
                    returnKeyType="done"
                    blurOnSubmit
                    accessibilityLabel="Zugangshinweis"
                  />
                  <Text style={styles.lockedHint}>
                    Das Sparring bleibt dein Treffen, das Gym ist nur der Ort. Kläre den Zugang vorher mit dem Gym.
                  </Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.gymPick} onPress={() => setGymPickerVisible(true)} activeOpacity={0.7} accessibilityRole="button">
                  <Ionicons name="add-circle-outline" size={18} color={colors.accentBlue} />
                  <Text style={styles.gymPickText}>Gym als Ort wählen</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {isUserMode && (
            <>
              <FieldLabel icon="location-outline" text="Ort" />
              <View style={styles.locationRow}>
                <TextInput
                  style={[styles.input, styles.locationInput, locationLocked && styles.inputDisabled]}
                  value={address}
                  editable={!locationLocked}
                  onChangeText={(t) => {
                    if (locationLocked) return;
                    setAddress(t);
                    // Manual edit clears the map-picked coordinates
                    if (pickedCoord !== null) setPickedCoord(null);
                  }}
                  placeholder="Adresse eingeben"
                  placeholderTextColor={colors.textSecondary}
                  returnKeyType="done"
                  blurOnSubmit={true}
                />
                <TouchableOpacity
                  style={[styles.mapPickBtn, locationLocked && styles.mapPickBtnDisabled]}
                  onPress={() => { if (!locationLocked) setLocationPickerVisible(true); }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="map-outline"
                    size={18}
                    color={pickedCoord !== null ? colors.card : colors.accentBlue}
                  />
                </TouchableOpacity>
              </View>
              {isEditMode && locationLocked && (
                <Text style={styles.lockedHint}>Der Ort eines Studio-Sparrings ist das Studio.</Text>
              )}
              {pickedCoord !== null && !locationLocked && (
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

          {showAtStudioCheckbox && !isEditMode && (
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

          {/* Max. Plätze as Stepper — User mode */}
          {isUserMode && (
            <>
              <FieldLabel icon="people-outline" text="Max. Plätze" />
              <Stepper value={maxSlots} onChange={setMaxSlots} min={1} />
              {/* Fixed at 90 when creating; adjustable once the sparring exists */}
              {isEditMode && (
                <>
                  <FieldLabel icon="hourglass-outline" text="Dauer (Min.)" />
                  <Stepper value={durationMin} onChange={setDurationMin} min={15} step={15} />
                </>
              )}
            </>
          )}

          <FieldLabel icon="barbell-outline" text="Kampfsport" />
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

          {/* Datum + Uhrzeit nebeneinander in beiden Modi */}
          <View style={styles.twoCol}>
            <View style={styles.colItem}>
              <FieldLabel icon="calendar-outline" text="Datum" />
              <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.inputText}>{formatDate(scheduledAt)}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.colItem}>
              <FieldLabel icon="time-outline" text="Uhrzeit" />
              <TouchableOpacity style={styles.input} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.inputText}>{formatTime(scheduledAt)}</Text>
              </TouchableOpacity>
            </View>
          </View>

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

          {/* Coach mode: Dauer + Max. Plätze (Stepper) */}
          {!isUserMode && (
            <View style={styles.twoCol}>
              <View style={styles.colItem}>
                <FieldLabel icon="hourglass-outline" text="Dauer (Min.)" />
                <Stepper value={durationMin} onChange={setDurationMin} min={15} step={15} />
              </View>
              <View style={styles.colItem}>
                <FieldLabel icon="people-outline" text="Max. Plätze" />
                <Stepper value={maxSlots} onChange={setMaxSlots} min={1} />
              </View>
            </View>
          )}

          <FieldLabel icon="document-text-outline" text="Hinweise (optional)" />
          <TextInput
            style={[styles.input, styles.multiline]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Level, Ausrüstung, Hinweise..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
            inputAccessoryViewID={Platform.OS === 'ios' ? NOTES_ACCESSORY_ID : undefined}
            onFocus={() => {
              notesFocusedRef.current = true;
              setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
            }}
            onBlur={() => { notesFocusedRef.current = false; }}
          />

          {filterError !== null && <Text style={styles.filterError}>{filterError}</Text>}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <View style={styles.btnContent}>
                <Ionicons
                  name={isEditMode ? 'checkmark-outline' : 'megaphone-outline'}
                  size={18}
                  color={colors.card}
                  style={styles.btnIcon}
                />
                <Text style={styles.btnText}>{isEditMode ? 'Änderungen speichern' : 'Veröffentlichen'}</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.bottomPad} />
        </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.mapOverlay,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
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
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerTextBlock: {
    flex: 1,
    marginRight: 8,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  subHeading: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textSecondary,
    marginTop: 2,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
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
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnIcon: {
    marginTop: 1,
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
  accessoryBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  accessoryDone: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  mapPickBtnDisabled: {
    opacity: 0.35,
  },
  gymBox: {
    gap: 8,
  },
  gymBoxHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  gymBoxText: {
    flex: 1,
  },
  gymName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  gymCity: {
    fontSize: 13,
    color: colors.textMuted,
  },
  gymAction: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentBlueText,
  },
  gymPick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  gymPickText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentBlueText,
  },
  lockedHint: {
    fontSize:  12,
    color:     colors.textSecondary,
    marginTop: 8,
  },
  filterError: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: colors.deleteRed,
    marginTop: 8,
  },
});
