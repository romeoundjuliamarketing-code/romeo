import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Purchases from 'react-native-purchases';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import { useEntitlement } from '../hooks/useEntitlement';
import { previewChallenges } from '../utils/challengeAvailability';
import { planForProduct, PREMIUM_PLAN } from '../utils/subscriptionPlans';
import { CardsBenefitEntry, CardsCta, CardsHero, CardsSteps } from '../components/challenge/CardsLanding';
import { CardsBenefits, CardsClosingTitle, CardsHonestNote, CardsRoundExample, CardsWhy } from '../components/challenge/CardsStory';
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
  const [product, setProduct] = useState<{ price: string; period: string | null } | null>(null);
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
        if (active) setProduct(premiumPkg !== undefined ? { price: premiumPkg.product.priceString, period: premiumPkg.product.subscriptionPeriod } : null);
      } catch {
        if (active) setProduct(null);
      }
    }
    void loadPrice();
    return () => { active = false; };
  }, []);

  // Billing period from the store product (ISO 8601); unknown periods show the bare price.
  const price = product === null ? null
    : product.period === 'P1M' ? t('challenge.intro.pricePerMonth', { price: product.price })
    : product.period === 'P1Y' ? t('challenge.landing.pricePerYear', { price: product.price })
    : product.price;

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
        {/* Without access the benefit comes first, with access the game start. The
            order is fixed once the status is known (loading shows the spinner above).
            Both start buttons use one entry; the game route still checks access itself. */}
        <View style={styles.actions}>
          {entitlement.hasAccess ? (
            <>
              <CardsCta onStart={startGame} needsSubscription={false} price={price} />
              <CardsBenefitEntry onPress={scrollToExplanation} />
            </>
          ) : (
            <>
              <CardsBenefitEntry onPress={scrollToExplanation} />
              <CardsCta onStart={startGame} needsSubscription price={price} />
            </>
          )}
        </View>
        <View style={styles.explain} onLayout={(e) => { explainY.current = e.nativeEvent.layout.y; }}>
          <CardsWhy />
          <CardsSteps />
          <CardsRoundExample />
          <CardsBenefits />
          <CardsHonestNote />
        </View>
        <View style={styles.closing}>
          <CardsClosingTitle />
          <CardsCta onStart={startGame} needsSubscription={!entitlement.hasAccess} price={price} />
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
  // Tight first screen: deck, benefit entry and start button fit above the tab bar
  // on common phones at normal text size; everything else scrolls regularly.
  content: { alignSelf: 'center', width: '100%', maxWidth: 640, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  // The deck stage carries its own room for the tilted backs, so header, deck
  // and switch row follow without extra gaps.
  actions: { marginTop: 16, gap: 16 },
  // Explanation follows the actions with a clear break; sections read like a short article.
  explain: { marginTop: 48, gap: 48 },
  closing: { marginTop: 48, gap: 24 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 15 },
  retryButton: { minHeight: 48, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.accentBlue, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: colors.card, fontFamily: 'Inter_700Bold', fontSize: 15 },
});
