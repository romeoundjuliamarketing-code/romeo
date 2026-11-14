import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Purchases, { INTRO_ELIGIBILITY_STATUS, PurchasesPackage } from 'react-native-purchases';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import FocusedStatusBar from '../components/common/FocusedStatusBar';
import PaywallFooter from '../components/paywall/PaywallFooter';
import PaywallHero from '../components/paywall/PaywallHero';
import PlanOption from '../components/paywall/PlanOption';
import { useStoreEntitlements } from '../hooks/useStoreEntitlements';
import { useAuth } from '../context/AuthContext';
import { loginRevenueCat } from '../lib/revenuecat';
import { restorePurchases } from '../lib/restorePurchases';
import { useTranslation } from 'react-i18next';
import { activePlan, planForProduct, PREMIUM_PLAN, replacedProductId } from '../utils/subscriptionPlans';
import { freeTrialOffer, IntroEligibility, paywallCta } from '../utils/paywallTrial';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

export default function PaywallScreen({ navigation }: Props): React.ReactElement {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { entitlements, refetch } = useStoreEntitlements();
  const [premiumPkg, setPremiumPkg] = useState<PurchasesPackage | undefined>(undefined);
  const [purchasing, setPurchasing] = useState(false);
  const [offeringsLoading, setOfferingsLoading] = useState(true);
  const [introEligibility, setIntroEligibility] = useState<IntroEligibility>('unknown');

  useEffect(() => {
    let active = true;
    async function loadOfferings(): Promise<void> {
      try {
        const offerings = await Purchases.getOfferings();
        const source = offerings.current ?? Object.values(offerings.all)[0];
        // Legacy single plans may still sit in the offering: only Premium is sold.
        const pkg = (source?.availablePackages ?? []).find((p) => planForProduct(p.product.identifier) === PREMIUM_PLAN);
        if (active) setPremiumPkg(pkg);
        // iOS grants the intro offer once per Apple ID; Android filters offers itself.
        if (pkg !== undefined && Platform.OS === 'ios') {
          try {
            const result = await Purchases.checkTrialOrIntroductoryPriceEligibility([pkg.product.identifier]);
            const status = result[pkg.product.identifier]?.status;
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
        // Offerings unavailable (e.g. simulator without StoreKit config): cards show "not available".
      } finally {
        if (active) setOfferingsLoading(false);
      }
    }
    void loadOfferings();
    return () => { active = false; };
  }, []);

  async function buy(): Promise<void> {
    const pkg = premiumPkg;
    if (pkg === undefined || user === null) return;
    setPurchasing(true);
    try {
      // Never buy anonymously: the webhook could not attach it to this account.
      await loginRevenueCat(user.id);
      // Play has no subscription groups: name the legacy plan being upgraded (without base plan).
      const info = Platform.OS === 'android' ? await Purchases.getCustomerInfo() : null;
      const oldProduct = info !== null ? replacedProductId(info.activeSubscriptions) : null;
      await Purchases.purchasePackage(
        pkg,
        null,
        oldProduct !== null ? { oldProductIdentifier: oldProduct.split(':')[0] } : null,
      );
      await refetch();
      navigation.goBack();
    } catch (err: unknown) {
      const isCancelled =
        typeof err === 'object' && err !== null && 'userCancelled' in err &&
        (err as { userCancelled: boolean }).userCancelled;
      if (!isCancelled) {
        Alert.alert(t('paywall.purchaseFailed'), err instanceof Error ? err.message : t('paywall.tryAgain'));
      }
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestorePurchases(): Promise<void> {
    try {
      if (await restorePurchases() === 'restored') {
        await refetch();
        Alert.alert(t('paywall.restore.successTitle'), t('paywall.restore.successMessage'));
        navigation.goBack();
      } else {
        Alert.alert(t('paywall.restore.noneTitle'), t('paywall.restore.noneMessage'));
      }
    } catch (error: unknown) {
      Alert.alert(t('paywall.restore.failedTitle'), error instanceof Error ? error.message : t('paywall.tryAgain'));
    }
  }

  const current = activePlan(entitlements.creatorActive, entitlements.cardsActive);
  const premiumActive = current === PREMIUM_PLAN;
  const trial = premiumPkg !== undefined ? freeTrialOffer(premiumPkg.product, Platform.OS, introEligibility) : null;
  const cta = paywallCta({ premiumActive, price: premiumPkg?.product.priceString, trial });

  return (
    <View style={styles.root}>
      <FocusedStatusBar style="light" />
      <ScrollView style={styles.scroll} bounces={false} showsVerticalScrollIndicator={false}>
        <PaywallHero onClose={() => navigation.goBack()} />
        <View style={styles.plans}>
          {offeringsLoading ? (
            <ActivityIndicator style={styles.loadingIndicator} color={colors.gold} />
          ) : (
            <PlanOption
              title={t('paywall.premium.title')}
              subtitle={t('paywall.premium.subtitle')}
              price={premiumPkg?.product.priceString}
              selected={!premiumActive && premiumPkg !== undefined}
              active={premiumActive}
              onPress={() => undefined}
            />
          )}
        </View>
      </ScrollView>
      <PaywallFooter
        label={cta.label}
        note={cta.note}
        enabled={!offeringsLoading && !premiumActive && premiumPkg !== undefined}
        loading={purchasing}
        onPurchase={() => { void buy(); }}
        onRestore={() => { void handleRestorePurchases(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  plans: {
    padding: 16,
    gap: 8,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  loadingIndicator: {
    marginVertical: 32,
  },
});
