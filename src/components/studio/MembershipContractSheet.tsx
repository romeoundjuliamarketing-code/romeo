import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useMembershipActions } from '../../hooks/useMembershipActions';
import { formatPrice, billingIntervalLabel } from '../../utils/formatPrice';
import type { MembershipPlan } from '../../types/database.types';

interface Props {
  visible:  boolean;
  plan:     MembershipPlan | null;
  onClose:  () => void;
  onSigned: () => void;
}

export default function MembershipContractSheet({
  visible,
  plan,
  onClose,
  onSigned,
}: Props): React.ReactElement {
  const { signMembership } = useMembershipActions();
  const [loading, setLoading] = useState(false);

  async function handleConfirm(): Promise<void> {
    if (plan === null) return;
    setLoading(true);
    const { error } = await signMembership(plan.id);
    setLoading(false);
    if (error !== null) {
      Alert.alert('Fehler', error);
      return;
    }
    onSigned();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <Text style={styles.heading}>Mitgliedschaft abschliessen</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {plan !== null && (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Plan summary */}
            <View style={styles.planCard}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planPrice}>
                {formatPrice(plan.price_cents)}
                {'  '}
                <Text style={styles.planInterval}>/ {billingIntervalLabel(plan.billing_interval)}</Text>
              </Text>
              {plan.min_term_months > 0 && (
                <Text style={styles.planMeta}>
                  Mindestlaufzeit: {plan.min_term_months} {plan.min_term_months === 1 ? 'Monat' : 'Monate'}
                </Text>
              )}
              {plan.description !== null && plan.description.length > 0 && (
                <Text style={styles.planDescription}>{plan.description}</Text>
              )}
            </View>

            {/* Legal notice */}
            <View style={styles.noticeBanner}>
              <Ionicons name="information-circle-outline" size={18} color={colors.accentBlue} />
              <Text style={styles.noticeText}>
                Der Beitrag wird direkt vom Studio eingezogen. Über die App schliesst du nur den Vertrag ab.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
              onPress={() => { void handleConfirm(); }}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.card} />
              ) : (
                <Text style={styles.confirmBtnText}>Mitgliedschaft beantragen</Text>
              )}
            </TouchableOpacity>

            <View style={styles.bottomPad} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.mapOverlay,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  planCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
    marginBottom: 16,
  },
  planName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  planPrice: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.accentBlue,
    marginTop: 4,
  },
  planInterval: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  planMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  planDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 8,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accentBlueMuted,
    padding: 12,
    marginBottom: 24,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: colors.accentBlue,
    lineHeight: 18,
  },
  confirmBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
  },
  bottomPad: {
    height: 16,
  },
});
