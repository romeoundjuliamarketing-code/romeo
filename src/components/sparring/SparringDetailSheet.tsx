import React, { useState, useRef } from 'react';
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
import { resolveCommitmentCta, isSparringChatMember, isBeforeCancelDeadline } from '../../utils/sparringCommitment';
import SparringParticipantsList from './SparringParticipantsList';
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
  // Only needed to resolve the current user's own waitlist position — a
  // second call to the same RPC SparringParticipantsList uses internally.
  const { participants } = useSparringParticipants(sparring?.id ?? null);
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
  const fillPct     = `${Math.min(100, Math.round((sparring.signup_count / sparring.max_slots) * 100))}%` as const;

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

            <View style={[styles.banner, { backgroundColor: bannerColor }]}>
              <Text style={styles.bannerTitle} numberOfLines={2}>{sparring.title}</Text>
              <TouchableOpacity
                style={styles.bannerClose}
                onPress={dismiss}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={colors.card} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.badgesRow}>
                {sparring.is_featured && (
                  <View style={styles.featuredBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.accentBlue} />
                    <Text style={styles.featuredBadgeText}>Sparr Pick</Text>
                  </View>
                )}
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{sparring.discipline}</Text>
                </View>
                {sparring.verified_only && (
                  <View style={styles.verifiedOnlyBadge}>
                    <Ionicons name="shield-checkmark-outline" size={13} color={colors.difficultyGreen} />
                    <Text style={styles.verifiedOnlyBadgeText}>Nur verifizierte Mitglieder</Text>
                  </View>
                )}
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.infoText}>{sparring.studio_name} · {sparring.address}</Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.infoText}>{formatDateTime(sparring.scheduled_at)}</Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.infoText}>{sparring.duration_min} Minuten</Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.infoText}>
                  {sparring.signup_count}/{sparring.max_slots} Angemeldet
                  {!isFull && (
                    <Text style={styles.slotsLeft}>{`  ${slotsLeft} ${slotsLeft === 1 ? 'Platz' : 'Plätze'} frei`}</Text>
                  )}
                </Text>
              </View>

              <View style={styles.slotsBar}>
                <View style={[styles.slotsBarFill, isFull && styles.slotsBarFull, { width: fillPct }]} />
              </View>

              {sparring.notes !== null && sparring.notes.length > 0 && (
                <Text style={styles.notes}>{sparring.notes}</Text>
              )}

              <SparringParticipantsList
                sparringId={sparring.id}
                currentUserId={currentUserId}
                sparringScheduledAt={sparring.scheduled_at}
                isOrganizer={isCreator}
                onPressProfile={handlePressProfile}
              />

              <SparringCommitmentActions
                cta={cta}
                confirmedCount={sparring.confirmed_count}
                waitlistPosition={waitlistPosition}
                loading={loading}
                onJoin={onJoin}
                onConfirm={onConfirm}
                onCancel={onCancelSignup}
              />

              <TouchableOpacity style={styles.shareBtn} onPress={() => { void handleShare(); }} activeOpacity={0.8}>
                <Ionicons name="share-outline" size={18} color={colors.accentBlue} />
                <Text style={styles.shareBtnText}>Teilen</Text>
              </TouchableOpacity>

              {/* Chat is only readable for slot holders, attended/no_show and the organizer */}
              {canOpenChat && (
                <TouchableOpacity
                  style={styles.chatBtn}
                  onPress={onOpenChat}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubbles-outline" size={18} color={colors.accentBlue} />
                  <Text style={styles.chatBtnText}>Zum Chat</Text>
                </TouchableOpacity>
              )}

              {isCreator && (
                <TouchableOpacity
                  style={styles.boostBtn}
                  onPress={() => setBoostSheetVisible(true)}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="star-circle-outline" size={18} color={colors.accentBlue} />
                  <Text style={styles.boostBtnText}>Karten-Boost</Text>
                </TouchableOpacity>
              )}

              {isCreator && (
                <TouchableOpacity
                  style={styles.btnDeactivate}
                  onPress={onDeactivate}
                  disabled={loading}
                >
                  <Text style={styles.btnDeactivateText}>Sparring absagen</Text>
                </TouchableOpacity>
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
  banner: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               16,
    paddingHorizontal: 24,
    paddingTop:        24,
    paddingBottom:     24,
  },
  bannerClose: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: colors.headerBorder,
    alignItems:      'center',
    justifyContent:  'center',
  },
  bannerTitle: {
    flex:       1,
    fontSize:   22,
    fontWeight: '700',
    color:      colors.card,
    lineHeight: 28,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding:       24,
    paddingTop:    16,
    paddingBottom: 24,
    gap:           14,
  },
  badgesRow: {
    flexDirection: 'row',
    gap:           8,
    flexWrap:      'wrap',
  },
  featuredBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    backgroundColor:   colors.accentBlueSoft,
    borderRadius:      8,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       colors.accentBlue,
  },
  featuredBadgeText: {
    fontSize:   13,
    fontWeight: '700',
    color:      colors.accentBlue,
  },
  badge: {
    alignSelf:         'flex-start',
    backgroundColor:   colors.accentBlueSoft,
    borderRadius:      8,
    paddingHorizontal: 12,
    paddingVertical:   4,
  },
  badgeText: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.accentBlue,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           8,
  },
  infoText: {
    fontSize:   14,
    color:      colors.textSecondary,
    flex:       1,
    lineHeight: 20,
  },
  slotsLeft: {
    color:      colors.difficultyGreen,
    fontWeight: '600',
  },
  slotsBar: {
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.border,
    overflow:        'hidden',
    marginTop:       -6,
  },
  slotsBarFill: {
    position:        'absolute',
    top:             0,
    left:            0,
    bottom:          0,
    backgroundColor: colors.accentBlue,
  },
  slotsBarFull: {
    backgroundColor: colors.deleteRed,
  },
  notes: {
    fontSize:       14,
    color:          colors.text,
    lineHeight:     20,
    paddingTop:     4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  shareBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    borderRadius:    14,
    height:          44,
    borderWidth:     1,
    borderColor:     colors.accentBlue,
    backgroundColor: colors.accentBlueSoft,
  },
  shareBtnText: {
    fontSize:   15,
    fontWeight: '600',
    color:      colors.accentBlue,
  },
  chatBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    borderRadius:    14,
    height:          44,
    borderWidth:     1,
    borderColor:     colors.accentBlue,
    backgroundColor: colors.accentBlueSoft,
  },
  chatBtnText: {
    fontSize:   15,
    fontWeight: '600',
    color:      colors.accentBlue,
  },
  storyCapture: {
    position: 'absolute',
    left:     -10000, // off-screen, still rendered for capture
    top:      0,
    width:    1080,
    height:   1920,
  },
  boostBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    borderRadius:    14,
    height:          44,
    borderWidth:     1,
    borderColor:     colors.accentBlue,
    backgroundColor: colors.accentBlueSoft,
  },
  boostBtnText: {
    fontSize:   15,
    fontWeight: '600',
    color:      colors.accentBlue,
  },
  btnDeactivate: {
    borderRadius:   14,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    1,
    borderColor:    'rgba(217,74,74,0.4)',
  },
  btnDeactivateText: {
    fontSize:   15,
    fontWeight: '600',
    color:      colors.deleteRed,
  },
  verifiedOnlyBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    backgroundColor:   colors.background,
    borderRadius:      8,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       colors.difficultyGreen,
  },
  verifiedOnlyBadgeText: {
    fontSize:   12,
    fontWeight: '600',
    color:      colors.difficultyGreen,
  },
});
