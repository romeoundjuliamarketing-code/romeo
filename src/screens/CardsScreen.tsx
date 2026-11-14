import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Purchases, { INTRO_ELIGIBILITY_STATUS, PurchasesStoreProduct } from 'react-native-purchases';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import { useEntitlement } from '../hooks/useEntitlement';
import { previewChallenges } from '../utils/challengeAvailability';
import { planForProduct, PREMIUM_PLAN } from '../utils/subscriptionPlans';
import { freeTrialOffer, IntroEligibility, paywallCta } from '../utils/paywallTrial';
import { CardsCta, CardsHero, CardsHowLink, CardsSteps } from '../components/challenge/CardsLanding';
import { CardsBenefits, CardsClosingTitle, CardsHonestNote, CardsRoundExample } from '../components/challenge/CardsStory';
import CardsPreviewDeck from '../components/challenge/CardsPreviewDeck';
import CardGameInvite from '../components/challenge/CardGameInvite';
import { TabBarSpacer } from '../components/navigation/SparrTabBar';
import { useTranslation } from 'react-i18next';

export default function CardsScreen(): React.ReactElement {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { entitlement, loading, error, refetch } = useEntitlement();
  const firstFocus = useRef(true);
  const [checking, setChecking] = useState(false);
  // Coach invite before the paywall; the ref marks a paywall opened from it,
  // so returning with access starts the game right away.
  const [inviteVisible, setInviteVisible] = useState(false);
  const paywallFromInviteRef = useRef(false);
  const [product, setProduct] = useState<PurchasesStoreProduct | null>(null);
  const [introEligibility, setIntroEligibility] = useState<IntroEligibility>('unknown');
  // Released examples only; computed once, the list is static.
  const [previewCards] = useState(previewChallenges);
  // Target of the coach entry ("what's in it for your sparring").
  const scrollRef = useRef<ScrollView>(null);
  const explainY = useRef(0);

  useFocusEffect(useCallback(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    let active = true;
    const fromInvite = paywallFromInviteRef.current;
    paywallFromInviteRef.current = false;
    setChecking(true);
    void refetch()
      .then((fresh) => { if (active && fromInvite && fresh.hasAccess) navigation.navigate('SparringChallenge'); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [refetch, navigation]));

  // Without access the coach explains first; on a failed check the game
  // route's own gate shows the error.
  function startGame(): void {
    if (!error && !entitlement.hasAccess) {
      setInviteVisible(true);
      return;
    }
    navigation.navigate('SparringChallenge');
  }

  function openPaywallFromInvite(): void {
    paywallFromInviteRef.current = true;
    setInviteVisible(false);
    navigation.navigate('Paywall');
  }

  useEffect(() => {
    let active = true;
    async function loadPrice(): Promise<void> {
      try {
        const offerings = await Purchases.getOfferings();
        const source = offerings.current ?? Object.values(offerings.all)[0];
        const premiumPkg = source?.availablePackages.find((pkg) => planForProduct(pkg.product.identifier) === PREMIUM_PLAN);
        if (active) setProduct(premiumPkg !== undefined ? premiumPkg.product : null);
        // Same trial check as the paywall: iOS grants the intro offer once per Apple ID.
        if (premiumPkg !== undefined && Platform.OS === 'ios') {
          try {
            const result = await Purchases.checkTrialOrIntroductoryPriceEligibility([premiumPkg.product.identifier]);
            const status = result[premiumPkg.product.identifier]?.status;
            if (active) {
              setIntroEligibility(
                status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE ? 'eligible'
                  : status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE ? 'ineligible'
                    : 'unknown',
              );
            }
          } catch {
            // Unknown eligibility: keep the normal CTA.
          }
        }
      } catch {
        if (active) setProduct(null);
      }
    }
    void loadPrice();
    return () => { active = false; };
  }, []);

  // Billing period from the store product (ISO 8601); unknown periods show the bare price.
  const price = product === null ? null
    : product.subscriptionPeriod === 'P1M' ? t('challenge.intro.pricePerMonth', { price: product.priceString })
    : product.subscriptionPeriod === 'P1Y' ? t('challenge.landing.pricePerYear', { price: product.priceString })
    : product.priceString;
  // Paywall wording when a free trial is available; otherwise the button keeps its own text.
  const trialOffer = product !== null ? freeTrialOffer(product, Platform.OS, introEligibility) : null;
  const trial = product !== null && trialOffer !== null
    ? paywallCta({ premiumActive: false, price: product.priceString, trial: trialOffer })
    : null;

  function scrollToExplanation(): void {
    scrollRef.current?.scrollTo({ y: Math.max(0, explainY.current - 16), animated: true });
  }

  if (loading || checking) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loading} accessibilityLabel={t('challenge.intro.checkingAccess')}>
          <ActivityIndicator color={colors.accentBlue} />
          <Text style={styles.loadingText}>{t('challenge.intro.checkingAccessEllipsis')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>{t('challenge.intro.accessFailed')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { void refetch(); }} accessibilityRole="button">
            <Text style={styles.retryText}>{t('challenge.intro.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CardsHero />
        <CardsPreviewDeck cards={previewCards} />
        <View style={styles.flow}>
          <CardsSteps />
        </View>
        {/* Both start buttons use one entry; the game route still checks access itself. */}
        <View style={styles.actions}>
          <CardsCta onStart={startGame} needsSubscription={!entitlement.hasAccess} price={price} trial={trial} />
          <CardsHowLink onPress={scrollToExplanation} />
        </View>
        <View style={styles.explain} onLayout={(e) => { explainY.current = e.nativeEvent.layout.y; }}>
          <CardsRoundExample />
          <CardsBenefits />
          <CardsHonestNote />
        </View>
        <View style={styles.closing}>
          <CardsClosingTitle />
          <CardsCta onStart={startGame} needsSubscription={!entitlement.hasAccess} price={price} trial={trial} />
        </View>
        <TabBarSpacer />
      </ScrollView>
      <CardGameInvite visible={inviteVisible} onUnlock={openPaywallFromInvite} onClose={() => setInviteVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  // Tight first screen: title, deck, steps and start button fit above the tab bar
  // on small phones at normal text size; everything else scrolls regularly.
  content: { alignSelf: 'center', width: '100%', maxWidth: 640, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  // The deck stage carries its own room for the tilted backs.
  flow: { marginTop: 8 },
  actions: { marginTop: 16, gap: 8 },
  // Sections are 48 apart, content inside a section at most 16.
  explain: { marginTop: 48, gap: 48 },
  closing: { marginTop: 48, gap: 16 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 15 },
  retryButton: { minHeight: 48, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.accentBlue, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: colors.card, fontFamily: 'Inter_700Bold', fontSize: 15 },
});
