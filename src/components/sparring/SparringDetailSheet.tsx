import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  ScrollView as GHScrollView,
} from 'react-native-gesture-handler';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import type { SparringWithMeta } from '../../hooks/useOpenSparrings';
import type { RootStackParamList } from '../../navigation/types';
import type { VerificationTier } from '../../utils/verificationTier';
import SparringParticipantsList from './SparringParticipantsList';
import MapBoostSheet from './MapBoostSheet';

interface Props {
  sparring:          SparringWithMeta | null;
  currentUserId:     string | null;
  userTier:          VerificationTier;
  onClose:           () => void;
  onToggleSignup:    () => Promise<void>;
  onDeactivate:      () => void;
  onBoostActivated?: () => void;
  loading:           boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedGHScrollView = Animated.createAnimatedComponent(GHScrollView);
const SNAP_FULL    = 0;
const SNAP_HALF    = SCREEN_HEIGHT * 0.42; // shows bottom ~50%
const SNAP_DISMISS = SCREEN_HEIGHT;
const SNAP_POINTS  = [SNAP_FULL, SNAP_HALF, SNAP_DISMISS]; // settle anchors, ordered top -> bottom
const DRAG_CLAIM   = 6;   // px of movement before a content drag is claimed from the ScrollView
const VELOCITY_PROJECTION = 150; // ms of velocity look-ahead used when settling to a snap point

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
  sparring, currentUserId, userTier, onClose, onToggleSignup, onDeactivate, onBoostActivated, loading,
}: Props) {
  const [boostSheetVisible, setBoostSheetVisible] = useState(false);
  // Track whether the sheet is fully expanded so we can toggle scrollEnabled on JS side
  const [isFullyExpanded, setIsFullyExpanded] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Reanimated shared values — run on the UI thread
  const translateY  = useSharedValue(SNAP_DISMISS);
  const currentSnap = useSharedValue(SNAP_HALF);
  const startY      = useSharedValue(0);   // translateY at gesture start
  const scrollY     = useSharedValue(0);   // content scroll offset
  // Ref to the inner scroll view so the content pan can run simultaneously with
  // it — without this the active pan would block list scrolling when expanded.
  const scrollRef   = useRef<React.ComponentRef<typeof GHScrollView>>(null);

  // Clamp helper — worklet version used inside gesture handlers
  function clampYWorklet(v: number): number {
    'worklet';
    return Math.min(SNAP_DISMISS, Math.max(SNAP_FULL, v));
  }

  // Notify JS side whether we are at SNAP_FULL so scrollEnabled can update
  function notifyExpansionState(target: number): void {
    setIsFullyExpanded(target === SNAP_FULL);
  }

  // Core settle worklet — projects with velocity, finds nearest snap, animates there
  function settle(position: number, vy: number): void {
    'worklet';
    const projected = clampYWorklet(position + vy * VELOCITY_PROJECTION);
    let target = SNAP_POINTS[0];
    for (const s of SNAP_POINTS) {
      if (Math.abs(s - projected) < Math.abs(target - projected)) target = s;
    }
    if (target === SNAP_DISMISS) {
      translateY.value = withTiming(SNAP_DISMISS, { duration: 220 }, (finished) => {
        if (finished) runOnJS(onClose)();
      });
    } else {
      currentSnap.value = target;
      translateY.value = withSpring(target, { damping: 18, stiffness: 140 });
      runOnJS(notifyExpansionState)(target);
    }
  }

  // JS dismiss — used by backdrop press, close button, and handlePressProfile
  function dismiss(): void {
    translateY.value = withTiming(SNAP_DISMISS, { duration: 220 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }

  // Animate in when a new sparring is selected (keyed on sparring.id)
  useEffect(() => {
    if (sparring !== null) {
      translateY.value = SNAP_DISMISS;
      currentSnap.value = SNAP_HALF;
      setIsFullyExpanded(false);
      translateY.value = withSpring(SNAP_HALF, { damping: 18, stiffness: 140 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sparring?.id]);

  // Banner / handle pan — always active, moves the entire sheet
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

  // Scroll handler — updates scrollY on the UI thread
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Content pan — mirrors the existing shouldClaimContent logic:
  //   • Sheet not fully expanded: claim vertical drag (both directions) once > DRAG_CLAIM px
  //   • Sheet fully expanded + at top: claim downward drags to collapse
  //   • Otherwise: let the ScrollView handle it
  const contentPan = Gesture.Pan()
    // Run together with the inner scroll so the pan does not block list
    // scrolling when expanded. gesture-handler types the ref param as a
    // ComponentType ref, but at runtime it accepts the ScrollView instance ref —
    // hence the assertion (a known typing gap, not a logic cast).
    .simultaneousWithExternalGesture(
      scrollRef as unknown as React.RefObject<React.ComponentType | null | undefined>,
    )
    .activeOffsetY([-DRAG_CLAIM, DRAG_CLAIM])
    .onStart(() => {
      'worklet';
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      'worklet';
      const shouldClaim =
        currentSnap.value !== SNAP_FULL ||
        (scrollY.value <= 1 && e.translationY > 0);
      if (shouldClaim) {
        translateY.value = clampYWorklet(startY.value + e.translationY);
      }
    })
    .onEnd((e) => {
      'worklet';
      const shouldClaim =
        currentSnap.value !== SNAP_FULL ||
        (scrollY.value <= 1 && e.velocityY > 0);
      if (shouldClaim) {
        settle(translateY.value, e.velocityY);
      }
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (sparring === null) return null;

  const slotsLeft    = sparring.max_slots - sparring.signup_count;
  const isFull       = slotsLeft <= 0;
  const isCreator    = currentUserId !== null && sparring.created_by === currentUserId;
  const bannerColor  = getBannerColor(sparring.scheduled_at, sparring.is_featured);
  // Block joining when this sparring requires verification and user is not verified
  const verifiedBlock =
    sparring.verified_only && userTier !== 'verified' && !sparring.is_signed_up;
  const fillPct     = `${Math.min(100, Math.round((sparring.signup_count / sparring.max_slots) * 100))}%` as const;

  // sparring is guaranteed non-null here (guarded above)
  const s = sparring;

  function handlePressProfile(userId: string): void {
    dismiss();
    navigation.navigate('PublicProfile', {
      userId,
      sparringId:          s.id,
      sparringScheduledAt: s.scheduled_at,
    });
  }

  function handleSignupPress(): void {
    if (s.is_signed_up) {
      Alert.alert('Abmelden', `Möchtest du dich von „${s.title}" abmelden?`, [
        { text: 'Zurück', style: 'cancel' },
        { text: 'Abmelden', style: 'destructive', onPress: () => { void onToggleSignup(); } },
      ]);
    } else {
      Alert.alert('Anmelden', `Möchtest du dich für „${s.title}" anmelden?`, [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Anmelden', onPress: () => { void onToggleSignup(); } },
      ]);
    }
  }

  // scrollEnabled: only allow inner scroll when the sheet is fully expanded
  const scrollEnabled = isFullyExpanded;

  return (
    <Modal visible animationType="none" transparent onRequestClose={dismiss}>
      {/* gesture-handler inside an RN Modal requires its own GestureHandlerRootView */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={dismiss} />

          <Animated.View style={[styles.sheet, animatedSheetStyle]}>

            {/* Banner + handle — drag here to expand or dismiss */}
            <GestureDetector gesture={handlePan}>
              <View style={[styles.banner, { backgroundColor: bannerColor }]}>
                <View style={styles.handleRow}>
                  <View style={styles.handle} />
                </View>
                <TouchableOpacity
                  style={styles.bannerClose}
                  onPress={dismiss}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={22} color={colors.card} />
                </TouchableOpacity>
                <Text style={styles.bannerTitle} numberOfLines={2}>{sparring.title}</Text>
              </View>
            </GestureDetector>

            {/* Content — drag down at top also dismisses */}
            <GestureDetector gesture={contentPan}>
              <View style={styles.contentWrapper}>
                <AnimatedGHScrollView
                  ref={scrollRef}
                  style={styles.scrollView}
                  contentContainerStyle={styles.content}
                  scrollEventThrottle={16}
                  onScroll={onScroll}
                  bounces={false}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={scrollEnabled}
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
                    onPressProfile={handlePressProfile}
                  />

                  <TouchableOpacity
                    style={[
                      styles.btn,
                      sparring.is_signed_up && styles.btnCancel,
                      isFull && !sparring.is_signed_up && !verifiedBlock && styles.btnDisabled,
                      verifiedBlock && styles.btnVerifyRequired,
                    ]}
                    onPress={handleSignupPress}
                    disabled={loading || (isFull && !sparring.is_signed_up && !verifiedBlock)}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.card} />
                    ) : (
                      <Text style={styles.btnText}>
                        {sparring.is_signed_up
                          ? 'Abmelden'
                          : verifiedBlock
                          ? 'Verifizierung erforderlich'
                          : isFull
                          ? 'Ausgebucht'
                          : 'Anmelden'}
                      </Text>
                    )}
                  </TouchableOpacity>

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
                </AnimatedGHScrollView>
              </View>
            </GestureDetector>
          </Animated.View>

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
    flex:           1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    height:               SCREEN_HEIGHT * 0.92,
    backgroundColor:      colors.card,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    overflow:             'hidden',
  },
  handleRow: {
    alignItems:    'center',
    paddingTop:    12,
    paddingBottom: 4,
  },
  handle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  banner: {
    paddingHorizontal: 24,
    paddingBottom:     20,
    justifyContent:    'flex-end',
  },
  bannerClose: {
    position:       'absolute',
    top:            8,
    right:          16,
    width:          36,
    height:         36,
    alignItems:     'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize:   22,
    fontWeight: '700',
    color:      colors.card,
    lineHeight: 28,
  },
  contentWrapper: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding:       24,
    paddingTop:    16,
    paddingBottom: 48,
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
  btn: {
    backgroundColor: colors.accentBlue,
    borderRadius:    14,
    height:          50,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       4,
  },
  btnCancel: {
    backgroundColor: colors.deleteRed,
  },
  btnDisabled: {
    backgroundColor: colors.textSecondary,
  },
  btnText: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.card,
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
  btnVerifyRequired: {
    backgroundColor: colors.sparringsOrange,
  },
});
