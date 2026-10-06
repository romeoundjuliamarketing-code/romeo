import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Platform, Keyboard,
  type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import type { CreateSparringInput } from '../../../hooks/useSparringActions';
import type { Gym } from '../../../hooks/useGyms';
import { useBannedWords } from '../../../hooks/useBannedWords';
import { checkText, filterErrorMessage } from '../../../utils/contentFilter';
import {
  emptyDraft, applyGym, applyStudio, clearPlace, toCustomMeetingPoint, validateStep, firstStepWithError,
  isDraftDirty, buildCreateInput, resolvedTitle, defaultSparringTitle, CREATE_DURATION_MIN,
  type SparringDraft, type DraftErrors, type DraftGym, type DraftStudio, type FlowStep,
} from '../../../utils/sparringDraft';
import GymPickerSheet from '../../gym/GymPickerSheet';
import LocationPickerModal from '../LocationPickerModal';
import FlowHeader from './FlowHeader';
import StepWhat from './StepWhat';
import WhenPicker from './WhenPicker';
import PlaceSection, { type PlaceActions } from './PlaceSection';
import StepPreview from './StepPreview';
import InvitationPreview from './InvitationPreview';
import { StepTitle, SectionLabel, StepTransition } from './FlowParts';

type FlowErrors = DraftErrors & { title?: string; notes?: string };

function toDraftGym(g: Gym): DraftGym {
  return { id: g.id, name: g.name, city: g.city, address: g.address, lat: g.lat, lng: g.lng };
}

interface Props {
  visible:      boolean;
  /** Team studio of a coach: enables "Am Studio-Standort". */
  coachStudio:  DraftStudio | null;
  /** Entry from a gym page: this gym is preselected as the place. */
  initialGym:   Gym | null;
  onClose:      () => void;
  /** Resolves true when the sparring was saved; false keeps every input. */
  onCreate:     (input: CreateSparringInput) => Promise<boolean>;
}

// Full-screen, three-step create flow: what -> when/where -> preview + publish.
// The draft lives here so going back and forth keeps every input.
export default function CreateSparringFlow({ visible, coachStudio, initialGym, onClose, onCreate }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { bannedWords } = useBannedWords();

  const [draft, setDraft] = useState<SparringDraft>(() => emptyDraft(new Date()));
  const initialRef = useRef<SparringDraft>(draft);
  const [step, setStep] = useState<FlowStep>(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [errors, setErrors] = useState<FlowErrors>({});
  const [publishing, setPublishing] = useState(false);
  const publishingRef = useRef(false);
  const [gymPickerVisible, setGymPickerVisible] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const reset = useCallback((next: SparringDraft) => {
    initialRef.current = next;
    setDraft(next);
    setStep(1);
    setDirection(1);
    setErrors({});
  }, []);

  // Gym page entry: start a fresh draft with that gym once it has loaded.
  // A draft kept from an interrupted publish (e.g. paywall) survives a reopen
  // from the same entry point.
  const appliedGymIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!visible || initialGym === null || appliedGymIdRef.current === initialGym.id) return;
    appliedGymIdRef.current = initialGym.id;
    reset(applyGym(emptyDraft(new Date()), toDraftGym(initialGym)));
  }, [visible, initialGym, reset]);

  // Footer hides while typing; Android also pads the content by the keyboard
  // (iOS adjusts the scroll insets natively).
  useEffect(() => {
    if (!visible) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); setKeyboardHeight(0); };
  }, [visible]);

  const update = useCallback((fn: (d: SparringDraft) => SparringDraft, clear: (keyof FlowErrors)[]) => {
    setDraft(fn);
    setErrors((prev) => {
      if (!clear.some((k) => prev[k] !== undefined)) return prev;
      const next = { ...prev };
      for (const k of clear) delete next[k];
      return next;
    });
  }, []);

  function finish(): void {
    appliedGymIdRef.current = null;
    reset(emptyDraft(new Date()));
    onClose();
  }

  function goTo(next: FlowStep): void {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  function handleBack(): void {
    if (publishing) return;
    if (gymPickerVisible || mapVisible) return;
    if (step > 1) {
      goTo((step - 1) as FlowStep);
      return;
    }
    if (!isDraftDirty(draft, initialRef.current)) {
      finish();
      return;
    }
    Alert.alert('Entwurf verwerfen?', 'Deine Angaben für dieses Sparring gehen verloren.', [
      { text: 'Weiter bearbeiten', style: 'cancel' },
      { text: 'Verwerfen', style: 'destructive', onPress: finish },
    ]);
  }

  // Content filter like the old sheet: title, notes, meeting point, access note.
  function filterErrors(d: SparringDraft): FlowErrors {
    const out: FlowErrors = {};
    const check = (text: string): string | undefined => {
      const verdict = checkText(text, bannedWords);
      return verdict.ok ? undefined : filterErrorMessage(verdict.category);
    };
    const t = check(d.title);
    if (t !== undefined) out.title = t;
    const n = check(d.notes);
    if (n !== undefined) out.notes = n;
    const p = check(d.address) ?? check(d.accessNote);
    if (p !== undefined) out.place = p;
    return out;
  }

  function handleNext(): void {
    const now = new Date();
    const stepErrors: FlowErrors = validateStep(step, draft, now);
    if (step === 2 && stepErrors.place === undefined) {
      const placeFilter = filterErrors(draft).place;
      if (placeFilter !== undefined) stepErrors.place = placeFilter;
    }
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    goTo((step + 1) as FlowStep);
  }

  async function handlePublish(): Promise<void> {
    if (publishingRef.current) return;
    Keyboard.dismiss();
    const all: FlowErrors = { ...validateStep(3, draft, new Date()), ...filterErrors(draft) };
    setErrors(all);
    const back = firstStepWithError(all);
    if (back !== null) {
      goTo(back);
      return;
    }
    if (all.title !== undefined || all.notes !== undefined) return;
    const input = buildCreateInput(draft, coachStudio?.id ?? null);
    if (input === null) return;
    publishingRef.current = true;
    setPublishing(true);
    let saved = false;
    try {
      saved = await onCreate(input);
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
    if (saved) finish();
  }

  // Stable callbacks for the place section.
  const placeActions = useMemo<PlaceActions>(() => ({
    onPickGym:       () => setGymPickerVisible(true),
    onSearchAddress: () => update((d) => ({ ...d, source: 'custom', address: '', coord: null }), ['place']),
    onOpenMap:       () => setMapVisible(true),
    onAddress:       (text) => update((d) => ({ ...d, address: text, coord: null }), ['place']),
    onClearAddress:  () => update((d) => ({ ...d, address: '', coord: null }), []),
    onClearPlace:    () => update(clearPlace, ['place']),
    onUseStudio:     () => { if (coachStudio !== null) update((d) => applyStudio(d, coachStudio), ['place']); },
    onUseGymAddress: () => update((d) => (d.gym !== null ? applyGym({ ...d, source: null }, d.gym) : d), ['place']),
    onCustomMeeting: () => update(toCustomMeetingPoint, []),
    onAccessNote:    (text) => update((d) => ({ ...d, accessNote: text }), ['place']),
  }), [coachStudio, update]);

  const onDiscipline = useCallback((d: string) => update((x) => ({ ...x, discipline: d }), ['discipline']), [update]);
  const onMaxSlots = useCallback((n: number) => update((x) => ({ ...x, maxSlots: n }), ['maxSlots']), [update]);
  const onWhen = useCallback((d: Date) => update((x) => ({ ...x, scheduledAt: d }), ['scheduledAt']), [update]);
  const onTitle = useCallback((t: string) => update((x) => ({ ...x, title: t }), ['title']), [update]);
  const onNotes = useCallback((t: string) => update((x) => ({ ...x, notes: t }), ['notes']), [update]);
  const onNotesFocus = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
  }, []);

  const keyboardOpen = keyboardHeight > 0;
  const title = resolvedTitle(draft);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleBack}
    >
      <View style={styles.root}>
        <FlowHeader step={step} onBack={handleBack} disabled={publishing} />

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            Platform.OS === 'android' && keyboardOpen ? { paddingBottom: keyboardHeight + 24 } : null,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <StepTransition key={step} direction={direction}>
            {step === 1 && (
              <StepWhat
                discipline={draft.discipline}
                maxSlots={draft.maxSlots}
                errors={errors}
                onDiscipline={onDiscipline}
                onMaxSlots={onMaxSlots}
              />
            )}
            {step === 2 && (
              <View>
                <StepTitle text="Wann und wo?" />
                <SectionLabel text="Termin" />
                <WhenPicker value={draft.scheduledAt} error={errors.scheduledAt} onChange={onWhen} />
                <View style={styles.rope} />
                <SectionLabel text="Ort" hint="Ein Gym oder ein eigener Treffpunkt." />
                <PlaceSection
                  gym={draft.gym}
                  source={draft.source}
                  address={draft.address}
                  hasCoord={draft.coord !== null}
                  accessNote={draft.accessNote}
                  studioAddress={coachStudio?.address ?? null}
                  error={errors.place}
                  actions={placeActions}
                />
              </View>
            )}
            {step === 3 && (
              <StepPreview
                preview={
                  <InvitationPreview
                    badge="Vorschau"
                    discipline={draft.discipline}
                    title={title}
                    scheduledAtMs={draft.scheduledAt.getTime()}
                    gymName={draft.gym?.name ?? null}
                    address={draft.address}
                    atStudio={draft.source === 'studio'}
                    slotsText={`${draft.maxSlots} ${draft.maxSlots === 1 ? 'Platz' : 'Plätze'} frei`}
                    footnote="ohne dich als Gastgeber"
                    durationMin={CREATE_DURATION_MIN}
                  />
                }
                title={draft.title}
                autoTitle={draft.discipline !== null ? defaultSparringTitle(draft.discipline) : 'Automatischer Titel'}
                notes={draft.notes}
                titleError={errors.title}
                notesError={errors.notes}
                onTitle={onTitle}
                onNotes={onNotes}
                onNotesFocus={onNotesFocus}
              />
            )}
          </StepTransition>
        </ScrollView>

        {!keyboardOpen && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[styles.primary, publishing && styles.primaryBusy]}
              onPress={step === 3 ? () => { void handlePublish(); } : handleNext}
              disabled={publishing}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ disabled: publishing, busy: publishing }}
            >
              {publishing ? (
                <>
                  <ActivityIndicator color={colors.headerTextPrimary} />
                  <Text style={styles.primaryText}>Wird veröffentlicht …</Text>
                </>
              ) : (
                <>
                  <Text style={styles.primaryText}>{step === 3 ? 'Sparring veröffentlichen' : 'Weiter'}</Text>
                  <Ionicons name={step === 3 ? 'megaphone-outline' : 'arrow-forward'} size={20} color={colors.headerTextPrimary} />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Child modals of the open flow (iOS cannot show sibling modals). */}
        <GymPickerSheet
          visible={gymPickerVisible}
          title="Gym als Ort wählen"
          currentGymId={draft.gym?.id ?? null}
          onClose={() => setGymPickerVisible(false)}
          onSelect={async (picked) => {
            update((d) => applyGym(d, toDraftGym(picked)), ['place']);
            return true;
          }}
        />
        <LocationPickerModal
          visible={mapVisible}
          onClose={() => setMapVisible(false)}
          onConfirm={(lat, lng, displayAddress) => {
            update((d) => ({ ...d, source: 'custom', address: displayAddress, coord: { lat, lng } }), ['place']);
            setMapVisible(false);
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
    flexGrow: 1,
  },
  rope: {
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.hairline,
    marginVertical: 32,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  primary: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.accentBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  primaryBusy: {
    backgroundColor: colors.accentBluePressed,
  },
  primaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
});
