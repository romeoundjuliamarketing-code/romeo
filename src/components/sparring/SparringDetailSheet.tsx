import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import type { SparringWithMeta } from '../../hooks/useOpenSparrings';
import type { RootStackParamList } from '../../navigation/types';
import SparringParticipantsList from './SparringParticipantsList';

interface Props {
  sparring: SparringWithMeta | null;
  currentUserId: string | null;
  onClose: () => void;
  onToggleSignup: () => Promise<void>;
  onDeactivate: () => void;
  loading: boolean;
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

export default function SparringDetailSheet({ sparring, currentUserId, onClose, onToggleSignup, onDeactivate, loading }: Props) {
  if (sparring === null) return null;

  const slotsLeft = sparring.max_slots - sparring.signup_count;
  const isFull = slotsLeft <= 0;
  const isCreator = currentUserId !== null && sparring.created_by === currentUserId;

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

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={2}>{sparring.title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>{sparring.discipline}</Text>
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

        {sparring.notes !== null && sparring.notes.length > 0 && (
          <Text style={styles.notes}>{sparring.notes}</Text>
        )}

        <SparringParticipantsList
          sparringId={sparring.id}
          currentUserId={currentUserId}
          sparringScheduledAt={sparring.scheduled_at}
          onPressProfile={handlePressProfile}
          onPressChat={isCreator ? (userId, name) => {
            onClose();
            navigation.navigate('SparringChat', {
              sparringId:      sparring.id,
              otherUserId:     userId,
              otherUserName:   name,
              organizerUserId: sparring.created_by,
            });
          } : undefined}
        />

        {currentUserId !== null && currentUserId !== sparring.created_by && sparring.is_signed_up === true && (
          <TouchableOpacity
            style={styles.chatBtn}
            activeOpacity={0.8}
            onPress={() => {
              onClose();
              navigation.navigate('SparringChat', {
                sparringId:      sparring.id,
                otherUserId:     sparring.created_by,
                otherUserName:   'Organisator',
                organizerUserId: sparring.created_by,
              });
            }}
          >
            <Ionicons name="chatbubble-outline" size={18} color={colors.accentBlue} />
            <Text style={styles.chatBtnText}>Schreibe an Organisator</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.btn,
            sparring.is_signed_up && styles.btnCancel,
            isFull && !sparring.is_signed_up && styles.btnDisabled,
          ]}
          onPress={onToggleSignup}
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
            style={styles.btnDeactivate}
            onPress={onDeactivate}
            disabled={loading}
          >
            <Text style={styles.btnDeactivateText}>Sparring absagen</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 14,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    lineHeight: 26,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  slotsLeft: {
    color: colors.difficultyGreen,
    fontWeight: '600',
  },
  notes: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btn: {
    backgroundColor: colors.accentBlue,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnCancel: {
    backgroundColor: colors.deleteRed,
  },
  btnDisabled: {
    backgroundColor: colors.textSecondary,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
  },
  btnDeactivate: {
    borderRadius: 14,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(217,74,74,0.4)',
  },
  btnDeactivateText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.deleteRed,
  },
  chatBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             8,
    paddingVertical: 16,
    borderTopWidth:  1,
    borderTopColor:  colors.border,
    marginTop:       8,
  },
  chatBtnText: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.accentBlue,
  },
});
