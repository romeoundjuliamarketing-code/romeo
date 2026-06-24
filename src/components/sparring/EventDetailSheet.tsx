import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
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
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { EventWithMeta } from '../../hooks/useOpenEvents';

interface Props {
  event:          EventWithMeta | null;
  currentUserId:  string | null;
  onClose:        () => void;
  onToggleSignup: () => void;
  onDeactivate:   () => void;
  onOpenChat:     () => void;
  onOpenVenue?:   (venueId: string) => void;
  loading:        boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SNAP_FULL    = 0;
const SNAP_HALF    = SCREEN_HEIGHT * 0.42;
const SNAP_DISMISS = SCREEN_HEIGHT;
const SNAP_POINTS  = [SNAP_FULL, SNAP_HALF, SNAP_DISMISS];
const DRAG_CLAIM   = 6;
const VELOCITY_PROJECTION = 150;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time} Uhr`;
}

export default function EventDetailSheet({
  event,
  currentUserId,
  onClose,
  onToggleSignup,
  onDeactivate,
  onOpenChat,
  onOpenVenue,
  loading,
}: Props) {
  const [isFullyExpanded, setIsFullyExpanded] = useState(false);

  const translateY  = useSharedValue(SNAP_DISMISS);
  const currentSnap = useSharedValue(SNAP_HALF);
  const startY      = useSharedValue(0);
  const scrollY     = useSharedValue(0);
  const scrollRef   = useRef<React.ComponentRef<typeof GHScrollView>>(null);

  function clampYWorklet(v: number): number {
    'worklet';
    return Math.min(SNAP_DISMISS, Math.max(SNAP_FULL, v));
  }

  function notifyExpansionState(target: number): void {
    setIsFullyExpanded(target === SNAP_FULL);
  }

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

  function dismiss(): void {
    translateY.value = withTiming(SNAP_DISMISS, { duration: 220 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }

  useEffect(() => {
    if (event !== null) {
      translateY.value = SNAP_DISMISS;
      currentSnap.value = SNAP_HALF;
      setIsFullyExpanded(false);
      translateY.value = withSpring(SNAP_HALF, { damping: 18, stiffness: 140 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

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

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const contentPan = Gesture.Pan()
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

  if (event === null) return null;

  const ev          = event;
  const slotsLeft   = ev.max_slots - ev.signup_count;
  const isFull      = slotsLeft <= 0;
  const isCreator   = currentUserId !== null && ev.created_by === currentUserId;
  const fillPct     = `${Math.min(100, Math.round((ev.signup_count / ev.max_slots) * 100))}%` as const;
  const scrollEnabled = isFullyExpanded;

  function handleSignupPress(): void {
    if (ev.is_signed_up) {
      Alert.alert('Abmelden', `Möchtest du dich von "${ev.title}" abmelden?`, [
        { text: 'Zurück', style: 'cancel' },
        { text: 'Abmelden', style: 'destructive', onPress: onToggleSignup },
      ]);
    } else {
      Alert.alert('Anmelden', `Möchtest du dich für "${ev.title}" anmelden?`, [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Anmelden', onPress: onToggleSignup },
      ]);
    }
  }

  function handleDeactivate(): void {
    Alert.alert('Event absagen', `Möchtest du "${ev.title}" wirklich absagen?`, [
      { text: 'Zurück', style: 'cancel' },
      { text: 'Absagen', style: 'destructive', onPress: onDeactivate },
    ]);
  }

  return (
    <Modal visible animationType="none" transparent onRequestClose={dismiss}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={dismiss} />

          <Animated.View style={[styles.sheet, animatedSheetStyle]}>

            {/* Banner + handle */}
            <GestureDetector gesture={handlePan}>
              <View style={styles.banner}>
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
                <Text style={styles.bannerTitle} numberOfLines={2}>{ev.title}</Text>
              </View>
            </GestureDetector>

            {/* Content */}
            <GestureDetector gesture={contentPan}>
              <View style={styles.contentWrapper}>
                <GHScrollView
                  ref={scrollRef}
                  style={styles.scrollView}
                  contentContainerStyle={styles.content}
                  scrollEventThrottle={16}
                  onScroll={onScroll}
                  bounces={false}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={scrollEnabled}
                >

                  {/* Fight card badge */}
                  {ev.fight_card !== null && ev.fight_card.length > 0 && (
                    <View style={styles.badgesRow}>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{ev.fight_card}</Text>
                      </View>
                    </View>
                  )}

                  {/* Venue */}
                  {ev.venue_name !== null && ev.venue_name.length > 0 && (
                    <View style={styles.infoRow}>
                      <Ionicons name="business-outline" size={16} color={colors.textSecondary} />
                      <Text style={styles.infoText}>{ev.venue_name}</Text>
                    </View>
                  )}

                  {/* Venue profile link — only when event is tied to a partner venue */}
                  {ev.venue_id !== null && ev.venue_name !== null && (
                    <TouchableOpacity
                      style={styles.venueLink}
                      onPress={() => onOpenVenue?.(ev.venue_id as string)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="business-outline" size={16} color={colors.accentBlue} />
                      <Text style={styles.venueLinkText}>
                        {`Veranstaltet von ${ev.venue_name}`}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.accentBlue} />
                    </TouchableOpacity>
                  )}

                  {/* Address */}
                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.infoText}>{ev.address}</Text>
                  </View>

                  {/* Date/time */}
                  <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.infoText}>{formatDateTime(ev.scheduled_at)}</Text>
                  </View>

                  {/* Participants */}
                  <View style={styles.infoRow}>
                    <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.infoText}>
                      {ev.signup_count}/{ev.max_slots} Angemeldet
                      {!isFull && (
                        <Text style={styles.slotsLeft}>
                          {`  ${slotsLeft} ${slotsLeft === 1 ? 'Platz' : 'Plätze'} frei`}
                        </Text>
                      )}
                    </Text>
                  </View>

                  <View style={styles.slotsBar}>
                    <View style={[styles.slotsBarFill, isFull && styles.slotsBarFull, { width: fillPct }]} />
                  </View>

                  {/* Notes */}
                  {ev.notes !== null && ev.notes.length > 0 && (
                    <Text style={styles.notes}>{ev.notes}</Text>
                  )}

                  {/* Signup / cancel button */}
                  <TouchableOpacity
                    style={[
                      styles.btn,
                      ev.is_signed_up && styles.btnCancel,
                      isFull && !ev.is_signed_up && styles.btnDisabled,
                    ]}
                    onPress={handleSignupPress}
                    disabled={loading || (isFull && !ev.is_signed_up)}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.card} />
                    ) : (
                      <Text style={styles.btnText}>
                        {ev.is_signed_up ? 'Abmelden' : isFull ? 'Ausgebucht' : 'Anmelden'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Chat button */}
                  <TouchableOpacity
                    style={styles.chatBtn}
                    onPress={onOpenChat}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chatbubbles-outline" size={18} color={colors.accentBlue} />
                    <Text style={styles.chatBtnText}>Zum Chat</Text>
                  </TouchableOpacity>

                  {/* Creator: deactivate */}
                  {isCreator && (
                    <TouchableOpacity
                      style={styles.btnDeactivate}
                      onPress={handleDeactivate}
                      disabled={loading}
                    >
                      <Text style={styles.btnDeactivateText}>Event absagen</Text>
                    </TouchableOpacity>
                  )}

                </GHScrollView>
              </View>
            </GestureDetector>
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
    backgroundColor:   colors.sparringsOrange,
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
  venueLink: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    paddingVertical: 8,
    borderTopWidth:  1,
    borderTopColor:  colors.border,
  },
  venueLinkText: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.accentBlue,
    flex:       1,
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
});
