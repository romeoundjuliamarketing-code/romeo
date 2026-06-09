import React from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface Props {
  name: string;
  city: string;
  address: string | null;
  bannerUrl: string | null;
  avatarUrl: string | null;
  isOwner: boolean;
  onEditPress: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function StudioHero({
  name,
  city,
  address,
  bannerUrl,
  avatarUrl,
  isOwner,
  onEditPress,
}: Props): React.ReactElement {
  return (
    <View style={styles.root}>
      <ImageBackground
        source={bannerUrl !== null ? { uri: bannerUrl } : undefined}
        style={styles.banner}
        imageStyle={styles.bannerImage}
      >
        <View style={styles.bannerOverlay} />
        {isOwner && (
          <TouchableOpacity style={styles.editBtn} onPress={onEditPress} activeOpacity={0.8}>
            <Ionicons name="pencil" size={16} color={colors.card} />
          </TouchableOpacity>
        )}
      </ImageBackground>

      <View style={styles.infoRow}>
        <View style={styles.avatarWrap}>
          {avatarUrl !== null ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
            </View>
          )}
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.city} numberOfLines={1}>
            {address !== null ? `${city}  ·  ${address}` : city}
          </Text>
        </View>
      </View>
    </View>
  );
}

const AVATAR_SIZE = 72;
const BANNER_HEIGHT = 200;
const OVERLAP = AVATAR_SIZE / 2;

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.card,
  },
  banner: {
    height: BANNER_HEIGHT,
    backgroundColor: colors.dark,
  },
  bannerImage: {
    resizeMode: 'cover',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.heroBannerScrim,
  },
  editBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.heroFloatingBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginTop: -OVERLAP,
    gap: 12,
  },
  avatarWrap: {
    borderWidth: 3,
    borderColor: colors.card,
    borderRadius: (AVATAR_SIZE + 6) / 2,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.card,
    letterSpacing: 1,
  },
  textWrap: {
    flex: 1,
    paddingBottom: 4,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  city: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
