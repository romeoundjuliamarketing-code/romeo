import React from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export interface Participant {
  id:        string;
  name:      string | null;
  avatarUrl: string | null;
}

interface Props {
  participants:  Participant[];
  isSignedUp:    boolean;
  loading:       boolean;
  isFull:        boolean;
  onToggle:      () => void;
}

const MAX_AVATARS = 5;

function getInitial(name: string | null): string {
  if (name === null || name.trim().length === 0) return '?';
  return name.trim().charAt(0).toUpperCase();
}

export default function SparringChatParticipantBar({
  participants, isSignedUp, loading, isFull, onToggle,
}: Props) {
  const visible  = participants.slice(0, MAX_AVATARS);
  const overflow = participants.length - MAX_AVATARS;

  return (
    <View style={styles.bar}>
      <View style={styles.avatarRow}>
        {visible.map((p) => (
          <View key={p.id} style={styles.avatar}>
            {p.avatarUrl !== null ? (
              <Image source={{ uri: p.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitial}>{getInitial(p.name)}</Text>
            )}
          </View>
        ))}
        {overflow > 0 && (
          <View style={[styles.avatar, styles.avatarOverflow]}>
            <Text style={styles.avatarOverflowText}>+{overflow}</Text>
          </View>
        )}
        {participants.length === 0 && (
          <Text style={styles.empty}>Noch niemand angemeldet</Text>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.btn,
          isSignedUp  && styles.btnCancel,
          !isSignedUp && isFull && styles.btnFull,
        ]}
        onPress={onToggle}
        disabled={loading || (!isSignedUp && isFull)}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.card} />
        ) : (
          <Text style={styles.btnText}>
            {isSignedUp ? 'Abmelden' : isFull ? 'Ausgebucht' : 'Ich bin dabei'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    backgroundColor:   colors.background,
    gap:               12,
  },
  avatarRow: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           -6,
  },
  avatar: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: colors.accentBlueSoft,
    borderWidth:     2,
    borderColor:     colors.background,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },
  avatarImg: {
    width:  32,
    height: 32,
  },
  avatarInitial: {
    fontSize:   13,
    fontWeight: '700',
    color:      colors.accentBlue,
  },
  avatarOverflow: {
    backgroundColor: colors.border,
  },
  avatarOverflowText: {
    fontSize:   11,
    fontWeight: '600',
    color:      colors.textSecondary,
  },
  empty: {
    fontSize: 13,
    color:    colors.textSecondary,
  },
  btn: {
    height:            36,
    paddingHorizontal: 16,
    borderRadius:      18,
    backgroundColor:   colors.accentBlue,
    alignItems:        'center',
    justifyContent:    'center',
    minWidth:          110,
  },
  btnCancel: {
    backgroundColor: colors.deleteRed,
  },
  btnFull: {
    backgroundColor: colors.textSecondary,
  },
  btnText: {
    fontSize:   14,
    fontWeight: '700',
    color:      colors.card,
  },
});
