import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { View, Text, Image, Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { getInitials } from '../../utils/initials';
import RingRopesBackdrop from '../common/RingRopesBackdrop';
import { TextAction } from '../common/TextAction';

// Picks with the system crop in the final proportions and moderate quality,
// so uploads stay small (no extra native image library).
async function pickImage(aspect: [number, number]): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(i18n.t('gym.imageFields.permTitle'), i18n.t('gym.imageFields.permBody'));
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect, quality: 0.7 });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}

// Cover (training photo, wide) and logo (square) of the gym edit form.
export default function GymImageFields({ name, coverUri, logoUri, onCover, onLogo }: {
  name:     string;
  coverUri: string | null;
  logoUri:  string | null;
  onCover:  (uri: string) => void;
  onLogo:   (uri: string) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Text style={styles.label}>{t('gym.imageFields.cover')}</Text>
        <View style={styles.cover}>
          {coverUri !== null ? (
            <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
          ) : (
            <RingRopesBackdrop />
          )}
        </View>
        <Text style={styles.hint}>{t('gym.imageFields.coverHint')}</Text>
        <TextAction
          label={coverUri !== null ? t('gym.imageFields.changeCover') : t('gym.imageFields.chooseCover')}
          icon="image-outline"
          onPress={() => { void pickImage([16, 9]).then((uri) => { if (uri !== null) onCover(uri); }); }}
        />
      </View>

      <View style={styles.logoRow}>
        <View style={styles.logo}>
          {logoUri !== null ? (
            <Image source={{ uri: logoUri }} style={styles.logoImage} resizeMode="cover" accessibilityIgnoresInvertColors />
          ) : (
            <Text style={styles.initials} maxFontSizeMultiplier={1}>{getInitials(name)}</Text>
          )}
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>{t('gym.imageFields.logo')}</Text>
          <TextAction
            label={logoUri !== null ? t('gym.imageFields.changeLogo') : t('gym.imageFields.chooseLogo')}
            icon="camera-outline"
            onPress={() => { void pickImage([1, 1]).then((uri) => { if (uri !== null) onLogo(uri); }); }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 24,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize:   14,
    fontWeight: '700',
    color:      colors.text,
  },
  hint: {
    fontSize:   13,
    lineHeight: 18,
    color:      colors.textMuted,
  },
  cover: {
    width:           '100%',
    aspectRatio:     16 / 9,
    borderRadius:    16,
    overflow:        'hidden',
    backgroundColor: colors.dark,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           16,
  },
  logo: {
    width:           72,
    height:          72,
    borderRadius:    16,
    overflow:        'hidden',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.dark,
  },
  logoImage: {
    width:           '100%',
    height:          '100%',
    backgroundColor: colors.card,
  },
  initials: {
    fontFamily: fonts.display,
    fontSize:   28,
    color:      colors.headerTextPrimary,
  },
  flex: {
    flex: 1,
  },
});
