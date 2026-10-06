import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
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
import {
  activePlan, bundleSavings, defaultSelection, formatSavings, orderPlans, planForProduct, planSwitchNotice, replacedProductId,
  type PlanKey,
} from '../utils/subscriptionPlans';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

export default function PaywallScreen({ navigation, route }: Props): React.ReactElement {
  const focus = route.params?.focus;
  const { t } = useTranslation();
  const { user } = useAuth();
  const { entitlements, refetch } = useStoreEntitlements();
  const [packages, setPackages] = useState<Partial<Record<PlanKey, PurchasesPackage>>>({});
  const [pendingPlan, setPendingPlan] = useState<PlanKey | null>(null);
  const [offeringsLoading, setOfferingsLoading] = useState(true);
  const [picked, setPicked] = useState<PlanKey | null>(null);

  useEffect(() => {
    let active = true;
    async function loadOfferings(): Promise<void> {
      try {
        const offerings = await Purchases.getOfferings();
        const source = offerings.current ?? Object.values(offerings.all)[0];
        const map: Partial<Record<PlanKey, PurchasesPackage>> = {};
        for (const pkg of source?.availablePackages ?? []) {
          const plan = planForProduct(pkg.product.identifier);
          if (plan !== null && map[plan] === undefined) map[plan] = pkg;
        }
        if (active) setPackages(map);
      } catch {
        // Offerings unavailable (e.g. simulator without StoreKit config): cards show "not available".
      } finally {
        if (active) setOfferingsLoading(false);
      }
    }
    void loadOfferings();
    return () => { active = false; };
  }, []);

  function handlePurchase(plan: PlanKey): void {
    const notice = planSwitchNotice(activePlan(entitlements.creatorActive, entitlements.cardsActive), plan);
    if (notice === null) {
      void buy(plan);
      return;
    }
    Alert.alert(t('paywall.switchTitle'), notice, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('paywall.switchConfirm'), onPress: () => { void buy(plan); } },
    ]);
  }

  async function buy(plan: PlanKey): Promise<void> {
    const pkg = packages[plan];
    if (pkg === undefined || user === null) return;
    setPendingPlan(plan);
    try {
      // Never buy anonymously: the webhook could not attach it to this account.
      await loginRevenueCat(user.id);
      // Play has no subscription groups: name the plan being replaced (without base plan).
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
      setPendingPlan(null);
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
  const order = orderPlans(focus);
  // Entitlements may load after the user picked: never keep the now-active plan selected.
  const selected = picked !== null && picked !== current
    ? picked
    : defaultSelection(order, (plan) => packages[plan] !== undefined, current);
  const selectedPkg = selected !== null ? packages[selected] : undefined;
  const ctaLabel = current === 'bundle'
    ? t('paywall.cta.active')
    : selectedPkg !== undefined ? t('paywall.cta.continue', { price: selectedPkg.product.priceString }) : t('paywall.cta.unavailable');
  const saving = bundleSavings(
    packages.creator?.product.price ?? null,
    packages.cards?.product.price ?? null,
    packages.bundle?.product.price ?? null,
  );
  const bundleBadge = saving !== null && packages.bundle !== undefined
    ? t('paywall.savings', { amount: formatSavings(saving, packages.bundle.product.currencyCode) })
    : undefined;

  return (
    <View style={styles.root}>
      <FocusedStatusBar style="light" />
      <ScrollView style={styles.scroll} bounces={false} showsVerticalScrollIndicator={false}>
        <PaywallHero plan={selected ?? 'bundle'} onClose={() => navigation.goBack()} />
        <View style={styles.plans}>
          {offeringsLoading ? (
            <ActivityIndicator style={styles.loadingIndicator} color={colors.accentBlue} />
          ) : (
            order.map((plan) => (
              <PlanOption
                key={plan}
                title={t(`paywall.plans.${plan}.title`)}
                subtitle={t(`paywall.plans.${plan}.subtitle`)}
                price={packages[plan]?.product.priceString}
                badge={plan === 'bundle' ? bundleBadge : undefined}
                selected={selected === plan}
                active={current === plan}
                onPress={() => setPicked(plan)}
              />
            ))
          )}
        </View>
      </ScrollView>
      <PaywallFooter
        label={ctaLabel}
        enabled={!offeringsLoading && selectedPkg !== undefined}
        loading={pendingPlan !== null}
        onPurchase={() => { if (selected !== null) handlePurchase(selected); }}
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
