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
import type { Venue } from '../../types/database.types';

interface Props {
  venue: Venue;
  onEditAvatar?: () => void;
  onEditBanner?: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function VenueHero({
  venue,
  onEditAvatar,
  onEditBanner,
}: Props): React.ReactElement {
  return (
    <View style={styles.root}>
      <ImageBackground
        source={venue.banner_url !== null ? { uri: venue.banner_url } : undefined}
        style={styles.banner}
        imageStyle={styles.bannerImage}
      >
        <View style={styles.bannerOverlay} />
        {onEditBanner !== undefined && (
          <TouchableOpacity style={styles.editBannerBtn} onPress={onEditBanner} activeOpacity={0.8}>
            <Ionicons name="camera" size={16} color={colors.card} />
          </TouchableOpacity>
        )}
      </ImageBackground>

      <View style={styles.infoRow}>
        <View style={styles.avatarWrap}>
          {venue.avatar_url !== null ? (
            <Image source={{ uri: venue.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{getInitials(venue.name)}</Text>
            </View>
          )}
          {onEditAvatar !== undefined && (
            <TouchableOpacity style={styles.editAvatarBtn} onPress={onEditAvatar} activeOpacity={0.8}>
              <Ionicons name="camera" size={12} color={colors.card} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.name} numberOfLines={1}>{venue.name}</Text>
          <Text style={styles.venueType} numberOfLines={1}>{venue.venue_type}</Text>
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
  editBannerBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.heroFloatingBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginTop: -OVERLAP,
    gap: 16,
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
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.heroFloatingBtn,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  textWrap: {
    flex: 1,
    paddingTop: OVERLAP + 8,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  venueType: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 0,
  },
});
