import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';

// Card on a full-screen dim layer, rendered INSIDE an already open modal (a
// second RN Modal next to it would not show on iOS). The parent's
// onRequestClose must close this overlay first (Android back).
export default function TrustOverlay({ onClose, children }: {
  onClose: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.dim}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityLabel={t('common.close')} />
      <View style={styles.card}>
        <TouchableOpacity style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.mapOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: colors.background,
    borderRadius: 24,
    overflow: 'hidden',
  },
  close: {
    alignSelf: 'flex-end',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingBottom: 24, gap: 16 },
});
