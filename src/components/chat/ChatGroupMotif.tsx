import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { getInitials } from '../../utils/initials';
import type { ChatParticipant } from '../../hooks/useSparringChatList';

// Group motif of a chat row: symbol on a light blue tile (glove = sparring,
// screen = event; chats have no group photo), plus up to two real members as
// small overlapping avatars on the lower edge. Nothing invented: no members,
// no avatars.
function ChatGroupMotif({ kind, participants, compact = false, highlighted = false }: {
  kind:         'sparring' | 'event';
  participants: ChatParticipant[];
  compact?:     boolean;
  /** Row sits on the blue "Als Nächstes" surface: white tile, matching rings. */
  highlighted?: boolean;
}): React.ReactElement {
  const shown = participants.slice(0, 2);
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]} accessible={false}>
      <View style={[styles.tile, compact && styles.tileCompact, highlighted && styles.tileOnBlue]}>
        {kind === 'sparring' ? (
          <MaterialCommunityIcons name="boxing-glove" size={compact ? 20 : 26} color={colors.accentBlueText} />
        ) : (
          <Ionicons name="tv-outline" size={compact ? 20 : 24} color={colors.accentBlueText} />
        )}
      </View>
      {!compact && shown.length > 0 && (
        <View style={styles.avatars}>
          {shown.map((p, i) => (
            <View key={p.id} style={[styles.avatar, i > 0 && styles.avatarOverlap, highlighted && styles.avatarOnBlue]}>
              {p.avatarUrl !== null ? (
                <Image source={{ uri: p.avatarUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.initials} maxFontSizeMultiplier={1}>{getInitials(p.name)}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default React.memo(ChatGroupMotif);

const AVATAR = 24;

const styles = StyleSheet.create({
  wrap: {
    width: 56,
    height: 64,
  },
  wrapCompact: {
    width: 40,
    height: 40,
  },
  tile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.accentBlueTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileCompact: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  avatars: {
    position: 'absolute',
    right: -8,
    bottom: 0,
    flexDirection: 'row',
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2,
    borderColor: colors.background,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileOnBlue: {
    backgroundColor: colors.card,
  },
  avatarOnBlue: {
    borderColor: colors.accentBlueTint,
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  initials: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
});
