import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

type PlanCardProps = {
  title: string;
  subtitle: string;
  price: string;
  details: string[];
  loading?: boolean;
  highlighted?: boolean;
  onPress: () => void;
};

function PlanCard({
  title,
  subtitle,
  price,
  details,
  loading = false,
  highlighted = false,
  onPress,
}: PlanCardProps): React.ReactElement {
  return (
    <View style={[styles.planCard, highlighted && styles.planCardHighlighted]}>
      <Text style={styles.planTitle}>{title}</Text>
      <Text style={styles.planSubtitle}>{subtitle}</Text>
      <Text style={styles.planPrice}>{price}</Text>

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
            Abo auswählen
          </Text>
        )}
      </TouchableOpacity>
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
        if (current === null) return;
        const map: Partial<Record<string, PurchasesPackage>> = {};
        for (const pkg of current.availablePackages) {
          map[pkg.identifier] = pkg;
        }
        setPackages(map);
      } catch {
        // offerings unavailable (e.g. simulator without StoreKit config)
      } finally {
        setOfferingsLoading(false);
      }
    }
    void loadOfferings();
  }, []);

  async function handlePlanSelect(plan: PlanKey): Promise<void> {
    const pkgId = PACKAGE_IDS[plan][billingCycle];
    const pkg = packages[pkgId];

    if (pkg === undefined) {
      Alert.alert('Fehler', 'Dieses Abo-Paket ist derzeit nicht verfügbar.');
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

  const indPkg = packages[PACKAGE_IDS.individual[billingCycle]];
  const studioPkg = packages[PACKAGE_IDS.studio[billingCycle]];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Abo</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Alle Premium-Funktionen freischalten</Text>
        <Text style={styles.subtitle}>
          Punkte, Stats und Team-Ranking sind im Abo enthalten.
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
              onPress={() => { void handlePlanSelect('studio'); }}
            />
          </>
        )}

        <Text style={styles.legalNote}>
          Das Abo verlängert sich automatisch zum angegebenen Preis, sofern es nicht mindestens 24 Stunden vor Ende der aktuellen Laufzeit gekündigt wird. Die Kündigung erfolgt über Einstellungen → Apple ID → Abonnements.
        </Text>
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
  legalNote: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
    lineHeight: 18,
  },
});
