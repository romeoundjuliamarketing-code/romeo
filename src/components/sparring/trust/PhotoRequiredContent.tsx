import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { useAvatarUpload, type PhotoSource } from '../../../hooks/useAvatarUpload';
import ProfilePhoto from '../../profil/ProfilePhoto';

// Shown before joining or publishing a sparring when the profile has no photo.
// The photo is taken or picked right here (face check included), then the
// flow continues; no detour through the profile.
export default function PhotoRequiredContent({ upload, onUploaded, onLater }: {
  upload: (localUri: string) => Promise<{ error: string | null }>;
  onUploaded: () => void;
  onLater: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const avatar = useAvatarUpload(upload);
  const busy = avatar.uploading || avatar.checking;

  function choose(source: PhotoSource): void {
    void avatar.pickFrom(source).then((ok) => { if (ok) onUploaded(); });
  }

  return (
    <View style={styles.wrap}>
      {avatar.localUri !== null ? (
        <View style={styles.preview}>
          <ProfilePhoto uri={avatar.localUri} name="" size={96} />
        </View>
      ) : (
        <View style={styles.iconBadge}>
          <Ionicons name="person-circle-outline" size={32} color={colors.accentBlueText} />
        </View>
      )}
      <Text style={styles.title} accessibilityRole="header">{t('sparringTrust.photo.title')}</Text>
      <Text style={styles.body}>{t('sparringTrust.photo.body')}</Text>
      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.accentBlue} />
          <Text style={styles.busyText}>
            {avatar.checking ? t('profile.photo.checking') : t('profile.editScreen.uploading')}
          </Text>
        </View>
      ) : (
        <>
          <TouchableOpacity style={styles.primary} onPress={() => choose('camera')} accessibilityRole="button">
            <Ionicons name="camera-outline" size={20} color={colors.card} />
            <Text style={styles.primaryText}>{t('profile.photo.camera')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outline} onPress={() => choose('library')} accessibilityRole="button">
            <Ionicons name="images-outline" size={20} color={colors.accentBlueText} />
            <Text style={styles.outlineText}>{t('profile.photo.library')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={onLater} accessibilityRole="button">
            <Text style={styles.secondaryText}>{t('sparringTrust.photo.later')}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 24, paddingTop: 8, gap: 16, alignItems: 'stretch' },
  iconBadge: {
    width: 64, height: 64, borderRadius: 32, alignSelf: 'center',
    backgroundColor: colors.accentBlueTint, alignItems: 'center', justifyContent: 'center',
  },
  preview: { alignSelf: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 24, color: colors.text, textAlign: 'center' },
  primary: {
    minHeight: 48, borderRadius: 24, backgroundColor: colors.accentBlue, flexDirection: 'row', gap: 8,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  primaryText: { fontSize: 16, fontWeight: '700', color: colors.card },
  outline: {
    minHeight: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.accentBlue, flexDirection: 'row', gap: 8,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  outlineText: { fontSize: 16, fontWeight: '700', color: colors.accentBlueText },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 16, fontWeight: '600', color: colors.accentBlueText },
  busy: { minHeight: 48, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  busyText: { fontSize: 16, color: colors.textMuted },
});
