import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../theme/colors';
import type { VerificationTier } from '../../utils/verificationTier';
import type { FightRecord } from '../../hooks/useFightRecord';
import type { Profile } from '../../types/database.types';

// Derives initials from a full name (e.g. "Romeo Georgiadis" → "RG")
export function getInitials(name: string | null): string {
  if (name === null || name.trim().length === 0) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

interface ProfileHeroProps {
  profile: Profile | null;
  tier: VerificationTier;
  fights: FightRecord[];
  totalPoints: number;
  streak: number;
  onPressSettings: () => void;
  onPressSearch: () => void;
  onPressShare: () => void;
  onPressEdit: () => void;
  onPressFights: () => void;
  onPressPoints: () => void;
  onPressStreak: () => void;
  onUploadAvatar: (localUri: string) => Promise<{ error: string | null }>;
}

const BANNER_HEIGHT = 120;
const AVATAR_SIZE = 80;
const AVATAR_OFFSET = AVATAR_SIZE / 2;

export default function ProfileHero({
  profile,
  tier,
  fights,
  totalPoints,
  streak,
  onPressSettings,
  onPressSearch,
  onPressShare,
  onPressEdit,
  onPressFights,
  onPressPoints,
  onPressStreak,
  onUploadAvatar,
}: ProfileHeroProps): React.ReactElement {
  const initials = getInitials(profile?.name ?? null);

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const displayUri = localUri ?? profile?.avatar_url ?? null;

  async function handlePickAvatar(): Promise<void> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Zugriff erforderlich',
        'Bitte erlaube den Zugriff auf deine Fotos in den Einstellungen, um dein Profilbild zu ändern.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;
    const uri = result.assets[0].uri;
    setLocalUri(uri);
    setUploading(true);
    try {
      const { error } = await onUploadAvatar(uri);
      if (error !== null) {
        setLocalUri(null);
        Alert.alert('Upload fehlgeschlagen', error);
      }
    } catch (e) {
      setLocalUri(null);
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler.';
      Alert.alert('Fehler', msg);
    } finally {
      setUploading(false);
    }
  }
  const displayName = profile?.name ?? 'Kämpfer';
  const isVerified = tier === 'verified';

  const totalFights = fights.length;
  const totalWins = fights.filter((f) => f.result === 'win').length;

  const stanceLabel =
    profile?.stance === 'orthodox'
      ? 'Orthodox'
      : profile?.stance === 'southpaw'
      ? 'Southpaw'
      : null;

  // Meta line: weight class · nationality (only if set)
  const metaParts: string[] = [];
  if (profile?.weight_class !== null && profile?.weight_class !== undefined && profile.weight_class.length > 0) {
    metaParts.push(profile.weight_class);
  }
  if (profile?.nationality !== null && profile?.nationality !== undefined && profile.nationality.length > 0) {
    metaParts.push(profile.nationality);
  }
  if (stanceLabel !== null) {
    metaParts.push(stanceLabel);
  }

  return (
    <View style={styles.container}>
      {/* ── Banner ── */}
      <View style={styles.banner}>
        {/* Top-bar icon buttons overlay on banner */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={onPressShare}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.topBarBtn}
          >
            <Ionicons name="qr-code-outline" size={22} color={colors.headerTextPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onPressSearch}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.topBarBtn}
          >
            <MaterialCommunityIcons name="magnify" size={22} color={colors.headerTextPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onPressSettings}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.topBarBtn}
          >
            <MaterialCommunityIcons name="cog-outline" size={22} color={colors.headerTextPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Avatar (overlaps banner, tap to change photo) ── */}
      <TouchableOpacity
        style={styles.avatarTouch}
        onPress={() => { void handlePickAvatar(); }}
        activeOpacity={0.85}
      >
        <View style={styles.avatarWrapper}>
          {displayUri !== null ? (
            <Image
              source={{ uri: displayUri }}
              style={styles.avatarImage}
              onError={() => setLocalUri(null)}
            />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
        </View>
        <View style={styles.avatarBadge}>
          {uploading ? (
            <ActivityIndicator size={12} color={colors.card} />
          ) : (
            <MaterialCommunityIcons name="camera" size={14} color={colors.card} />
          )}
        </View>
      </TouchableOpacity>

      {/* ── Name + content below avatar ── */}
      <View style={styles.body}>
        {/* Name row with optional verified badge */}
        <View style={styles.nameRow}>
          <Text style={styles.name}>{displayName}</Text>
          {isVerified && (
            <Ionicons name="checkmark-circle" size={20} color={colors.accentBlue} />
          )}
        </View>

        {/* Nickname in quotes (only if set) */}
        {profile?.nickname !== null && profile?.nickname !== undefined && profile.nickname.length > 0 && (
          <Text style={styles.nickname}>"{profile.nickname}"</Text>
        )}

        {/* Profile code as handle */}
        {profile?.profile_code !== undefined && profile.profile_code.length > 0 && (
          <Text style={styles.handle}>@{profile.profile_code}</Text>
        )}

        {/* Meta line: weight class · nationality */}
        {metaParts.length > 0 && (
          <Text style={styles.meta}>{metaParts.join(' · ')}</Text>
        )}

        {/* Counter row */}
        <View style={styles.countersRow}>
          <TouchableOpacity style={styles.counterItem} onPress={onPressFights} activeOpacity={0.7}>
            <Text style={styles.counterValue}>{totalFights}</Text>
            <Text style={styles.counterLabel}>Kämpfe</Text>
          </TouchableOpacity>
          <View style={styles.counterDivider} />
          <TouchableOpacity style={styles.counterItem} onPress={onPressFights} activeOpacity={0.7}>
            <Text style={styles.counterValue}>{totalWins}</Text>
            <Text style={styles.counterLabel}>Siege</Text>
          </TouchableOpacity>
          <View style={styles.counterDivider} />
          <TouchableOpacity style={styles.counterItem} onPress={onPressPoints} activeOpacity={0.7}>
            <Text style={styles.counterValue}>{totalPoints}</Text>
            <Text style={styles.counterLabel}>Punkte</Text>
          </TouchableOpacity>
          <View style={styles.counterDivider} />
          <TouchableOpacity style={styles.counterItem} onPress={onPressStreak} activeOpacity={0.7}>
            <Text style={styles.counterValue}>{streak}</Text>
            <Text style={styles.counterLabel}>Streak</Text>
          </TouchableOpacity>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={onPressEdit}
            activeOpacity={0.8}
          >
            <Text style={styles.editBtnText}>Profil bearbeiten</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={onPressShare}
            activeOpacity={0.8}
          >
            <Ionicons name="share-outline" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: colors.dark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },

  // Banner
  banner: {
    height: BANNER_HEIGHT,
    backgroundColor: colors.dark,
    justifyContent: 'flex-end',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    paddingTop: 12,
    paddingRight: 16,
    gap: 8,
  },
  topBarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Avatar overlaps banner bottom
  avatarTouch: {
    marginTop: -AVATAR_OFFSET,
    marginLeft: 16,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  avatarWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.card,
    overflow: 'hidden',
    backgroundColor: colors.accentBlueSoft,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarCircle: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.accentBlue,
  },

  // Content below avatar
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  nickname: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  handle: {
    fontSize: 13,
    color: colors.inactive,
    fontWeight: '500',
  },
  meta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Counters
  countersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 12,
  },
  counterItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  counterDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  counterValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  counterLabel: {
    fontSize: 11,
    color: colors.inactive,
    fontWeight: '500',
  },

  // Action buttons
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  editBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.card,
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
