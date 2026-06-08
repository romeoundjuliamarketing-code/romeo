import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;
type BillingCycle = 'monthly' | 'yearly';

type PlanKey = 'individual' | 'studio';

// Primary product ID lookup — must match App Store Connect product identifiers exactly.
// If these differ in RC, the fuzzy-fallback below picks up the right package anyway.
const PACKAGE_IDS: Record<PlanKey, Record<BillingCycle, string>> = {
  individual: {
    monthly: 'sparr_individual_monthly',
    yearly: 'sparr_individual_yearly',
  },
  studio: {
    monthly: 'sparr_studio_monthly',
    yearly: 'sparr_studio_yearly',
  },
};

// Fuzzy-fallback: find a package by matching plan + cycle keywords in
// both the RC package identifier and the App Store product identifier.
function findPackageFuzzy(
  pkgs: Partial<Record<string, PurchasesPackage>>,
  plan: PlanKey,
  cycle: BillingCycle
): PurchasesPackage | undefined {
  const cycleKw = cycle === 'monthly' ? 'month' : 'year';
  for (const pkg of Object.values(pkgs)) {
    if (pkg === undefined) continue;
    const prodId = pkg.product.identifier.toLowerCase();
    const rcId = pkg.identifier.toLowerCase();
    const matchesPlan = prodId.includes(plan) || rcId.includes(plan);
    const matchesCycle = prodId.includes(cycleKw) || rcId.includes(cycleKw);
    if (matchesPlan && matchesCycle) return pkg;
  }
  return undefined;
}

// Returns true when the package has a free-trial introductory offer (price === 0).
function hasFreeTrial(pkg: PurchasesPackage | undefined): boolean {
  if (pkg === undefined) return false;
  return pkg.product.introPrice !== null && pkg.product.introPrice?.price === 0;
}

type PlanCardProps = {
  title: string;
  subtitle: string;
  price: string;
  details: string[];
  loading?: boolean;
  highlighted?: boolean;
  hasTrialOffer?: boolean;
  onPress: () => void;
};

function PlanCard({
  title,
  subtitle,
  price,
  details,
  loading = false,
  highlighted = false,
  hasTrialOffer = false,
  onPress,
}: PlanCardProps): React.ReactElement {
  return (
    <View style={[styles.planCard, highlighted && styles.planCardHighlighted]}>
      <Text style={styles.planTitle}>{title}</Text>
      <Text style={styles.planSubtitle}>{subtitle}</Text>
      <Text style={styles.planPrice}>{hasTrialOffer ? 'Kostenlos' : price}</Text>

      <View style={styles.detailList}>
        {details.map((item) => (
          <View key={item} style={styles.detailRow}>
            <MaterialCommunityIcons name="check-circle-outline" size={16} color={colors.accentBlue} />
            <Text style={styles.detailText}>{item}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.planButton, highlighted && styles.planButtonHighlighted]}
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator size="small" color={highlighted ? colors.card : colors.accentBlue} />
        ) : (
          <Text style={[styles.planButtonLabel, highlighted && styles.planButtonLabelHighlighted]}>
            {hasTrialOffer ? 'Kostenlos starten' : 'Abo auswählen'}
          </Text>
        )}
      </TouchableOpacity>

      {hasTrialOffer && (
        <Text style={styles.trialNote}>Danach {price} — jederzeit kündbar.</Text>
      )}
    </View>
  );
}

function priceLabel(pkg: PurchasesPackage | undefined, billingCycle: BillingCycle): string {
  if (pkg === undefined) return billingCycle === 'monthly' ? '–– / Monat' : '–– / Jahr';
  const priceString = pkg.product.priceString;
  return billingCycle === 'monthly' ? `${priceString} / Monat` : `${priceString} / Jahr`;
}

export default function PaywallScreen({ navigation }: Props): React.ReactElement {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [packages, setPackages] = useState<Partial<Record<string, PurchasesPackage>>>({});
  const [pendingPlan, setPendingPlan] = useState<PlanKey | null>(null);
  const [offeringsLoading, setOfferingsLoading] = useState(true);

  useEffect(() => {
    async function loadOfferings(): Promise<void> {
      try {
        const offerings = await Purchases.getOfferings();
        const current = offerings.current;

        // Debug: log all available offerings and packages
        console.log('[Paywall] offerings.current:', current?.identifier ?? 'null');
        const allKeys = Object.keys(offerings.all);
        console.log('[Paywall] offerings.all keys:', allKeys);

        // Use current offering first; fall back to any available offering
        const source = current ?? (allKeys.length > 0 ? offerings.all[allKeys[0]] : null);
        if (source === null || source === undefined) {
          console.log('[Paywall] No offerings available at all.');
          Alert.alert(
            'RC Debug: keine Offerings',
            `offerings.current: ${current?.identifier ?? 'null'}\nofferings.all keys: [${allKeys.join(', ')}]\n\nIn RevenueCat Dashboard ein "current" Offering anlegen und Pakete verknüpfen.`,
          );
          return;
        }

        const map: Partial<Record<string, PurchasesPackage>> = {};
        for (const pkg of source.availablePackages) {
          console.log('[Paywall] package id:', pkg.identifier, '| product id:', pkg.product.identifier);
          // Map by both App Store product ID and RC package identifier for maximum compatibility
          map[pkg.product.identifier] = pkg;
          map[pkg.identifier] = pkg;
        }

        if (Object.keys(map).length === 0) {
          const allIds = source.availablePackages.map((p) => `rc=${p.identifier} / store=${p.product.identifier}`).join('\n');
          console.log('[Paywall] No packages found. Raw list:\n' + allIds);
          Alert.alert(
            'RC Debug: keine Pakete',
            `Offering "${source.identifier}" hat ${source.availablePackages.length} Pakete.\n\n${allIds || 'Leer'}`,
          );
        }

        setPackages(map);
      } catch (err) {
        console.log('[Paywall] loadOfferings error:', err);
        // offerings unavailable (e.g. simulator without StoreKit config)
      } finally {
        setOfferingsLoading(false);
      }
    }
    void loadOfferings();
  }, []);

  async function handlePlanSelect(plan: PlanKey): Promise<void> {
    const pkgId = PACKAGE_IDS[plan][billingCycle];
    // Try exact match first, then fuzzy fallback
    const pkg = packages[pkgId] ?? findPackageFuzzy(packages, plan, billingCycle);

    if (pkg === undefined) {
      const available = Object.keys(packages).join(', ') || 'keine';
      Alert.alert('Fehler', `Paket nicht gefunden.\n\nVerfügbar: ${available}`);
      return;
    }

    setPendingPlan(plan);
    try {
      await Purchases.purchasePackage(pkg);
      navigation.goBack();
    } catch (err: unknown) {
      const isCancelled =
        typeof err === 'object' &&
        err !== null &&
        'userCancelled' in err &&
        (err as { userCancelled: boolean }).userCancelled;
      if (!isCancelled) {
        const message = err instanceof Error ? err.message : 'Kauf fehlgeschlagen.';
        Alert.alert('Fehler', message);
      }
    } finally {
      setPendingPlan(null);
    }
  }

  const indPkg = packages[PACKAGE_IDS.individual[billingCycle]] ?? findPackageFuzzy(packages, 'individual', billingCycle);
  const studioPkg = packages[PACKAGE_IDS.studio[billingCycle]] ?? findPackageFuzzy(packages, 'studio', billingCycle);
  // Trial is available when at least one package carries a free introductory offer.
  const trialAvailable = hasFreeTrial(indPkg) || hasFreeTrial(studioPkg);

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
        <Text style={styles.title}>
          {trialAvailable ? '7 Tage kostenlos testen' : 'Alle Premium-Funktionen freischalten'}
        </Text>
        <Text style={styles.subtitle}>
          {trialAvailable
            ? 'Starte heute gratis. Kein Risiko — jederzeit kündbar.'
            : 'Punkte, Stats und Team-Ranking sind im Abo enthalten.'}
        </Text>

        <View style={styles.cycleCard}>
          <Text style={styles.cycleTitle}>Abrechnungszeitraum</Text>
          <View style={styles.cycleRow}>
            <TouchableOpacity
              style={[styles.cycleChip, billingCycle === 'monthly' && styles.cycleChipActive]}
              onPress={() => setBillingCycle('monthly')}
              activeOpacity={0.8}
            >
              <Text style={[styles.cycleChipLabel, billingCycle === 'monthly' && styles.cycleChipLabelActive]}>
                Monatlich
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cycleChip, billingCycle === 'yearly' && styles.cycleChipActive]}
              onPress={() => setBillingCycle('yearly')}
              activeOpacity={0.8}
            >
              <Text style={[styles.cycleChipLabel, billingCycle === 'yearly' && styles.cycleChipLabelActive]}>
                Jährlich
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {offeringsLoading ? (
          <ActivityIndicator style={styles.loadingIndicator} color={colors.accentBlue} />
        ) : (
          <>
            <PlanCard
              title="Einzel"
              subtitle="Für eine Person"
              price={priceLabel(indPkg, billingCycle)}
              details={[
                'Voller Zugriff auf Punkte und Stats',
                'Ranking und Auswertungen',
                'Monatlich kündbar',
              ]}
              loading={pendingPlan === 'individual'}
              hasTrialOffer={hasFreeTrial(indPkg)}
              onPress={() => { void handlePlanSelect('individual'); }}
            />

            <PlanCard
              title="Studio"
              subtitle="Für Trainer und Teams"
              price={priceLabel(studioPkg, billingCycle)}
              details={[
                'Gleiche Funktionen wie Einzel',
                '1 Betreiber + 8 Schüler inklusive',
                'Mitglieder einladen und Plätze verwalten',
              ]}
              highlighted
              loading={pendingPlan === 'studio'}
              hasTrialOffer={hasFreeTrial(studioPkg)}
              onPress={() => { void handlePlanSelect('studio'); }}
            />
          </>
        )}

        <Text style={styles.legalNote}>
          {trialAvailable
            ? 'Der Testzeitraum startet sofort und endet nach 7 Tagen. Danach verlängert sich das Abo automatisch zum angegebenen Preis, sofern es nicht mindestens 24 Stunden vor Ende gekündigt wird. Die Kündigung erfolgt über Einstellungen → Apple ID → Abonnements.'
            : 'Das Abo verlängert sich automatisch zum angegebenen Preis, sofern es nicht mindestens 24 Stunden vor Ende der aktuellen Laufzeit gekündigt wird. Die Kündigung erfolgt über Einstellungen → Apple ID → Abonnements.'}
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
  cycleCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  cycleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inactive,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cycleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cycleChip: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  cycleChipActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  cycleChipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  cycleChipLabelActive: {
    color: colors.headerTextPrimary,
  },
  loadingIndicator: {
    marginTop: 32,
  },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  planCardHighlighted: {
    borderColor: colors.accentBlue,
    borderWidth: 2,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  planSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.inactive,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginTop: 8,
    marginBottom: 8,
  },
  detailList: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  planButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  planButtonHighlighted: {
    backgroundColor: colors.accentBlue,
  },
  planButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  planButtonLabelHighlighted: {
    color: colors.card,
  },
  trialNote: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.inactive,
    textAlign: 'center',
    marginTop: 4,
  },
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
