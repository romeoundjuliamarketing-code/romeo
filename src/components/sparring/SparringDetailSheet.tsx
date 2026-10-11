import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import SparringGymRow from './SparringGymRow';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';
import { colors } from '../../theme/colors';
import type { SparringWithMeta } from '../../hooks/useOpenSparrings';
import { useSparringParticipants } from '../../hooks/useSparringParticipants';
import type { RootStackParamList } from '../../navigation/types';
import type { VerificationTier } from '../../utils/verificationTier';
import { buildSparringShareUrl, coarseAreaLabel } from '../../utils/sparringShare';
import { resolveCommitmentCta, isSparringChatMember, isBeforeCancelDeadline, hasStarted } from '../../utils/sparringCommitment';
import { sparringLocationLines } from '../../utils/sparringDetail';
import { formatDistanceKm } from '../../utils/sparringSearch';
import { formatTooFarKm } from '../../utils/sparringTrust';
import { localeFor } from '../../utils/language';
import SparringParticipantsList from './SparringParticipantsList';
import SparringParticipantsSummary from './SparringParticipantsSummary';
import SparringDetailHeader from './SparringDetailHeader';
import SparringLocationRow from './SparringLocationRow';
import SparringCommitmentActions from './SparringCommitmentActions';
import SparringRulesConsentSheet from './SparringRulesConsentSheet';
import SparringCommitmentResultCard from './SparringCommitmentResultCard';
import type { SparringCommitmentResult } from './SparringCommitmentResultCard';
import SparringCancelConfirmCard from './SparringCancelConfirmCard';
import SparringStoryCard from './SparringStoryCard';
import { useSheetSlide } from './useSheetSlide';
import SparringOrganizerRow from './SparringOrganizerRow';
import SparringStatusNote from './SparringStatusNote';
import SparringSheetTopBar from './SparringSheetTopBar';
import Svg, { Line } from 'react-native-svg';
import { sparringDisplayTitle } from '../../utils/sparringDisplayTitle';
import TrustNoticeCard from './trust/TrustNoticeCard';
import JoinFlowOverlay, { type JoinFlowView } from './trust/JoinFlowOverlay';
import CheckinSection from './trust/CheckinSection';
import TrustPanelOverlays from './trust/TrustPanelOverlays';
import { useTrustPanel } from './trust/useTrustPanel';
import { useTranslation } from 'react-i18next';
import TourOverlay from '../tour/TourOverlay';
import { useTourTarget } from '../../context/TourContext';
import { useLanguage } from '../../i18n/language';
import { formatDate } from '../../utils/formatDate';
import type { AppLanguage } from '../../utils/language';
import type { TFunction } from 'i18next';

interface Props {
  /** Map/list selections carry the search distance; deep links do not. */
  sparring:          (SparringWithMeta & { distance_km?: number }) | null;
  currentUserId:     string | null;
  userTier:          VerificationTier;
  onClose:           () => void;
  onJoin:            () => void;
  onConfirm:         () => void;
  onCancelSignup:    () => void;
  onDeactivate:      () => void;
  /** Organizer only: open the edit sheet (the caller closes this window first). */
  onEdit:            () => void;
  onOpenChat:        () => void;
  /** Rules consent gate — rendered inside this sheet's Modal (see below). */
  consentVisible:    boolean;
  onConsentClose:    () => void;
  onConsentConfirm:  (rulesVersion: number) => void;
  /** Result of a just-completed join/cancel — shows the result card while set. */
  commitmentResult:        SparringCommitmentResult | null;
  onCommitmentResultClose: () => void;
  /** "Really cancel?" card — onCancelAskConfirm runs after it popped out. */
  cancelAskVisible:        boolean;
  onCancelAskClose:        () => void;
  onCancelAskConfirm:      () => void;
  loading:           boolean;
  /** Join gate (intro, location primer, explanation, problem card). */
  joinFlow:          JoinFlowView;
  /** The radius may have changed (e.g. after the meeting confirmation). */
  onReachChanged:    () => void;
  /** Join blocked by distance: show joinable sparrings near the user instead. */
  onFindNearby:      () => void;
}

// Near full-screen bottom sheet: a little of the dimmed map stays visible.
const SHEET_TOP_GAP     = 16;
// Organizer descriptions longer than this are collapsed behind "Mehr anzeigen".
const NOTES_CLAMP_LINES = 4;
const NOTES_CLAMP_CHARS = 180;
// Above this text size the action area scrolls on its own (never covers content).
const LARGE_TEXT_SCALE  = 1.3;

function formatDateTime(iso: string, t: TFunction, language: AppLanguage): string {
  const date = formatDate(iso, 'weekdayLong', language);
  const time = formatDate(iso, 'time', language);
  return t('sparring.detailSheet.dateTime', { date, time });
}

export default function SparringDetailSheet({
  sparring, currentUserId, userTier, onClose, onJoin, onConfirm, onCancelSignup, onDeactivate, onEdit, onOpenChat,
  consentVisible, onConsentClose, onConsentConfirm, commitmentResult, onCommitmentResultClose,
  cancelAskVisible, onCancelAskClose, onCancelAskConfirm,
  loading, joinFlow, onReachChanged, onFindNearby,
}: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  // Reload participants when the slot count or the user's own status changes
  // (join/cancel/confirm keep the window open and refresh `sparring`).
  const [participantsVersion, setParticipantsVersion] = useState(0);
  // Coach tour station 4 highlights discipline, date and place (the header).
  const tourHeader = useTourTarget('detailHeader');
  const lastSnapshotRef = useRef<string | null>(null);
  const snapshot = sparring !== null ? `${sparring.id}|${sparring.signup_count}|${sparring.my_status ?? ''}` : null;
  useEffect(() => {
    const prev = lastSnapshotRef.current;
    lastSnapshotRef.current = snapshot;
    // Only a change of the SAME sparring needs a refetch; a new id loads anyway.
    if (prev !== null && snapshot !== null && prev.split('|')[0] === snapshot.split('|')[0] && prev !== snapshot) {
      setParticipantsVersion((v) => v + 1);
    }
  }, [snapshot]);
  // Summary (avatars, counts) + the user's own waitlist position.
  const { participants, loading: participantsLoading } =
    useSparringParticipants(sparring?.id ?? null, participantsVersion);

  // Check-in / meeting confirmation state of this sparring (overlays are
  // rendered at the root of the Modal below).
  const trustPanel = useTrustPanel(sparring?.id ?? null, participantsVersion, onReachChanged);

  // Full participant list and long description are collapsed per sparring.
  const [listExpanded, setListExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  // Scroll position: drives the compact summary in the top bar.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  useEffect(() => {
    setListExpanded(false);
    setNotesExpanded(false);
    scrollY.value = 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sparring?.id]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { height: screenHeight, fontScale } = useWindowDimensions();
  const storyShotRef = useRef<ViewShot>(null);
  const sheetHeight = screenHeight - insets.top - SHEET_TOP_GAP;

  // Slides up whenever a (new) sparring is selected; close() slides out first.
  const { overlayStyle, sheetStyle, close } = useSheetSlide(onClose, sparring?.id ?? null, sheetHeight);

  // Used by the X button, the backdrop and Android back.
  function dismiss(): void {
    close();
  }

  if (sparring === null) return null;

  const slotsLeft    = sparring.max_slots - sparring.signup_count;
  const isFull       = slotsLeft <= 0;
  const isCreator    = currentUserId !== null && sparring.created_by === currentUserId;
  // Block joining when this sparring requires verification and user is not verified
  const verifiedBlock =
    sparring.verified_only && userTier !== 'verified' && !sparring.is_signed_up;
  const started      = hasStarted(sparring.scheduled_at, new Date());
  // The organizer records attendance in the full list once it has started.
  const showFullList = listExpanded || (isCreator && started);
  const location     = sparringLocationLines({
    studioId:   sparring.studio_id,
    studioName: sparring.studio_name,
    studioCity: sparring.studio_city,
    address:    sparring.address,
  });
  // Map/list selections carry the search distance; deep links do not.
  const distanceKm = sparring.distance_km ?? null;
  const notes     = sparring.notes?.trim() ?? '';
  const notesLong = notes.length > NOTES_CLAMP_CHARS || notes.split('\n').length > NOTES_CLAMP_LINES;

  const cta = resolveCommitmentCta({
    myStatus:      sparring.my_status,
    scheduledAt:   sparring.scheduled_at,
    now:           new Date(),
    isFull,
    isCreator,
    verifiedBlock,
  });
  const myWaitlistEntry = participants.find((p) => p.user_id === currentUserId);
  const waitlistPosition = myWaitlistEntry?.waitlist_position ?? null;
  const canOpenChat = isSparringChatMember(isCreator, sparring.my_status);
  // Only replaces the join CTA: existing participation, organizer, waitlist
  // and cancelled states are never covered by the distance block.
  const joinGate = joinFlow.gate;
  const blockedGate = cta.type === 'join' && joinGate.kind === 'tooFar' ? joinGate : null;

  // sparring is guaranteed non-null here (guarded above)
  const s = sparring;

  function handlePressProfile(userId: string): void {
    // Navigate only after the window popped out, so the profile opens on top.
    close(() => {
      navigation.navigate('PublicProfile', {
        userId,
        sparringId:          s.id,
        sparringScheduledAt: s.scheduled_at,
      });
    });
  }

  async function handleShare(): Promise<void> {
    const url = buildSparringShareUrl(s.id);
    try {
      const uri = await storyShotRef.current?.capture?.();
      if (uri) {
        await Share.open({
          url: uri,
          type: 'image/png',
          message: t('sparring.detailSheet.shareMessage', { title: s.title, url }),
          failOnCancel: false,
        });
        return;
      }
    } catch {
      // fall through to link-only sharing
    }
    await Share.open({ message: t('sparring.detailSheet.shareMessage', { title: s.title, url }), failOnCancel: false });
  }

  const largeText = fontScale > LARGE_TEXT_SCALE;
  // Large text or a problem card: the action area scrolls on its own.
  const footerScrolls = largeText || joinFlow.problem !== null;
  // Shown in the action area (short) and the status note (full sentence).
  const blockedDistance = blockedGate !== null
    ? formatTooFarKm(blockedGate.distanceM, blockedGate.radiusKm, localeFor(language))
    : null;
  const footerContent = (
    <View style={styles.footerInner}>
      {joinFlow.problem !== null && (
        <TrustNoticeCard problem={joinFlow.problem} onAction={joinFlow.onProblemAction} />
      )}
      <SparringCommitmentActions
        cta={cta}
        waitlistPosition={waitlistPosition}
        slotsLeft={slotsLeft}
        isActive={sparring.is_active}
        blockedGate={blockedGate}
        blockedDistance={blockedDistance}
        loading={loading}
        checking={joinGate.kind === 'checking'}
        onJoin={onJoin}
        onConfirm={onConfirm}
        onCancel={onCancelSignup}
        onFindNearby={onFindNearby}
      />
    </View>
  );
  const shownTitle = sparringDisplayTitle(sparring.title, language);
  // One title for the head and the compact summary (never empty).
  const displayTitle = shownTitle.length > 0 ? shownTitle : t('sparring.invite.titleFallback');
  const summary = {
    title: displayTitle,
    line:  [formatDate(sparring.scheduled_at, 'dayMonth', language), formatDate(sparring.scheduled_at, 'time', language), location.primary].join(' · '),
  };

  const topBar = (
    <SparringSheetTopBar
      mode={largeText ? 'fixed' : 'overlay'}
      summary={summary}
      scrollY={scrollY}
      onShare={() => { void handleShare(); }}
      onClose={dismiss}
    />
  );

  return (
    <Modal
      visible
      animationType="none"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      // Android back closes an open card first, then the sheet.
      onRequestClose={
        commitmentResult !== null ? onCommitmentResultClose
          : cancelAskVisible ? onCancelAskClose
          : joinFlow.overlay !== null ? joinFlow.onOverlayClose
          : trustPanel.overlay !== null ? trustPanel.closeOverlay
          : dismiss
      }
    >
      {/* gesture-handler inside an RN Modal requires its own GestureHandlerRootView */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.container}>
          {/* Dim layer covers the whole screen behind the sheet (no bright edges) */}
          <Animated.View style={[styles.overlay, overlayStyle]}>
            <TouchableOpacity
              style={styles.backdrop}
              activeOpacity={1}
              onPress={dismiss}
              accessible={false}
            />
          </Animated.View>

          <Animated.View style={[styles.sheet, { height: sheetHeight }, sheetStyle]}>
            {/* Fixed row above the content with large text, else floating over it */}
            {largeText && topBar}

            <Animated.ScrollView
              key={sparring.id}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onScroll={onScroll}
              scrollEventThrottle={16}
            >
              {/* Orientation: who invites, what, when, where — visible without scrolling */}
              <View ref={tourHeader.ref} onLayout={tourHeader.onLayout} collapsable={false}>
              <SparringDetailHeader
                title={displayTitle}
                discipline={sparring.discipline}
                scheduledAt={sparring.scheduled_at}
                durationMin={sparring.duration_min}
                isFeatured={sparring.is_featured}
                verifiedOnly={sparring.verified_only}
                isCreator={isCreator}
                edited={sparring.edited_at !== null}
                hostLine={
                  <SparringOrganizerRow
                    organizerId={sparring.created_by}
                    isCreator={isCreator}
                    onPressProfile={handlePressProfile}
                  />
                }
              >
                <SparringLocationRow
                  primary={location.primary}
                  secondary={location.secondary}
                  distance={distanceKm !== null ? formatDistanceKm(distanceKm) : null}
                />
                <SparringGymRow
                  gymId={sparring.gym_id}
                  accessNote={sparring.access_note}
                  onOpenGym={(gymId) => {
                    // Close the sheet first so the gym page opens on top.
                    close(() => navigation.navigate('GymDetail', { gymId }));
                  }}
                />
              </SparringDetailHeader>
              </View>

              <View style={styles.body}>
                <View style={styles.group}>
                  <SparringParticipantsSummary
                    participants={participants}
                    currentUserId={currentUserId}
                    hasStarted={started}
                    fallbackCount={sparring.signup_count}
                    loading={participantsLoading}
                    expanded={showFullList}
                    onToggleExpanded={() => setListExpanded((v) => !v)}
                  />
                  {showFullList && (
                    <SparringParticipantsList
                      sparringId={sparring.id}
                      currentUserId={currentUserId}
                      sparringScheduledAt={sparring.scheduled_at}
                      isOrganizer={isCreator}
                      participants={participants}
                      loading={participantsLoading}
                      onAttendanceChanged={() => setParticipantsVersion((v) => v + 1)}
                      onPressProfile={handlePressProfile}
                    />
                  )}
                </View>

                {notes.length > 0 && (
                  <View style={styles.noteWrap}>
                    {/* Offset blue edge: the one decorative detail of the note */}
                    <View style={styles.noteEdge} />
                    <View style={styles.noteSurface}>
                      <Text style={styles.noteLabel}>{t('sparring.invite.planned')}</Text>
                      {/* User content: shown exactly as written, long texts collapsed */}
                      <Text
                        style={styles.notes}
                        numberOfLines={notesLong && !notesExpanded ? NOTES_CLAMP_LINES : undefined}
                      >
                        {notes}
                      </Text>
                      {notesLong && (
                        <TouchableOpacity
                          style={styles.moreBtn}
                          onPress={() => setNotesExpanded((v) => !v)}
                          accessibilityRole="button"
                        >
                          <Text style={styles.moreText}>{notesExpanded ? t('sparring.invite.showLess') : t('sparring.invite.showMore')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                <SparringStatusNote
                  key={sparring.id}
                  cta={cta}
                  scheduledAt={sparring.scheduled_at}
                  waitlistPosition={waitlistPosition}
                  isActive={sparring.is_active}
                  blockedGate={blockedGate}
                  blockedDistance={blockedDistance}
                  showCoach={!largeText}
                  onWhyLimit={() => joinFlow.onProblemAction('limit')}
                />

                <CheckinSection panel={trustPanel} sparringId={sparring.id} sparringTitle={sparring.title} />

                {/* Chat is only readable for slot holders, attended/no_show and the organizer */}
                {canOpenChat && (
                  <SheetAction icon="chatbubbles-outline" label={t('sparring.detailSheet.toChat')} onPress={onOpenChat} disabled={loading} />
                )}

                {isCreator && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>{t('sparring.invite.manage')}</Text>
                    <View style={styles.actions}>
                      {!started && sparring.is_active && (
                        <SheetAction icon="create-outline" label={t('sparring.detailSheet.edit')} onPress={onEdit} disabled={loading} />
                      )}
                      {sparring.is_active && (
                        <SheetAction icon="close-circle-outline" label={t('sparring.detailSheet.cancelSparring')} onPress={onDeactivate} disabled={loading} danger />
                      )}
                    </View>
                  </View>
                )}
              </View>
            </Animated.ScrollView>

            {!largeText && topBar}

            {/* Fixed action area behind a ticket edge: short status + main action. */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <View style={styles.ticketEdge} pointerEvents="none">
                <Svg style={StyleSheet.absoluteFill}>
                  <Line x1="0" y1="1" x2="100%" y2="1" stroke={colors.ticketDash} strokeWidth="2" strokeDasharray="6 6" />
                </Svg>
              </View>
              <View style={[styles.notch, styles.notchLeft]} pointerEvents="none" />
              <View style={[styles.notch, styles.notchRight]} pointerEvents="none" />
              {footerScrolls ? (
                <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={styles.footerScroll}>
                  {footerContent}
                </ScrollView>
              ) : footerContent}
            </View>
          </Animated.View>

          <View style={styles.storyCapture} pointerEvents="none">
            <ViewShot ref={storyShotRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
              <SparringStoryCard
                title={s.title}
                discipline={s.discipline}
                areaLabel={coarseAreaLabel({ studioName: s.studio_name, address: s.address })}
                scheduledAt={s.scheduled_at}
                durationMin={s.duration_min}
                slotsLeftLabel={isFull ? t('sparring.detailHeader.soldOut') : t('sparring.detailHeader.slotsFree', { count: slotsLeft })}
              />
            </ViewShot>
          </View>

          {/* Must be a child of this Modal: iOS cannot present a second
              Modal from the map screen while this one is presented — a
              sibling Modal never shows and leaves an invisible host view
              that swallows every touch on the map. */}
          <SparringRulesConsentSheet
            visible={consentVisible}
            sparringTitle={sparring.title}
            loading={loading}
            onClose={onConsentClose}
            onConfirm={onConsentConfirm}
          />

          {cancelAskVisible && (
            <SparringCancelConfirmCard
              sparringTitle={sparring.title}
              dateTimeLabel={formatDateTime(sparring.scheduled_at, t, language)}
              isWaitlisted={sparring.my_status === 'waitlisted'}
              cancelIsFree={isBeforeCancelDeadline(sparring.scheduled_at, new Date())}
              onClose={onCancelAskClose}
              onConfirm={onCancelAskConfirm}
            />
          )}

          <JoinFlowOverlay flow={joinFlow} />
          <TrustPanelOverlays panel={trustPanel} sparringId={sparring.id} />

          {commitmentResult !== null && (
            <SparringCommitmentResultCard
              result={commitmentResult}
              sparringTitle={sparring.title}
              dateTimeLabel={formatDateTime(sparring.scheduled_at, t, language)}
              onClose={onCommitmentResultClose}
            />
          )}

          {/* Coach tour station 4: inside this Modal, which would cover it otherwise. */}
          <TourOverlay layer="sheet" />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// Quiet secondary action of the sheet (chat, edit, cancel the sparring).
function SheetAction({ icon, label, onPress, disabled, danger = false }: {
  icon:     React.ComponentProps<typeof Ionicons>['name'];
  label:    string;
  onPress:  () => void;
  disabled: boolean;
  danger?:  boolean;
}): React.ReactElement {
  return (
    <TouchableOpacity
      style={styles.actionBtn}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={18} color={danger ? colors.deleteRed : colors.accentBlueText} />
      <Text style={danger ? styles.deactivateText : styles.actionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const NOTCH = 24;

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex:           1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.sheetScrim,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    width:                '100%',
    maxWidth:             640,
    alignSelf:            'center',
    backgroundColor:      colors.background,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    overflow:             'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop:        16,
    paddingBottom:     40,
    gap:               24,
  },
  group: {
    gap: 8,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.textMuted,
  },
  noteWrap: {
    // Room for the offset edge on the right / bottom.
    marginRight:  8,
    marginBottom: 8,
  },
  noteEdge: {
    position:        'absolute',
    top:             8,
    left:            8,
    right:           -8,
    bottom:          -8,
    borderRadius:    16,
    backgroundColor: colors.accentBlueMuted,
  },
  noteSurface: {
    backgroundColor: colors.noteSurface,
    borderRadius:    16,
    padding:         16,
    gap:             8,
  },
  noteLabel: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.textMuted,
  },
  notes: {
    fontSize:   16,
    lineHeight: 24,
    color:      colors.text,
  },
  moreBtn: {
    alignSelf:      'flex-start',
    minHeight:      44,
    justifyContent: 'center',
    marginBottom:   -8,
  },
  moreText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },
  actions: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  actionBtn: {
    flexGrow:          1,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
    minHeight:         48,
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      16,
    borderWidth:       1,
    borderColor:       colors.hairline,
    backgroundColor:   colors.card,
  },
  actionBtnText: {
    fontSize:   15,
    fontWeight: '600',
    color:      colors.accentBlueText,
  },
  deactivateText: {
    fontSize:   15,
    fontWeight: '600',
    color:      colors.deleteRed,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop:        16,
    backgroundColor:   colors.card,
  },
  // Ticket edge: dashed line between two notches bitten out of the white
  // action area (the notches show the light content colour above).
  ticketEdge: {
    position: 'absolute',
    top:      0,
    left:     NOTCH,
    right:    NOTCH,
    height:   2,
  },
  notch: {
    position:        'absolute',
    top:             -NOTCH / 2,
    width:           NOTCH,
    height:          NOTCH,
    borderRadius:    NOTCH / 2,
    backgroundColor: colors.background,
  },
  notchLeft: {
    left: -NOTCH / 2,
  },
  notchRight: {
    right: -NOTCH / 2,
  },
  footerScroll: {
    maxHeight: 320,
  },
  footerInner: {
    gap: 16,
  },
  storyCapture: {
    position: 'absolute',
    left:     -10000, // off-screen, still rendered for capture
    top:      0,
    width:    1080,
    height:   1920,
  },
});
