import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Purchases from 'react-native-purchases';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import { useEntitlement } from '../hooks/useEntitlement';
import { freePreviewChallenge, previewChallenges } from '../utils/challengeAvailability';
import { planForProduct } from '../utils/subscriptionPlans';
import { CardsBenefits, CardsHero, CardsOffer, CardsStart } from '../components/challenge/CardsLanding';
import CardsShowcase from '../components/challenge/CardsShowcase';
import CardsIntro from '../components/challenge/CardsIntro';
import CardGameInvite from '../components/challenge/CardGameInvite';
import { useCardsIntroSeen } from '../hooks/useCardsIntroSeen';
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
  const [price, setPrice] = useState<string | null>(null);
  const [offerLoading, setOfferLoading] = useState(true);
  const exampleCard = freePreviewChallenge();
  // Released examples only; computed once, the list is static.
  const [showcaseCards] = useState(previewChallenges);
  // The one place that decides about the intro: home teaser and tab both land here.
  // It covers this screen instead of being a route, so leaving it cannot loop.
  const { seen: introSeen, markSeen } = useCardsIntroSeen();
  const [introReopened, setIntroReopened] = useState(false);

  // Android back closes an intro that was opened on purpose, like its own button.
  useFocusEffect(useCallback(() => {
    if (!introReopened) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setIntroReopened(false);
      return true;
    });
    return () => sub.remove();
  }, [introReopened]));

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
    navigation.navigate('Paywall', { focus: 'cards' });
  }

  useEffect(() => {
    let active = true;
    async function loadPrice(): Promise<void> {
      try {
        const offerings = await Purchases.getOfferings();
        const source = offerings.current ?? Object.values(offerings.all)[0];
        const cardsPkg = source?.availablePackages.find((pkg) => planForProduct(pkg.product.identifier) === 'cards');
        if (active) setPrice(cardsPkg !== undefined ? cardsPkg.product.priceString : null);
      } catch {
        if (active) setPrice(null);
      } finally {
        if (active) setOfferLoading(false);
      }
    }
    void loadPrice();
    return () => { active = false; };
  }, []);

  if (loading || checking || introSeen === null) {
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
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CardsHero />
        <CardsShowcase cards={showcaseCards} />
        {/* The game route still checks access itself (deep links, failed checks). */}
        <CardsStart
          onStart={startGame}
          onHowItWorks={() => setIntroReopened(true)}
        />
        {entitlement.hasAccess ? null : (
          <>
            <CardsBenefits />
            <CardsOffer price={price !== null ? t('challenge.intro.pricePerMonth', { price }) : null} loading={offerLoading} onOpen={() => navigation.navigate('Paywall', { focus: 'cards' })} />
          </>
        )}
        <TabBarSpacer />
      </ScrollView>
      {!introSeen || introReopened ? (
        // Laid over the cards area, which stays mounted — closing returns to the exact
        // scroll position it was opened from.
        <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
          {introReopened ? (
            <CardsIntro card={exampleCard} primaryLabel={t('challenge.intro.backToGame')} onPrimary={() => setIntroReopened(false)} />
          ) : (
            <CardsIntro card={exampleCard} primaryLabel={t('challenge.intro.letsGo')} onPrimary={markSeen} onSkip={markSeen} />
          )}
        </View>
      ) : null}
      <CardGameInvite visible={inviteVisible} onUnlock={openPaywallFromInvite} onClose={() => setInviteVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { alignSelf: 'center', width: '100%', maxWidth: 640, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48, gap: 32 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 15 },
  retryButton: { minHeight: 48, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.accentBlue, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: colors.card, fontFamily: 'Inter_700Bold', fontSize: 15 },
});
