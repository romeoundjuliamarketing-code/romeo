import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
  PanResponder,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import type { SparringWithMeta } from '../../hooks/useOpenSparrings';
import type { RootStackParamList } from '../../navigation/types';
import SparringParticipantsList from './SparringParticipantsList';
import MapBoostSheet from './MapBoostSheet';

interface Props {
  sparring:          SparringWithMeta | null;
  currentUserId:     string | null;
  onClose:           () => void;
  onToggleSignup:    () => Promise<void>;
  onDeactivate:      () => void;
  onBoostActivated?: () => void;
  loading:           boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SNAP_HALF    = SCREEN_HEIGHT * 0.42; // shows bottom 50%
const SNAP_FULL    = 0;
const SNAP_DISMISS = SCREEN_HEIGHT;

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
  sparring, currentUserId, onClose, onToggleSignup, onDeactivate, onBoostActivated, loading,
}: Props) {
  const [boostSheetVisible, setBoostSheetVisible] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const translateY  = useRef(new Animated.Value(SNAP_DISMISS)).current;
  const currentSnap = useRef(SNAP_HALF);
  const scrollYRef  = useRef(0);

  // Animate in when a sparring is selected
  useEffect(() => {
    if (sparring !== null) {
      translateY.setValue(SNAP_DISMISS);
      currentSnap.current = SNAP_HALF;
      Animated.spring(translateY, {
        toValue: SNAP_HALF,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sparring?.id]);

  function dismiss(): void {
    Animated.timing(translateY, {
      toValue: SNAP_DISMISS,
      duration: 220,
      useNativeDriver: true,
    }).start(() => onClose());
  }

  function snapToFull(): void {
    currentSnap.current = SNAP_FULL;
    Animated.spring(translateY, { toValue: SNAP_FULL, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }

  function snapToHalf(): void {
    currentSnap.current = SNAP_HALF;
    Animated.spring(translateY, { toValue: SNAP_HALF, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }

  // PanResponder on the banner/handle — controls expand + dismiss
  const handlePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gs) => {
      translateY.setValue(Math.max(SNAP_FULL, currentSnap.current + gs.dy));
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 80 || gs.vy > 0.5) {
        dismiss();
      } else if (gs.dy < -60 || gs.vy < -0.5) {
        snapToFull();
      } else {
        // Snap to closest point
        const projected = currentSnap.current + gs.dy;
        if (projected < SNAP_HALF * 0.5) snapToFull(); else snapToHalf();
      }
    },
  })).current;

  // PanResponder on content wrapper — dismisses when scroll is at top + drag down
  const contentPan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) => scrollYRef.current <= 1 && gs.dy > 8,
    onMoveShouldSetPanResponderCapture: (_, gs) => scrollYRef.current <= 1 && gs.dy > 8,
    onPanResponderMove: (_, gs) => {
      if (gs.dy > 0) translateY.setValue(currentSnap.current + gs.dy);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 80 || gs.vy > 0.5) {
        dismiss();
      } else {
        Animated.spring(translateY, {
          toValue: currentSnap.current,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }).start();
      }
    },
  })).current;

  if (sparring === null) return null;

  const slotsLeft   = sparring.max_slots - sparring.signup_count;
  const isFull      = slotsLeft <= 0;
  const isCreator   = currentUserId !== null && sparring.created_by === currentUserId;
  const bannerColor = getBannerColor(sparring.scheduled_at, sparring.is_featured);
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

  return (
    <Modal visible animationType="none" transparent onRequestClose={dismiss}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={dismiss} />

        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>

          {/* Banner + handle — drag here to expand or dismiss */}
          <View style={[styles.banner, { backgroundColor: bannerColor }]} {...handlePan.panHandlers}>
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

          {/* Content — drag down at top also dismisses */}
          <View style={styles.contentWrapper} {...contentPan.panHandlers}>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.content}
              scrollEventThrottle={16}
              onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
              bounces={false}
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
                  isFull && !sparring.is_signed_up && styles.btnDisabled,
                ]}
                onPress={handleSignupPress}
                disabled={loading || (isFull && !sparring.is_signed_up)}
              >
                {loading ? (
                  <ActivityIndicator color={colors.card} />
                ) : (
                  <Text style={styles.btnText}>
                    {sparring.is_signed_up ? 'Abmelden' : isFull ? 'Ausgebucht' : 'Anmelden'}
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
            </ScrollView>
          </View>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
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
});
