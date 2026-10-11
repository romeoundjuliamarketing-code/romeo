import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { useSparringOrganizer } from '../../hooks/useSparringOrganizer';
import { initialsOf } from '../../utils/sparringDetail';
import { avatarTone } from '../../utils/avatarTone';

// Personal opening of the invitation: small avatar + "<Name> lädt ein".
// Tapping opens the organizer's public profile (own sparring: "Du lädst ein",
// no navigation). The only place the host is shown. No ratings or badges.
export default function SparringOrganizerRow({ organizerId, isCreator, onPressProfile }: {
  organizerId:    string;
  isCreator:      boolean;
  onPressProfile: (userId: string) => void;
}): React.ReactElement | null {
  const { t } = useTranslation();
  const organizer = useSparringOrganizer(organizerId);
  const name = organizer?.name?.trim() ?? '';
  if (!isCreator && name.length === 0) return null;
  const avatar = organizer?.avatar_url ?? null;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && !isCreator && styles.pressed]}
      onPress={() => onPressProfile(organizerId)}
      disabled={isCreator}
      accessibilityRole={isCreator ? undefined : 'link'}
      accessibilityLabel={isCreator ? t('sparring.invite.youInvite') : t('sparring.invite.organizerA11y', { name })}
    >
      <View style={[styles.avatar, { backgroundColor: avatarTone(organizerId) }]}>
        {avatar !== null && avatar.length > 0 ? (
          <Image source={{ uri: avatar }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.initials}>{initialsOf(organizer?.name ?? null)}</Text>
        )}
      </View>
      {isCreator ? (
        <Text style={styles.text} numberOfLines={1}>{t('sparring.invite.youInvite')}</Text>
      ) : (
        <Text style={styles.text} numberOfLines={1}>
          <Text style={styles.name}>{name}</Text> {t('sparring.invite.invites')}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    alignSelf:     'flex-start',
    maxWidth:      '100%',
    gap:           8,
    minHeight:     44,
  },
  pressed: {
    opacity: 0.7,
  },
  avatar: {
    width:           28,
    height:          28,
    borderRadius:    14,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },
  avatarImage: {
    width:  '100%',
    height: '100%',
  },
  initials: {
    fontSize:   12,
    fontWeight: '800',
    color:      colors.text,
  },
  text: {
    flexShrink: 1,
    fontSize:   15,
    lineHeight: 20,
    color:      colors.textMuted,
  },
  name: {
    fontWeight: '800',
    color:      colors.text,
  },
});
