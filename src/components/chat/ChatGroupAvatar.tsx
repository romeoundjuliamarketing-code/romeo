import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { getInitials } from '../../utils/initials';
import { AVATAR_TONES, avatarToneIndex } from '../../utils/avatarTone';
import type { ChatParticipant } from '../../hooks/useSparringChatList';

// Visual anchor of a chat row: up to two OTHER members (server order:
// organizer first, then by signup), stacked diagonally, plus "+N" for the
// rest in the free top-right corner. Missing/broken photos show initials on
// the person's fixed tone. No member data at all: sport symbol on a tone
// fixed by the chat id. No sport badge on the people: the title names it.
function ChatGroupAvatar({ chatId, kind, participants, otherCount, compact = false, onBlue = false }: {
  chatId:       string;
  kind:         'sparring' | 'event';
  participants: ChatParticipant[];
  otherCount:   number;
  compact?:     boolean;
  /** Row sits on the blue next-up surface: rings take that colour. */
  onBlue?:      boolean;
}): React.ReactElement {
  const s = compact ? small : large;
  const ring = onBlue ? styles.ringOnBlue : styles.ring;
  const shown = participants.slice(0, 2);
  const rest = Math.max(0, otherCount - shown.length);

  if (shown.length === 0) {
    return (
      <View style={s.box} accessible={false}>
        <View style={[s.tile, toneStyles[avatarToneIndex(chatId)]]}>
          {kind === 'sparring' ? (
            <MaterialCommunityIcons name="boxing-glove" size={compact ? 20 : 26} color={colors.text} />
          ) : (
            <Ionicons name="tv-outline" size={compact ? 20 : 24} color={colors.text} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={s.box} accessible={false}>
      {shown.length === 1 ? (
        <Person person={shown[0]} style={[s.single, ring]} initialsStyle={s.initialsSingle} />
      ) : (
        <>
          <Person person={shown[0]} style={[s.pair, s.pairFirst, ring]} initialsStyle={s.initials} />
          <Person person={shown[1]} style={[s.pair, s.pairSecond, ring]} initialsStyle={s.initials} />
        </>
      )}
      {rest > 0 && (
        <View style={[s.more, ring]}>
          <Text style={s.moreText} maxFontSizeMultiplier={1}>{`+${Math.min(rest, 99)}`}</Text>
        </View>
      )}
    </View>
  );
}

export default React.memo(ChatGroupAvatar);

function Person({ person, style, initialsStyle }: {
  person:        ChatParticipant;
  style:         StyleProp<ViewStyle>;
  initialsStyle: StyleProp<TextStyle>;
}): React.ReactElement {
  // A broken URL falls back to initials for the rest of this mount.
  const [failed, setFailed] = useState(false);
  return (
    <View style={[style, toneStyles[avatarToneIndex(person.id)]]}>
      {person.avatarUrl !== null && !failed ? (
        <Image source={{ uri: person.avatarUrl }} style={styles.img} onError={() => setFailed(true)} />
      ) : (
        <Text style={initialsStyle} maxFontSizeMultiplier={1}>{getInitials(person.name)}</Text>
      )}
    </View>
  );
}

const RING = 2;

function circle(d: number): ViewStyle {
  return {
    position: 'absolute',
    width: d,
    height: d,
    borderRadius: d / 2,
    borderWidth: RING,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };
}

// Diagonal pair in a square box: first top-left, second bottom-right.
function sizes(box: number, pair: number, single: number, chip: number, initials: number) {
  return StyleSheet.create({
    box: { width: box, height: box },
    tile: {
      width: box,
      height: box,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    single: { ...circle(single), left: (box - single) / 2, top: (box - single) / 2 },
    pair: circle(pair),
    pairFirst: { left: 0, top: 0 },
    pairSecond: { right: 0, bottom: 0 },
    initials: { fontSize: initials, fontWeight: '700', color: colors.text },
    initialsSingle: { fontSize: initials + 4, fontWeight: '700', color: colors.text },
    more: {
      position: 'absolute',
      right: 0,
      top: 0,
      minWidth: chip + 4,
      height: chip,
      paddingHorizontal: 4,
      borderRadius: chip / 2,
      borderWidth: RING,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreText: { fontSize: chip >= 24 ? 11 : 10, fontWeight: '700', color: colors.text },
  });
}

const large = sizes(56, 38, 52, 24, 14);
const small = sizes(40, 28, 36, 20, 11);

const toneStyles = AVATAR_TONES.map((tone) => StyleSheet.create({ t: { backgroundColor: tone } }).t);

const styles = StyleSheet.create({
  ring: {
    borderColor: colors.background,
  },
  ringOnBlue: {
    borderColor: colors.accentBlueTint,
  },
  img: {
    width: '100%',
    height: '100%',
  },
});
