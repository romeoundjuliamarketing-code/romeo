import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, Platform, Keyboard,
  type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import type { Gym } from '../../../hooks/useGyms';
import { useBannedWords } from '../../../hooks/useBannedWords';
import { useSparringTrustActions } from '../../../hooks/useSparringTrustActions';
import { getLocationPermissionState, openLocationSettings } from '../../../hooks/useDeviceFix';
import { checkText, filterErrorMessage } from '../../../utils/contentFilter';
import type { TrustAction } from '../../../utils/sparringTrust';
import type { SparringPlace } from '../../../types/sparringTrust';
import {
  emptyDraft, applyGym, applyStudio, clearPlace, clearLink, selectPlace, validateStep, firstStepWithError,
  isDraftDirty, buildPublishInput, resolvedTitle, defaultSparringTitle, gymSearchQuery, studioSearchQuery,
  type SparringDraft, type DraftErrors, type DraftGym, type DraftStudio, type FlowStep,
} from '../../../utils/sparringDraft';
import GymPickerSheet from '../../gym/GymPickerSheet';
import TrustNoticeCard, { type TrustProblem } from '../trust/TrustNoticeCard';
import LocationPrimerContent from '../trust/LocationPrimerContent';
import ReachIntroContent from '../trust/ReachIntroContent';
import FlowHeader from './FlowHeader';
import FlowOverlay from './FlowOverlay';
import StepWhat from './StepWhat';
import WhenPicker from './WhenPicker';
import DurationChips from './DurationChips';
import PlaceSection, { type PlaceActions, type SearchPrefill } from './PlaceSection';
import StepPreview from './StepPreview';
import InvitationPreview from './InvitationPreview';
import { StepTitle, SectionLabel, StepTransition } from './FlowParts';
import { useCreateDraftStore } from './useCreateDraftStore';
import { useCreateFlowChecks } from './useCreateFlowChecks';

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
  /** Called only after the server confirmed the publication. */
  onPublished:  (sparringId: string) => void;
  /** Server: creator subscription missing. Caller closes the flow and shows the paywall alert; the draft stays stored. */
  onSubscriptionRequired: () => void;
  /** "Zu meinem Sparring" in the slot notice. Caller closes the flow and opens that sparring. */
  onOpenSparring: (sparringId: string) => void;
  /** "Sparrings in meiner Nähe" in the too-far notice. Caller closes the flow and shows nearby sparrings. */
  onShowNearby: () => void;
}

// Full-screen, three-step create flow: what -> when/where -> preview + publish.
// The draft lives here so going back and forth keeps every input.
export default function CreateSparringFlow({
  visible, coachStudio, initialGym, onClose, onPublished, onSubscriptionRequired, onOpenSparring, onShowNearby,
}: Props): React.ReactElement {
  const { t } = useTranslation();
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
  const [overlay, setOverlay] = useState<'primer' | 'rules' | null>(null);
  const [problem, setProblem] = useState<TrustProblem | null>(null);
  const [permissionMissing, setPermissionMissing] = useState(false);
  const [prefill, setPrefill] = useState<SearchPrefill | null>(null);
  const prefillNonce = useRef(0);
  const { publish } = useSparringTrustActions();
  const { blocker, placeNotice } = useCreateFlowChecks(visible, draft.place);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const reset = useCallback((next: SparringDraft) => {
    initialRef.current = next;
    setDraft(next);
    setStep(1);
    setDirection(1);
    setErrors({});
    setProblem(null);
    setPermissionMissing(false);
  }, []);

  const startPrefill = useCallback((text: string) => {
    prefillNonce.current += 1;
    setPrefill({ text, nonce: prefillNonce.current });
  }, []);

  const store = useCreateDraftStore({
    visible,
    draft,
    dirty: isDraftDirty(draft, initialRef.current),
    onLoaded: (restored) => {
      if (restored !== null) {
        if (initialGym !== null) appliedGymIdRef.current = initialGym.id;
        reset(restored);
      }
    },
  });

  // Gym page entry: start a fresh draft with that gym once it has loaded and
  // no stored draft was restored.
  const appliedGymIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!visible || !store.ready || initialGym === null || appliedGymIdRef.current === initialGym.id) return;
    appliedGymIdRef.current = initialGym.id;
    reset(applyGym(emptyDraft(new Date()), toDraftGym(initialGym)));
    startPrefill(gymSearchQuery(toDraftGym(initialGym)));
  }, [visible, store.ready, initialGym, reset, startPrefill]);

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

  function discard(): void {
    void store.discard();
    finish();
  }

  function goTo(next: FlowStep): void {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  function handleBack(): void {
    if (overlay !== null) {
      setOverlay(null);
      return;
    }
    if (publishing) return;
    if (gymPickerVisible) return;
    if (step > 1) {
      goTo((step - 1) as FlowStep);
      return;
    }
    if (!isDraftDirty(draft, initialRef.current)) {
      finish();
      return;
    }
    Alert.alert(t('sparring.flow.discardTitle'), t('sparring.flow.discardMessage'), [
      { text: t('sparring.flow.keepEditing'), style: 'cancel' },
      { text: t('sparring.flow.discard'), style: 'destructive', onPress: discard },
    ]);
  }

  // Content filter like the old sheet: title, notes, meeting point, access note.
  function filterErrors(d: SparringDraft): FlowErrors {
    const out: FlowErrors = {};
    const check = (text: string): string | undefined => {
      const verdict = checkText(text, bannedWords);
      return verdict.ok ? undefined : filterErrorMessage(verdict.category);
    };
    const titleError = check(d.title);
    if (titleError !== undefined) out.title = titleError;
    const n = check(d.notes);
    if (n !== undefined) out.notes = n;
    const p = check(d.placeLabel) ?? check(d.accessNote);
    if (p !== undefined) out.place = p;
    return out;
  }

  function handleNext(): void {
    if (step === 1 && blocker !== null) return;
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
    if (!draft.permissionConfirmed) {
      setPermissionMissing(true);
      return;
    }
    if (buildPublishInput(draft, coachStudio?.id ?? null) === null) return;
    // Not decided yet, or denied but still askable: explain first, then ask.
    const permission = await getLocationPermissionState();
    if (permission === 'undetermined' || permission === 'denied') {
      setOverlay('primer');
      return;
    }
    await runPublish(false);
  }

  async function runPublish(askPermission: boolean): Promise<void> {
    if (publishingRef.current) return;
    const built = buildPublishInput(draft, coachStudio?.id ?? null);
    if (built === null) return;
    publishingRef.current = true;
    setPublishing(true);
    setProblem(null);
    try {
      const outcome = await publish({ ...built, requestId: store.requestId() }, askPermission);
      if (outcome.kind === 'ok') {
        const id = outcome.data.sparring_id;
        await store.discard();
        appliedGymIdRef.current = null;
        reset(emptyDraft(new Date()));
        onPublished(id);
      } else if (outcome.kind === 'refused' && outcome.refusal.reason === 'subscription_required') {
        onSubscriptionRequired();
      } else {
        setProblem(outcome);
      }
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  }

  function handleTrustAction(action: TrustAction): void {
    const active = problem !== null && problem.kind === 'refused' ? problem.refusal.active_sparring_id : undefined;
    const blockedId = blocker !== null && blocker.kind === 'refused' ? blocker.refusal.active_sparring_id : undefined;
    switch (action) {
      case 'nearby': onShowNearby(); break;
      case 'mySparring': {
        const id = active ?? blockedId;
        if (id !== undefined) onOpenSparring(id);
        break;
      }
      case 'howItWorks': setOverlay('rules'); break;
      case 'settings': openLocationSettings(); break;
      case 'retry': void handlePublish(); break;
    }
  }

  // Stable callbacks for the place section.
  const placeActions = useMemo<PlaceActions>(() => ({
    onPickGym:     () => setGymPickerVisible(true),
    onUseStudio:   () => {
      if (coachStudio === null) return;
      update(applyStudio, ['place']);
      startPrefill(studioSearchQuery(coachStudio));
    },
    onClearLink:   () => update(clearLink, []),
    onPickPlace:   (place: SparringPlace) => update((d) => selectPlace(d, place), ['place']),
    onClearPlace:  () => update(clearPlace, ['place']),
    onLabel:       (text) => update((d) => ({ ...d, placeLabel: text }), ['place']),
    onAccessNote:  (text) => update((d) => ({ ...d, accessNote: text }), ['place']),
    onTrustAction: handleTrustAction,
    onPrefillUsed: () => setPrefill(null),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [coachStudio, update, startPrefill, problem, blocker]);

  const onDiscipline = useCallback((d: string) => update((x) => ({ ...x, discipline: d }), ['discipline']), [update]);
  const onMaxSlots = useCallback((n: number) => update((x) => ({ ...x, maxSlots: n }), ['maxSlots']), [update]);
  const onDuration = useCallback((m: number) => update((x) => ({ ...x, durationMin: m }), []), [update]);
  const onPermission = useCallback((v: boolean) => {
    update((x) => ({ ...x, permissionConfirmed: v }), []);
    if (v) setPermissionMissing(false);
  }, [update]);
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
              <View>
                {store.restoredShown && <Text style={styles.restored}>{t('sparringTrust.create.draftRestored')}</Text>}
                {blocker !== null && <TrustNoticeCard problem={blocker} onAction={handleTrustAction} />}
              <StepWhat
                discipline={draft.discipline}
                maxSlots={draft.maxSlots}
                errors={errors}
                onDiscipline={onDiscipline}
                onMaxSlots={onMaxSlots}
              />
              </View>
            )}
            {step === 2 && (
              <View>
                <StepTitle text={t('sparring.flow.whenWhere')} />
                <SectionLabel text={t('sparring.flow.date')} />
                <WhenPicker value={draft.scheduledAt} error={errors.scheduledAt} onChange={onWhen} />
                <View style={styles.gap} />
                <SectionLabel text={t('sparringTrust.create.duration')} />
                <DurationChips value={draft.durationMin} onChange={onDuration} />
                <View style={styles.rope} />
                <SectionLabel text={t('sparring.flow.place')} hint={t('sparring.flow.placeHint')} />
                <PlaceSection
                  gym={draft.gym}
                  atStudio={draft.atStudio}
                  studioAvailable={coachStudio !== null && coachStudio.address.trim().length > 0}
                  studioName={coachStudio?.name ?? ''}
                  place={draft.place}
                  placeLabel={draft.placeLabel}
                  accessNote={draft.accessNote}
                  error={errors.place}
                  prefill={prefill}
                  notice={placeNotice !== null ? <TrustNoticeCard problem={placeNotice} onAction={handleTrustAction} /> : null}
                  actions={placeActions}
                />
              </View>
            )}
            {step === 3 && (
              <StepPreview
                preview={
                  <InvitationPreview
                    badge={t('sparring.flow.badge')}
                    discipline={draft.discipline}
                    title={title}
                    scheduledAtMs={draft.scheduledAt.getTime()}
                    gymName={draft.place === null ? null : draft.placeLabel.trim() || draft.place.name}
                    address={draft.place?.address ?? ''}
                    atStudio={draft.atStudio && draft.place !== null}
                    slotsText={t('sparring.detailHeader.slotsFree', { count: draft.maxSlots })}
                    footnote={t('sparring.flow.withoutHost')}
                    durationMin={draft.durationMin}
                  />
                }
                title={draft.title}
                autoTitle={draft.discipline !== null ? defaultSparringTitle(draft.discipline) : t('sparring.flow.autoTitle')}
                notes={draft.notes}
                titleError={errors.title}
                notesError={errors.notes}
                onTitle={onTitle}
                onNotes={onNotes}
                onNotesFocus={onNotesFocus}
                permissionConfirmed={draft.permissionConfirmed}
                permissionMissing={permissionMissing}
                onPermission={onPermission}
                footer={problem !== null ? (
                  <View style={styles.problem}>
                    <TrustNoticeCard problem={problem} onAction={handleTrustAction} />
                    <Text style={styles.kept}>{t('sparringTrust.create.draftKept')}</Text>
                  </View>
                ) : null}
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
                  <Text style={styles.primaryText}>{t('sparring.flow.publishing')}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.primaryText}>{step === 3 ? t('sparring.flow.publish') : t('common.next')}</Text>
                  <Ionicons name={step === 3 ? 'megaphone-outline' : 'arrow-forward'} size={20} color={colors.headerTextPrimary} />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Child modals of the open flow (iOS cannot show sibling modals). */}
        <GymPickerSheet
          visible={gymPickerVisible}
          title={t('sparring.flow.pickGymTitle')}
          currentGymId={draft.gym?.id ?? null}
          onClose={() => setGymPickerVisible(false)}
          onSelect={async (picked) => {
            update((d) => applyGym(d, toDraftGym(picked)), ['place']);
            return true;
          }}
        />

        {overlay === 'primer' && (
          <FlowOverlay>
            <LocationPrimerContent
              onAllow={() => { setOverlay(null); void runPublish(true); }}
              onLater={() => setOverlay(null)}
            />
          </FlowOverlay>
        )}
        {overlay === 'rules' && (
          <FlowOverlay>
            <ReachIntroContent mode="explain" onPrimary={() => setOverlay(null)} />
          </FlowOverlay>
        )}
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
  gap: {
    height: 24,
  },
  restored: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 16,
  },
  problem: {
    marginTop: 16,
    gap: 8,
  },
  kept: {
    fontSize: 14,
    color: colors.textMuted,
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
