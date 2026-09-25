import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
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
import { compactDateLabel, sparringLocationLines } from '../../utils/sparringDetail';
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
import MapBoostSheet from './MapBoostSheet';
import { usePopAnimation } from './SparringPopCard';

interface Props {
  sparring:          SparringWithMeta | null;
  currentUserId:     string | null;
  userTier:          VerificationTier;
  onClose:           () => void;
  onJoin:            () => void;
  onConfirm:         () => void;
  onCancelSignup:    () => void;
  onDeactivate:      () => void;
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
  onBoostActivated?: () => void;
  loading:           boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// Centered pop-up window: 85% of the screen, but never under the system bars.
const WINDOW_HEIGHT_RATIO = 0.85;
const WINDOW_MARGIN       = 16;
// Organizer descriptions longer than this are collapsed behind "Mehr lesen".
const NOTES_CLAMP_LINES   = 4;
const NOTES_CLAMP_CHARS   = 180;

function getBannerColor(scheduledAt: string, isFeatured: boolean): string {
  if (isFeatured) return colors.accentBlue;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(scheduledAt);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return colors.deleteRed;
  if (diff <= 7) return colors.sparringsOrange;
  return colors.accentBlue;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time} Uhr`;
}

export default function SparringDetailSheet({
  sparring, currentUserId, userTier, onClose, onJoin, onConfirm, onCancelSignup, onDeactivate, onOpenChat,
  consentVisible, onConsentClose, onConsentConfirm, commitmentResult, onCommitmentResultClose,
  cancelAskVisible, onCancelAskClose, onCancelAskConfirm,
  onBoostActivated, loading,
}: Props) {
  const [boostSheetVisible, setBoostSheetVisible] = useState(false);
  // Reload participants when the slot count or the user's own status changes
  // (join/cancel/confirm keep the window open and refresh `sparring`).
  const [participantsVersion, setParticipantsVersion] = useState(0);
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

  // Full participant list and long description are collapsed per sparring.
  const [listExpanded, setListExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  useEffect(() => {
    setListExpanded(false);
    setNotesExpanded(false);
  }, [sparring?.id]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const storyShotRef = useRef<ViewShot>(null);

  // Pops in whenever a (new) sparring is selected; close() pops out first.
  const { overlayStyle, cardStyle, close } = usePopAnimation(onClose, sparring?.id ?? null);

  // Used by the X button, the backdrop and Android back.
  function dismiss(): void {
    close();
  }

  const windowHeight = Math.min(
    SCREEN_HEIGHT * WINDOW_HEIGHT_RATIO,
    SCREEN_HEIGHT - insets.top - insets.bottom - 2 * WINDOW_MARGIN,
  );

  if (sparring === null) return null;

  const slotsLeft    = sparring.max_slots - sparring.signup_count;
  const isFull       = slotsLeft <= 0;
  const isCreator    = currentUserId !== null && sparring.created_by === currentUserId;
  const bannerColor  = getBannerColor(sparring.scheduled_at, sparring.is_featured);
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
          message: `${s.title} – jetzt mitmachen: ${url}`,
          failOnCancel: false,
        });
        return;
      }
    } catch {
      // fall through to link-only sharing
    }
    await Share.open({ message: `${s.title} – jetzt mitmachen: ${url}`, failOnCancel: false });
  }

  return (
    <Modal
      visible
      animationType="none"
      transparent
      // Android back closes an open card first, then the sheet.
      onRequestClose={
        commitmentResult !== null ? onCommitmentResultClose
          : cancelAskVisible ? onCancelAskClose
          : dismiss
      }
    >
      {/* gesture-handler inside an RN Modal requires its own GestureHandlerRootView */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.container}>
          {/* Dim layer covers the whole screen (no bright edges at the corners) */}
          <Animated.View style={[styles.overlay, overlayStyle]}>
            <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={dismiss} />
          </Animated.View>

          <Animated.View style={[styles.window, { height: windowHeight }, cardStyle]}>

            <SparringDetailHeader
              title={sparring.title}
              discipline={sparring.discipline}
              bannerColor={bannerColor}
              dateLabel={compactDateLabel(sparring.scheduled_at)}
              takingPart={sparring.signup_count}
              slotsLeft={slotsLeft}
              durationMin={sparring.duration_min}
              isFeatured={sparring.is_featured}
              verifiedOnly={sparring.verified_only}
              isCreator={isCreator}
              hasStarted={started}
              onClose={dismiss}
            />

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              <SparringLocationRow primary={location.primary} secondary={location.secondary} />

              <View style={styles.section}>
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

              <SparringCommitmentActions
                cta={cta}
                scheduledAt={sparring.scheduled_at}
                waitlistPosition={waitlistPosition}
                loading={loading}
                onJoin={onJoin}
                onConfirm={onConfirm}
                onCancel={onCancelSignup}
              />

              {notes.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Vom Organisator</Text>
                  {/* User content: shown exactly as written, long texts collapsed */}
                  <Text
                    style={styles.notes}
                    numberOfLines={notesLong && !notesExpanded ? NOTES_CLAMP_LINES : undefined}
                  >
                    {notes}
                  </Text>
                  {notesLong && (
                    <TouchableOpacity
                      onPress={() => setNotesExpanded((v) => !v)}
                      accessibilityRole="button"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.moreText}>{notesExpanded ? 'Weniger anzeigen' : 'Mehr lesen'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <View style={styles.actions}>
                {/* Chat is only readable for slot holders, attended/no_show and the organizer */}
                {canOpenChat && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={onOpenChat}
                    disabled={loading}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                  >
                    <Ionicons name="chatbubbles-outline" size={18} color={colors.accentBlue} />
                    <Text style={styles.actionBtnText}>Zum Chat</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => { void handleShare(); }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  <Ionicons name="share-outline" size={18} color={colors.accentBlue} />
                  <Text style={styles.actionBtnText}>Teilen</Text>
                </TouchableOpacity>
              </View>

              {isCreator && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => setBoostSheetVisible(true)}
                    disabled={loading}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                  >
                    <MaterialCommunityIcons name="star-circle-outline" size={18} color={colors.accentBlue} />
                    <Text style={styles.actionBtnText}>Karten-Boost</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={onDeactivate}
                    disabled={loading}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                  >
                    <Ionicons name="close-circle-outline" size={18} color={colors.deleteRed} />
                    <Text style={styles.deactivateText}>Sparring absagen</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </Animated.View>

          <View style={styles.storyCapture} pointerEvents="none">
            <ViewShot ref={storyShotRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
              <SparringStoryCard
                title={s.title}
                discipline={s.discipline}
                areaLabel={coarseAreaLabel({ studioName: s.studio_name, address: s.address })}
                dateTimeLabel={formatDateTime(s.scheduled_at)}
                slotsLeftLabel={isFull ? 'Ausgebucht' : `${slotsLeft} ${slotsLeft === 1 ? 'Platz' : 'Plätze'} frei`}
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
              dateTimeLabel={formatDateTime(sparring.scheduled_at)}
              isWaitlisted={sparring.my_status === 'waitlisted'}
              cancelIsFree={isBeforeCancelDeadline(sparring.scheduled_at, new Date())}
              onClose={onCancelAskClose}
              onConfirm={onCancelAskConfirm}
            />
          )}

          {commitmentResult !== null && (
            <SparringCommitmentResultCard
              result={commitmentResult}
              sparringTitle={sparring.title}
              dateTimeLabel={formatDateTime(sparring.scheduled_at)}
              onClose={onCommitmentResultClose}
            />
          )}

          {isCreator && boostSheetVisible && (
            <MapBoostSheet
              sparringId={sparring.id}
              visible={boostSheetVisible}
              onClose={() => setBoostSheetVisible(false)}
              onBoostActivated={() => {
                setBoostSheetVisible(false);
                onBoostActivated?.();
              }}
            />
          )}
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
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: WINDOW_MARGIN,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.mapOverlay,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  window: {
    width:           '100%',
    maxWidth:        520,
    backgroundColor: colors.card,
    borderRadius:    24,
    overflow:        'hidden',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    // Sections are separated by space, not divider lines.
    gap:     24,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.textSecondary,
  },
  notes: {
    fontSize:   15,
    lineHeight: 22,
    color:      colors.text,
  },
  moreText: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.accentBlue,
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
    minHeight:         44,
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      16,
    backgroundColor:   colors.background,
  },
  actionBtnText: {
    fontSize:   15,
    fontWeight: '600',
    color:      colors.accentBlue,
  },
  deactivateText: {
    fontSize:   15,
    fontWeight: '600',
    color:      colors.deleteRed,
  },
  storyCapture: {
    position: 'absolute',
    left:     -10000, // off-screen, still rendered for capture
    top:      0,
    width:    1080,
    height:   1920,
  },
});
