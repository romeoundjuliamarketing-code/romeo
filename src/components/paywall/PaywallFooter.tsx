import React from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';

const PRIVACY_URL = 'https://www.notion.so/Datenschutzerkl-rung-Sparr-34f1f56f1531804ebd59ec7351220d82?source=copy_link';
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

interface Props {
  label: string;
  enabled: boolean;
  loading: boolean;
  onPurchase: () => void;
  onRestore: () => void;
}

export default function PaywallFooter({ label, enabled, loading, onPurchase, onRestore }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
      <TouchableOpacity
        style={[styles.cta, !enabled && styles.ctaDisabled]}
        onPress={onPurchase}
        disabled={!enabled || loading}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        {loading ? <ActivityIndicator size="small" color={colors.card} /> : <Text style={styles.ctaLabel}>{label}</Text>}
      </TouchableOpacity>

      <Text style={styles.legalNote}>
        {t('paywall.footer.legalNote')}
      </Text>

      <View style={styles.links}>
        <TouchableOpacity onPress={onRestore} activeOpacity={0.7} accessibilityRole="button">
          <Text style={styles.link}>{t('paywall.footer.restore')}</Text>
        </TouchableOpacity>
        <Text style={styles.separator}>·</Text>
        <TouchableOpacity onPress={() => { void Linking.openURL(PRIVACY_URL); }} activeOpacity={0.7}>
          <Text style={styles.link}>{t('paywall.footer.privacy')}</Text>
        </TouchableOpacity>
        <Text style={styles.separator}>·</Text>
        <TouchableOpacity onPress={() => { void Linking.openURL(TERMS_URL); }} activeOpacity={0.7}>
          <Text style={styles.link}>{t('paywall.footer.terms')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  cta: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentBlue,
  },
  ctaDisabled: {
    backgroundColor: colors.accentBlueMuted,
  },
  ctaLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: colors.card,
  },
  legalNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  link: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: colors.accentBlueText,
    paddingVertical: 8,
  },
  separator: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
