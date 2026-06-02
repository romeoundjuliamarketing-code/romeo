import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
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
  sparring:         SparringWithMeta | null;
  currentUserId:    string | null;
  onClose:          () => void;
  onToggleSignup:   () => Promise<void>;
  onDeactivate:     () => void;
  onBoostActivated?: () => void;
  loading:          boolean;
}

// Banner color follows time-window (today=red, this week=orange, later=blue)
// Featured sparrings always get accentBlue
function getBannerColor(scheduledAt: string, isFeatured: boolean): string {
  if (isFeatured) return colors.accentBlue;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(scheduledAt);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return '#D94A4A'; // deleteRed equivalent
  if (diff <= 7) return '#F5820A';
  return colors.accentBlue;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time} Uhr`;
}

export default function SparringDetailSheet({ sparring, currentUserId, onClose, onToggleSignup, onDeactivate, onBoostActivated, loading }: Props) {
  const [boostSheetVisible, setBoostSheetVisible] = useState(false);
  const dragStartY = useRef(0);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (_, gs) => { dragStartY.current = gs.y0; },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 80) onClose();
    },
  })).current;

  if (sparring === null) return null;

  const slotsLeft  = sparring.max_slots - sparring.signup_count;
  const isFull     = slotsLeft <= 0;
  const isCreator  = currentUserId !== null && sparring.created_by === currentUserId;
  const bannerColor = getBannerColor(sparring.scheduled_at, sparring.is_featured);
  const fillPct    = `${Math.min(100, Math.round((sparring.signup_count / sparring.max_slots) * 100))}%` as const;

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  function handlePressProfile(userId: string): void {
    if (sparring === null) return;
    onClose();
    navigation.navigate('PublicProfile', {
      userId,
      sparringId:          sparring.id,
      sparringScheduledAt: sparring.scheduled_at,
    });
  }

  function handleSignupPress(): void {
    if (sparring === null) return;
    if (sparring.is_signed_up) {
      Alert.alert(
        'Abmelden',
        `Möchtest du dich von „${sparring.title}" abmelden?`,
        [
          { text: 'Zurück', style: 'cancel' },
          { text: 'Abmelden', style: 'destructive', onPress: () => { void onToggleSignup(); } },
        ],
      );
    } else {
      Alert.alert(
        'Anmelden',
        `Möchtest du dich für „${sparring.title}" anmelden?`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Anmelden', onPress: () => { void onToggleSignup(); } },
        ],
      );
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>

          {/* Hero banner — color follows time window; handle sits inside */}
          <View style={[styles.banner, { backgroundColor: bannerColor }]}>
            <View style={styles.handleRow} {...panResponder.panHandlers}>
              <View style={styles.handle} />
            </View>
          <TouchableOpacity
            style={styles.bannerClose}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={22} color={colors.card} />
          </TouchableOpacity>
          <Text style={styles.bannerTitle} numberOfLines={2}>{sparring.title}</Text>
        </View>

        {/* Scrollable content below banner */}
        <View style={styles.content}>

          {/* Badges row */}
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
            <Text style={styles.infoText}>
              {sparring.studio_name} · {sparring.address}
            </Text>
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

          {/* Slots progress bar */}
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
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
    paddingBottom:    20,
    justifyContent:   'flex-end',
  },
  bannerClose: {
    position:        'absolute',
    top:             8,
    right:           16,
    width:           36,
    height:          36,
    alignItems:      'center',
    justifyContent:  'center',
  },
  bannerTitle: {
    fontSize:   22,
    fontWeight: '700',
    color:      colors.card,
    lineHeight: 28,
  },
  content: {
    padding:       24,
    paddingTop:    16,
    paddingBottom: 40,
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
    fontSize:        14,
    color:           colors.text,
    lineHeight:      20,
    paddingTop:      4,
    borderTopWidth:  1,
    borderTopColor:  colors.border,
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
