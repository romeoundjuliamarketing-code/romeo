import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, View, Text, TouchableOpacity, Share, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface Props {
  visible:     boolean;
  onClose:     () => void;
  name:        string | null;
  /** The profile's technical ID — shown only here, not in the profile header. */
  profileCode: string | null;
  isOwn:       boolean;
}

// QR code + share sheet of an athlete profile (own and foreign). Others scan
// the code or search for the profile ID.
export default function ProfileQrShareSheet({ visible, onClose, name, profileCode, isOwn }: Props): React.ReactElement {
  const { t } = useTranslation();
  async function handleShare(): Promise<void> {
    if (profileCode === null) return;
    await Share.share({
      message: t('profile.qr.message', { name: name ?? t('profile.qr.unknown'), code: profileCode }),
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('profile.share.title')}</Text>
          <Text style={styles.hint}>
            {isOwn
              ? t('profile.qr.hintOwn')
              : t('profile.qr.hintOther')}
          </Text>
          {profileCode !== null && (
            <QRCode value={profileCode} size={200} color={colors.brandInk} backgroundColor={colors.card} />
          )}
          <Text style={styles.idLabel}>{isOwn ? t('profile.qr.idOwn') : t('profile.qr.id')}</Text>
          <Text style={styles.code}>{profileCode ?? ''}</Text>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => { void handleShare(); }}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Ionicons name="share-outline" size={18} color={colors.card} />
            <Text style={styles.shareBtnText}>{t('profile.qr.share')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex:            1,
    justifyContent:  'flex-end',
    backgroundColor: colors.mapOverlay,
  },
  sheet: {
    backgroundColor:      colors.card,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:              24,
    paddingBottom:        40,
    alignItems:           'center',
    gap:                  16,
  },
  handle: {
    width:           32,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.brandBorder,
  },
  title: {
    fontSize:   20,
    fontWeight: '700',
    color:      colors.brandInk,
    textAlign:  'center',
  },
  hint: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.brandMuted,
    textAlign:  'center',
  },
  idLabel: {
    fontSize:     12,
    color:        colors.brandMuted,
    marginBottom: -8,
  },
  code: {
    fontSize:      15,
    fontWeight:    '700',
    color:         colors.brandInk,
    letterSpacing: 2,
  },
  shareBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    minHeight:         48,
    backgroundColor:   colors.brandPrimary,
    borderRadius:      16,
    paddingHorizontal: 24,
  },
  shareBtnText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.card,
  },
});
