import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { formatPrice, billingIntervalLabel } from '../../utils/formatPrice';
import MembershipContractSheet from './MembershipContractSheet';
import type { MembershipPlan, MembershipContractWithStudio } from '../../types/database.types';

interface Props {
  studioId:         string;
  plans:            MembershipPlan[];
  loading:          boolean;
  activeContract:   MembershipContractWithStudio | null;
  onContractSigned: () => void;
}

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  pending:                'Ausstehend',
  active:                 'Aktiv',
  cancellation_requested: 'Kündigung läuft',
  ended:                  'Beendet',
  declined:               'Abgelehnt',
};

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  pending:                colors.accentBlue,
  active:                 colors.difficultyGreen,
  cancellation_requested: colors.sparringsOrange,
  ended:                  colors.textSecondary,
  declined:               colors.deleteRed,
};

// Displays the studio's active membership plans and handles contract sign-up.
// Shown inside StudioDetailScreen; extracted to keep the screen under 150 lines.
export default function MembershipPlansList({
  plans,
  loading,
  activeContract,
  onContractSigned,
}: Props): React.ReactElement {
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  function handlePlanPress(plan: MembershipPlan): void {
    if (activeContract !== null) return;
    setSelectedPlan(plan);
    setSheetVisible(true);
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Mitgliedschaften</Text>

      {loading ? (
        <ActivityIndicator color={colors.accentBlue} style={styles.loader} />
      ) : plans.length === 0 ? (
        <Text style={styles.emptyText}>Keine Mitgliedschafts-Tarife verfügbar.</Text>
      ) : (
        <>
          {/* If user already has an active/pending contract, show status banner */}
          {activeContract !== null && (
            <View style={styles.contractStatusBanner}>
              <Ionicons name="checkmark-circle" size={18} color={CONTRACT_STATUS_COLORS[activeContract.status] ?? colors.textSecondary} />
              <View style={styles.contractStatusTextBlock}>
                <Text style={styles.contractStatusPlanName}>{activeContract.plan_name_snapshot}</Text>
                <Text style={[
                  styles.contractStatusValue,
                  { color: CONTRACT_STATUS_COLORS[activeContract.status] ?? colors.textSecondary },
                ]}>
                  {CONTRACT_STATUS_LABELS[activeContract.status] ?? activeContract.status}
                </Text>
              </View>
            </View>
          )}

          {plans.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={[styles.planRow, activeContract !== null && styles.planRowDisabled]}
              onPress={() => handlePlanPress(plan)}
              activeOpacity={activeContract !== null ? 1 : 0.8}
            >
              <View style={styles.planInfo}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planPrice}>
                  {formatPrice(plan.price_cents)}
                  {' '}
                  <Text style={styles.planInterval}>/ {billingIntervalLabel(plan.billing_interval)}</Text>
                </Text>
                {plan.min_term_months > 0 && (
                  <Text style={styles.planMeta}>
                    Mindestlaufzeit: {plan.min_term_months} {plan.min_term_months === 1 ? 'Monat' : 'Monate'}
                  </Text>
                )}
                {plan.description !== null && plan.description.length > 0 && (
                  <Text style={styles.planDescription} numberOfLines={2}>{plan.description}</Text>
                )}
              </View>
              {activeContract === null && (
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          ))}
        </>
      )}

      <MembershipContractSheet
        visible={sheetVisible}
        plan={selectedPlan}
        onClose={() => setSheetVisible(false)}
        onSigned={() => {
          setSheetVisible(false);
          onContractSigned();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  loader: {
    marginVertical: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  contractStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  contractStatusTextBlock: {
    flex: 1,
    gap: 2,
  },
  contractStatusPlanName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  contractStatusValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: 12,
  },
  planRowDisabled: {
    opacity: 0.55,
  },
  planInfo: {
    flex: 1,
    gap: 2,
  },
  planName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  planPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accentBlue,
    marginTop: 2,
  },
  planInterval: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  planMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  planDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: 4,
  },
});
