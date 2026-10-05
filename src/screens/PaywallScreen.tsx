import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import PlanCard from '../components/paywall/PlanCard';
import { useStoreEntitlements } from '../hooks/useStoreEntitlements';
import { useAuth } from '../context/AuthContext';
import { loginRevenueCat } from '../lib/revenuecat';
import {
  activePlan, bundleSavings, formatSavings, orderPlans, planForProduct, planSwitchNotice, replacedProductId,
  RC_ENTITLEMENT_CARDS, RC_ENTITLEMENT_CREATOR, type PlanKey,
} from '../utils/subscriptionPlans';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

const PLAN_COPY: Record<PlanKey, { title: string; subtitle: string; details: string[] }> = {
  creator: {
    title: 'Ersteller',
    subtitle: 'Eigene Sparrings erstellen',
    details: ['Sparrings anlegen und auf der Karte zeigen', 'Beitreten bleibt für alle kostenlos'],
  },
  cards: {
    title: 'Karten',
    subtitle: 'Kartenspiel für Kickboxen / K1',
    details: ['Alle verfügbaren Karten für Kickboxen / K1', 'Karten ziehen und im Sparring umsetzen'],
  },
  bundle: {
    title: 'Ersteller + Karten',
    subtitle: 'Beides in einem Abo',
    details: ['Sparrings erstellen', 'Komplettes Kartenspiel'],
  },
};

function priceLabel(pkg: PurchasesPackage | undefined): string {
  return pkg === undefined ? 'Preis derzeit nicht verfügbar' : `${pkg.product.priceString} / Monat`;
}

export default function PaywallScreen({ navigation, route }: Props): React.ReactElement {
  const focus = route.params?.focus;
  const { user } = useAuth();
  const { entitlements, refetch } = useStoreEntitlements();
  const [packages, setPackages] = useState<Partial<Record<PlanKey, PurchasesPackage>>>({});
  const [pendingPlan, setPendingPlan] = useState<PlanKey | null>(null);
  const [offeringsLoading, setOfferingsLoading] = useState(true);

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
    Alert.alert('Abo wechseln?', notice, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Wechseln', onPress: () => { void buy(plan); } },
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
        Alert.alert('Kauf fehlgeschlagen', err instanceof Error ? err.message : 'Bitte versuche es erneut.');
      }
    } finally {
      setPendingPlan(null);
    }
  }

  async function handleRestorePurchases(): Promise<void> {
    try {
      const info = await Purchases.restorePurchases();
      const restored =
        info.entitlements.active[RC_ENTITLEMENT_CARDS] !== undefined ||
        info.entitlements.active[RC_ENTITLEMENT_CREATOR] !== undefined;
      if (restored) {
        await refetch();
        Alert.alert('Käufe wiederhergestellt', 'Dein Zugang ist wieder aktiv.');
        navigation.goBack();
      } else {
        Alert.alert('Keine Käufe gefunden', 'Für dieses Konto wurde kein aktives Abo gefunden.');
      }
    } catch (error: unknown) {
      Alert.alert('Wiederherstellung fehlgeschlagen', error instanceof Error ? error.message : 'Bitte versuche es erneut.');
    }
  }

  const current = activePlan(entitlements.creatorActive, entitlements.cardsActive);
  const saving = bundleSavings(
    packages.creator?.product.price ?? null,
    packages.cards?.product.price ?? null,
    packages.bundle?.product.price ?? null,
  );
  const bundleBadge = saving !== null && packages.bundle !== undefined
    ? `Beides – du sparst ${formatSavings(saving, packages.bundle.product.currencyCode)}`
    : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Abo</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
        <Text style={styles.title}>Wähle dein Abo</Text>
        <Text style={styles.subtitle}>Beitreten ist kostenlos. Mit einem Abo erstellst du eigene Sparrings, spielst das Kartenspiel – oder beides.</Text>

        {offeringsLoading ? (
          <ActivityIndicator style={styles.loadingIndicator} color={colors.accentBlue} />
        ) : (
          orderPlans(focus).map((plan) => (
            <PlanCard
              key={plan}
              title={PLAN_COPY[plan].title}
              subtitle={PLAN_COPY[plan].subtitle}
              price={priceLabel(packages[plan])}
              details={PLAN_COPY[plan].details}
              badge={plan === 'bundle' ? bundleBadge : undefined}
              active={current === plan}
              available={packages[plan] !== undefined}
              highlighted={plan === 'bundle'}
              loading={pendingPlan === plan}
              onPress={() => handlePurchase(plan)}
            />
          ))
        )}

        <TouchableOpacity style={styles.restoreButton} onPress={() => { void handleRestorePurchases(); }} accessibilityRole="button">
          <Text style={styles.restoreText}>Käufe wiederherstellen</Text>
        </TouchableOpacity>

        <Text style={styles.legalNote}>
          Das Abo verlängert sich automatisch zum angezeigten Preis und Zeitraum, sofern es nicht rechtzeitig über die Abo-Einstellungen deines App-Stores gekündigt wird.
        </Text>

        <View style={styles.legalLinks}>
          <TouchableOpacity
            onPress={() => { void Linking.openURL('https://www.notion.so/Datenschutzerkl-rung-Sparr-34f1f56f1531804ebd59ec7351220d82?source=copy_link'); }}
            activeOpacity={0.7}
          >
            <Text style={styles.legalLink}>Datenschutzerklärung</Text>
          </TouchableOpacity>
          <Text style={styles.legalLinkSeparator}> · </Text>
          <TouchableOpacity
            onPress={() => { void Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'); }}
            activeOpacity={0.7}
          >
            <Text style={styles.legalLink}>Nutzungsbedingungen</Text>
          </TouchableOpacity>
        </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.inactive,
    lineHeight: 20,
  },
  loadingIndicator: {
    marginTop: 32,
  },
  restoreButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  restoreText: { color: colors.accentBlueText, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  legalNote: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
    lineHeight: 18,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 16,
  },
  legalLink: {
    fontSize: 12,
    color: colors.accentBlue,
  },
  legalLinkSeparator: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
