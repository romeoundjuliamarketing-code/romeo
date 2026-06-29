import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  Keyboard,
  Dimensions,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  ScrollView as GHScrollView,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { CreateEventParams } from '../../hooks/useEventActions';
import { useEventActions } from '../../hooks/useEventActions';
import { geocodeAddress } from '../../utils/geocoding';
import LocationPickerModal from './LocationPickerModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_SHEET_RATIO     = 0.92;   // sheet never grows past this share of the screen
const OFF_SCREEN          = SCREEN_HEIGHT;
const DISMISS_RATIO       = 0.22;   // drag past this share of the screen -> dismiss
const VELOCITY_PROJECTION = 150;

// ── Internal helper: FieldLabel ───────────────────────────────────────────────
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

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
};

function Stepper({ value, onChange, min = 1 }: StepperProps) {
  const numVal = parseInt(value, 10);
  const current = isNaN(numVal) ? min : numVal;

  function decrement(): void {
    const next = Math.max(min, current - 1);
    onChange(String(next));
  }

  function increment(): void {
    onChange(String(current + 1));
  }

  function handleChangeText(v: string): void {
    onChange(v.replace(/[^0-9]/g, ''));
  }

  function handleBlur(): void {
    const parsed = parseInt(value, 10);
    if (value.trim().length === 0 || isNaN(parsed) || parsed < min) {
      onChange(String(min));
    }
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
      <TextInput
        style={stepperStyles.value}
        value={value}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        keyboardType="number-pad"
        maxLength={3}
        selectTextOnFocus
        textAlign="center"
      />
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
    height: 48,
    padding: 0,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
});

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  visible:    boolean;
  onClose:    () => void;
  onCreate:   (params: CreateEventParams) => void | Promise<void>;
  /** When set: free venue-event path (skips location + payment). */
  venueId?:   string;
  /** Called after a successful venue-event creation, before onClose. */
  onCreated?: () => void;
}

function nextDay18h(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return d;
}

export default function CreateEventSheet({ visible, onClose, onCreate, venueId, onCreated }: Props) {
  const { createVenueEvent } = useEventActions();

  const [title,                setTitle]                = useState('');
  const [fightCard,            setFightCard]            = useState('');
  const [venueName,            setVenueName]            = useState('');
  const [address,              setAddress]              = useState('');
  const [pickedCoord,          setPickedCoord]          = useState<{ lat: number; lng: number } | null>(null);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [scheduledAt,          setScheduledAt]          = useState<Date>(nextDay18h);
  const [showDatePicker,       setShowDatePicker]       = useState(false);
  const [showTimePicker,       setShowTimePicker]       = useState(false);
  const [maxSlots,             setMaxSlots]             = useState('20');
  const [notes,                setNotes]                = useState('');
  const [loading,              setLoading]              = useState(false);

  // Address text-search state (non-venue path only)
  const [addressQuery, setAddressQuery] = useState('');
  const [geocoding,    setGeocoding]    = useState(false);

  // ── Draggable-sheet + keyboard machinery ──────────────────────────────────
  const insets    = useSafeAreaInsets();
  const translateY = useSharedValue(OFF_SCREEN);
  const keyboardH  = useSharedValue(0);
  const startY     = useSharedValue(0);
  const scrollRef  = useRef<React.ComponentRef<typeof GHScrollView>>(null);

  // Content-driven sizing: measure header + scroll content so the sheet fits exactly
  // (capped at MAX) and sits flush at the bottom with no empty gap.
  const MAX_SHEET_H = SCREEN_HEIGHT * MAX_SHEET_RATIO;
  const [sheetHeight, setSheetHeight] = useState<number | null>(null);
  const headerH       = useRef(0);
  const contentInnerH = useRef(0);
  const hasEnteredRef = useRef(false);

  function recomputeSize(): void {
    if (headerH.current <= 0 || contentInnerH.current <= 0) return;
    const total = headerH.current + contentInnerH.current;
    setSheetHeight(Math.min(total, MAX_SHEET_H));
    if (!hasEnteredRef.current) {
      hasEnteredRef.current = true;
      translateY.value = withSpring(0, { damping: 18, stiffness: 140 });
    }
  }

  function clampYWorklet(v: number): number {
    'worklet';
    return Math.min(OFF_SCREEN, Math.max(0, v));
  }

  function dismiss(): void {
    Keyboard.dismiss();
    translateY.value = withTiming(OFF_SCREEN, { duration: 220 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }

  function settle(position: number, vy: number): void {
    'worklet';
    const projected = position + vy * VELOCITY_PROJECTION;
    if (projected > SCREEN_HEIGHT * DISMISS_RATIO) {
      runOnJS(dismiss)();
    } else {
      translateY.value = withSpring(0, { damping: 18, stiffness: 140 });
    }
  }

  // Animate in / out with the Modal's `visible` flag.
  useEffect(() => {
    if (visible) {
      hasEnteredRef.current = false;
      translateY.value = OFF_SCREEN;
      // Size + slide in once measured (layout callbacks below), or immediately on
      // a re-open where the content was already measured.
      recomputeSize();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Lift the sheet above the soft keyboard (smoother than KeyboardAvoidingView,
  // and it composes with the drag transform).
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => {
      keyboardH.value = withTiming(e.endCoordinates.height, { duration: 220 });
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      keyboardH.value = withTiming(0, { duration: 200 });
    });
    return () => { showSub.remove(); hideSub.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drag the whole sheet by its header handle.
  const handlePan = Gesture.Pan()
    .onStart(() => {
      'worklet';
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      'worklet';
      translateY.value = clampYWorklet(startY.value + e.translationY);
    })
    .onEnd((e) => {
      'worklet';
      settle(translateY.value, e.velocityY);
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value - keyboardH.value }],
  }));

  function formatDate(d: Date): string {
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatTime(d: Date): string {
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  function resetFields(): void {
    setTitle('');
    setFightCard('');
    setVenueName('');
    setAddress('');
    setPickedCoord(null);
    setMaxSlots('20');
    setNotes('');
    setScheduledAt(nextDay18h());
    setAddressQuery('');
  }

  // Address geocoding search handler (non-venue path)
  async function handleAddressSearch(): Promise<void> {
    const q = addressQuery.trim();
    if (q.length === 0) return;
    setGeocoding(true);
    const coords = await geocodeAddress(q);
    setGeocoding(false);
    if (coords === null) {
      Alert.alert('Nicht gefunden', 'Zu dieser Adresse wurden keine Koordinaten gefunden.');
      return;
    }
    setPickedCoord({ lat: coords.lat, lng: coords.lng });
    setAddress(q);
  }

  // ── Venue-bound (free) path ───────────────────────────────────────────────
  async function handleCreateVenueEvent(): Promise<void> {
    if (venueId === undefined) return;

    if (title.trim().length === 0) {
      Alert.alert('Titel fehlt', 'Bitte gib einen Titel ein.');
      return;
    }
    if (fightCard.trim().length === 0) {
      Alert.alert('Kampfkarte fehlt', 'Bitte gib an, was gezeigt wird.');
      return;
    }
    const slots = parseInt(maxSlots, 10);
    if (isNaN(slots) || slots < 1) {
      Alert.alert('Ungültige Plätze', 'Bitte gib mindestens 1 Platz ein.');
      return;
    }

    setLoading(true);
    const { error } = await createVenueEvent(venueId, {
      title:       title.trim(),
      fightCard:   fightCard.trim(),
      scheduledAt: scheduledAt.toISOString(),
      durationMin: 120,
      maxSlots:    slots,
      notes:       notes.trim(),
    });
    setLoading(false);

    if (error !== null) {
      Alert.alert('Fehler', error);
      return;
    }

    resetFields();
    onCreated?.();
    dismiss();
  }

  // ── Standard (paid) path ──────────────────────────────────────────────────
  async function handleCreate(): Promise<void> {
    if (title.trim().length === 0) {
      Alert.alert('Titel fehlt', 'Bitte gib einen Titel ein.');
      return;
    }
    if (fightCard.trim().length === 0) {
      Alert.alert('Kampfkarte fehlt', 'Bitte gib an, was gezeigt wird.');
      return;
    }
    if (address.trim().length === 0 || pickedCoord === null) {
      Alert.alert('Standort fehlt', 'Bitte wähle einen Standort auf der Karte aus oder suche eine Adresse.');
      return;
    }
    const slots = parseInt(maxSlots, 10);
    if (isNaN(slots) || slots < 1) {
      Alert.alert('Ungültige Plätze', 'Bitte gib mindestens 1 Platz ein.');
      return;
    }

    const params: CreateEventParams = {
      title:       title.trim(),
      fightCard:   fightCard.trim(),
      venueName:   venueName.trim(),
      address:     address.trim(),
      lat:         pickedCoord.lat,
      lng:         pickedCoord.lng,
      scheduledAt: scheduledAt.toISOString(),
      durationMin: 120,
      maxSlots:    slots,
      notes:       notes.trim(),
    };

    setLoading(true);
    await onCreate(params);
    setLoading(false);
    resetFields();
    dismiss();
  }

  const isVenuePath = venueId !== undefined;

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={dismiss}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        {/* LocationPickerModal is only needed for the standard path */}
        {!isVenuePath && (
          <LocationPickerModal
            visible={locationPickerVisible}
            onClose={() => setLocationPickerVisible(false)}
            onConfirm={(lat, lng, displayAddress) => {
              setPickedCoord({ lat, lng });
              setAddress(displayAddress);
              setAddressQuery('');
              setLocationPickerVisible(false);
            }}
          />
        )}
        <View style={styles.container}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={dismiss} />
          <Animated.View
            style={[styles.sheet, sheetHeight !== null && { height: sheetHeight }, animatedSheetStyle]}
          >

            {/* Drag handle + header */}
            <GestureDetector gesture={handlePan}>
              <View
                style={styles.header}
                onLayout={(e) => { headerH.current = e.nativeEvent.layout.height; recomputeSize(); }}
              >
                <View style={styles.handle} />
                <View style={styles.headerRow}>
                  <View style={styles.headerTextBlock}>
                    <Text style={styles.heading}>Event erstellen</Text>
                    <Text style={styles.subHeading}>
                      {isVenuePath ? 'Kostenlos für dein Venue' : 'Public Viewing für deine Community'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            </GestureDetector>

            <GHScrollView
              ref={scrollRef}
              style={styles.scrollView}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={(_w, h) => { contentInnerH.current = h; recomputeSize(); }}
            >

            {/* Fee hint — only for standard paid path */}
            {!isVenuePath && (
              <View style={styles.feeHint}>
                <Ionicons name="information-circle-outline" size={16} color={colors.accentBlue} />
                <Text style={styles.feeHintText}>
                  Das Erstellen eines Events kostet eine einmalige Gebühr von 8,99 Euro.
                </Text>
              </View>
            )}

            {/* Venue-path location note */}
            {isVenuePath && (
              <View style={styles.feeHint}>
                <Ionicons name="location-outline" size={16} color={colors.accentBlue} />
                <Text style={styles.feeHintText}>Findet in deiner Location statt.</Text>
              </View>
            )}

            <FieldLabel icon="create-outline" text="Titel" />
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="z.B. Public Viewing UFC 320"
              placeholderTextColor={colors.textSecondary}
            />

            <FieldLabel icon="tv-outline" text="Was wird gezeigt" />
            <TextInput
              style={styles.input}
              value={fightCard}
              onChangeText={setFightCard}
              placeholder="z.B. UFC 320 – Jones vs. Aspinall"
              placeholderTextColor={colors.textSecondary}
            />

            {/* Venue name — only shown in the standard path */}
            {!isVenuePath && (
              <>
                <FieldLabel icon="business-outline" text="Venue-Name" hint="Optional" />
                <TextInput
                  style={styles.input}
                  value={venueName}
                  onChangeText={setVenueName}
                  placeholder="z.B. Sports Bar München"
                  placeholderTextColor={colors.textSecondary}
                />
              </>
            )}

            {/* Location block — only shown in the standard path */}
            {!isVenuePath && (
              <>
                <FieldLabel icon="location-outline" text="Standort" />

                {/* Map picker row */}
                <View style={styles.locationRow}>
                  <TextInput
                    style={[styles.input, styles.locationInput]}
                    value={address}
                    editable={false}
                    placeholder="Auf Karte auswählen"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <TouchableOpacity
                    style={styles.mapPickBtn}
                    onPress={() => setLocationPickerVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="map-outline"
                      size={18}
                      color={pickedCoord !== null ? colors.card : colors.accentBlue}
                    />
                  </TouchableOpacity>
                </View>

                {/* Address text-search row */}
                <View style={[styles.locationRow, styles.addressSearchRow]}>
                  <TextInput
                    style={[styles.input, styles.locationInput]}
                    value={addressQuery}
                    onChangeText={setAddressQuery}
                    placeholder="Adresse eingeben"
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="search"
                    onSubmitEditing={() => { void handleAddressSearch(); }}
                  />
                  <TouchableOpacity
                    style={[styles.mapPickBtn, geocoding && styles.mapPickBtnLoading]}
                    onPress={() => { void handleAddressSearch(); }}
                    disabled={geocoding}
                    activeOpacity={0.8}
                  >
                    {geocoding ? (
                      <ActivityIndicator size="small" color={colors.accentBlue} />
                    ) : (
                      <Ionicons name="search-outline" size={18} color={colors.accentBlue} />
                    )}
                  </TouchableOpacity>
                </View>

                {/* Confirmed location badge */}
                {pickedCoord !== null && (
                  <View style={styles.pickedBadge}>
                    <Ionicons name="location" size={13} color={colors.accentBlue} />
                    <Text style={styles.pickedBadgeText} numberOfLines={1}>{address}</Text>
                    <TouchableOpacity
                      onPress={() => { setPickedCoord(null); setAddress(''); setAddressQuery(''); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={15} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* Datum + Uhrzeit */}
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

            {/* Venue/partner events are public viewings without an attendance cap,
                so the slot count is only asked for on the standard (paid) path. */}
            {!isVenuePath && (
              <>
                <FieldLabel icon="people-outline" text="Max. Plätze" />
                <Stepper value={maxSlots} onChange={setMaxSlots} min={1} />
              </>
            )}

            <FieldLabel icon="document-text-outline" text="Hinweise (optional)" />
            <TextInput
              style={[styles.input, styles.multiline]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Eintritt, Dresscode, Hinweise..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={isVenuePath
                ? () => { void handleCreateVenueEvent(); }
                : () => { void handleCreate(); }
              }
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.card} />
              ) : (
                <View style={styles.btnContent}>
                  <Ionicons name="tv-outline" size={18} color={colors.card} style={styles.btnIcon} />
                  <Text style={styles.btnText}>Event erstellen</Text>
                </View>
              )}
            </TouchableOpacity>

            </GHScrollView>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
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
    maxHeight: SCREEN_HEIGHT * MAX_SHEET_RATIO,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
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
  feeHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  feeHintText: {
    flex: 1,
    fontSize: 13,
    color: colors.accentBlue,
    lineHeight: 18,
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
  locationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addressSearchRow: {
    marginTop: 8,
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
  mapPickBtnLoading: {
    opacity: 0.6,
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
});
