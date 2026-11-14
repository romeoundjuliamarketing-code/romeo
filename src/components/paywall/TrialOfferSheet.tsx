import React from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import BrandHeroBackground from '../common/BrandHeroBackground';
import { PRIVACY_URL, TERMS_URL } from './PaywallFooter';

const PENGUIN = require('../../../assets/coach/paywall_paket.png');

interface Props {
  /** Trial length, e.g. "7 Tage"; null while the offer loads. */
  duration: string | null;
  /** Price after the trial (Apple: clearly visible next to the button). */
  note: string | null;
  enabled: boolean;
  loading: boolean;
  onStart: () => void;
  onLater: () => void;
}

// Voucher on the deep-blue brand hero (not the gold paywall): the free days
// are the headline, the conditions sit small but readable under the button.
export default function TrialOfferSheet({ duration, note, enabled, loading, onStart, onLater }: Props): React.ReactElement {
  const { t } = useTranslation();
  const benefits: { icon: 'map-marker-radius' | 'cards-playing-outline'; text: string }[] = [
    { icon: 'map-marker-radius', text: t('paywall.hero.premium.benefit1') },
    { icon: 'cards-playing-outline', text: t('paywall.hero.premium.benefit2') },
  ];
  return (
    <View>
      <View style={styles.card}>
        <BrandHeroBackground />

        <TouchableOpacity
          style={styles.close}
          onPress={onLater}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Ionicons name="close" size={24} color={colors.brandHeroText} />
        </TouchableOpacity>

        <Image source={PENGUIN} style={styles.penguin} resizeMode="contain" />

        <View style={styles.kickerRow}>
          <View style={styles.kickerLine} />
          <Text style={styles.kicker}>{t('paywall.offer.badge')}</Text>
          <View style={styles.kickerLine} />
        </View>

        {duration !== null && (
          <View accessible accessibilityRole="header">
            <Text style={styles.headline}>{duration}</Text>
            <Text style={[styles.headline, styles.headlineAccent]}>{t('paywall.offer.free')}</Text>
          </View>
        )}
        <Text style={styles.subtitle}>{t('paywall.offer.subtitle')}</Text>

        <View style={styles.benefits}>
          {benefits.map((item) => (
            <View key={item.icon} style={styles.benefitRow}>
              <MaterialCommunityIcons name={item.icon} size={20} color={colors.brandAccent} />
              <Text style={styles.benefitText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.cta, !enabled && styles.ctaDisabled]}
          onPress={onStart}
          disabled={!enabled || loading}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          {loading ? <ActivityIndicator size="small" color={colors.brandInk} /> : <Text style={styles.ctaLabel}>{t('paywall.offer.cta')}</Text>}
        </TouchableOpacity>

        {note !== null && <Text style={styles.note}>{note}</Text>}
        <Text style={styles.legalNote}>{t('paywall.footer.legalNote')}</Text>

        <View style={styles.links}>
          <TouchableOpacity onPress={() => { void Linking.openURL(PRIVACY_URL); }} activeOpacity={0.7}>
            <Text style={styles.link}>{t('paywall.footer.privacy')}</Text>
          </TouchableOpacity>
          <Text style={styles.separator}>·</Text>
          <TouchableOpacity onPress={() => { void Linking.openURL(TERMS_URL); }} activeOpacity={0.7}>
            <Text style={styles.link}>{t('paywall.footer.terms')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.later} onPress={onLater} disabled={loading} accessibilityRole="button">
        <Text style={styles.laterText}>{t('paywall.offer.later')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.brandHeroLine,
    backgroundColor: colors.brandNight,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  close: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  // 512 x 768 artwork.
  penguin: {
    width: 120,
    height: 176,
  },
  kickerRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kickerLine: {
    width: 24,
    height: 1,
    backgroundColor: colors.brandAccent,
  },
  kicker: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.brandAccent,
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: 64,
    lineHeight: 64,
    textTransform: 'uppercase',
    color: colors.headerTextPrimary,
    textAlign: 'center',
  },
  headlineAccent: {
    color: colors.brandAccent,
  },
  subtitle: {
    marginTop: 8,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: colors.brandHeroText,
  },
  benefits: {
    alignSelf: 'stretch',
    marginTop: 24,
    padding: 16,
    gap: 8,
    borderRadius: 16,
    backgroundColor: colors.brandHeroChip,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: colors.headerTextPrimary,
  },
  cta: {
    alignSelf: 'stretch',
    marginTop: 24,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: colors.brandInk,
  },
  note: {
    marginTop: 16,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    lineHeight: 18,
    color: colors.headerTextPrimary,
    textAlign: 'center',
  },
  legalNote: {
    marginTop: 8,
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    lineHeight: 14,
    color: colors.brandHeroText,
    textAlign: 'center',
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  link: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: colors.brandHeroText,
    paddingVertical: 8,
  },
  separator: {
    fontSize: 11,
    color: colors.brandHeroText,
  },
  later: {
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  laterText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: colors.headerTextPrimary,
  },
});
