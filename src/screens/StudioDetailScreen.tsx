import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { useSchedule } from '../hooks/useSchedule';
import { useMyStudioRequests } from '../hooks/useMyStudioRequests';
import { useStudioMembershipPlans } from '../hooks/useStudioMembershipPlans';
import TrialBookingSheet from '../components/studio/TrialBookingSheet';
import MembershipPlansList from '../components/studio/MembershipPlansList';

type Props = NativeStackScreenProps<RootStackParamList, 'StudioDetail'>;

interface StudioData {
  id: string;
  name: string;
  city: string;
  address: string | null;
}

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const STATUS_LABELS: Record<string, string> = {
  pending:   'Ausstehend',
  confirmed: 'Bestätigt',
  declined:  'Abgelehnt',
  cancelled: 'Abgebrochen',
};

export default function StudioDetailScreen({ route, navigation }: Props): React.ReactElement {
  const { studioId } = route.params;

  const [studio, setStudio] = useState<StudioData | null>(null);
  const [studioLoading, setStudioLoading] = useState(true);
  const [bookingSheetVisible, setBookingSheetVisible] = useState(false);

  const { schedule, loading: scheduleLoading } = useSchedule(undefined, studioId);
  const { trialBookings, contracts, loading: requestsLoading, refetch } = useMyStudioRequests();
  const { plans, loading: plansLoading, refetch: refetchPlans } = useStudioMembershipPlans(studioId);

  // Booking for this specific studio
  const studioBooking = trialBookings.find((b) => b.studio_id === studioId) ?? null;
  const activeBooking =
    studioBooking !== null &&
    (studioBooking.status === 'pending' || studioBooking.status === 'confirmed')
      ? studioBooking
      : null;

  // Active membership contract for this studio (only show if pending/active/cancellation_requested)
  const activeContract =
    contracts.find(
      (c) =>
        c.studio_id === studioId &&
        (c.status === 'pending' || c.status === 'active' || c.status === 'cancellation_requested'),
    ) ?? null;

  useEffect(() => {
    void (async () => {
      setStudioLoading(true);
      const { data } = await supabase
        .from('studios')
        .select('id, name, city, address')
        .eq('id', studioId)
        .single();
      setStudio(data ?? null);
      setStudioLoading(false);
    })();
  }, [studioId]);

  const isLoading = studioLoading || requestsLoading;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={colors.card} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {studio?.name ?? ''}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Studio info */}
          {studio !== null && (
            <View style={styles.infoCard}>
              <Text style={styles.studioName}>{studio.name}</Text>
              <Text style={styles.studioCity}>{studio.city}</Text>
              {studio.address !== null && (
                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.addressText}>{studio.address}</Text>
                </View>
              )}
            </View>
          )}

          {/* Trial booking CTA or status */}
          {activeBooking !== null ? (
            <View style={styles.statusCard}>
              <Ionicons
                name={activeBooking.status === 'confirmed' ? 'checkmark-circle' : 'time-outline'}
                size={20}
                color={activeBooking.status === 'confirmed' ? colors.difficultyGreen : colors.accentBlue}
              />
              <View style={styles.statusTextBlock}>
                <Text style={styles.statusTitle}>Probetraining-Anfrage</Text>
                <Text style={styles.statusValue}>
                  {STATUS_LABELS[activeBooking.status] ?? activeBooking.status}
                  {'  ·  '}
                  {activeBooking.requested_date.split('-').reverse().join('.')}
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.bookBtn}
              onPress={() => setBookingSheetVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.card} />
              <Text style={styles.bookBtnText}>Probetraining buchen</Text>
            </TouchableOpacity>
          )}

          {/* Schedule preview */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Stundenplan</Text>
            {scheduleLoading ? (
              <ActivityIndicator color={colors.accentBlue} style={styles.loader} />
            ) : schedule.length === 0 ? (
              <Text style={styles.emptyText}>Noch kein Stundenplan vorhanden.</Text>
            ) : (
              schedule.map((entry) => (
                <View key={entry.id} style={styles.scheduleRow}>
                  <View style={styles.dayBadge}>
                    <Text style={styles.dayBadgeText}>{DAY_LABELS[entry.day_of_week]}</Text>
                  </View>
                  <View style={styles.scheduleInfo}>
                    <Text style={styles.scheduleName}>{entry.training_name}</Text>
                    <Text style={styles.scheduleMeta}>
                      {entry.start_time.slice(0, 5)}  ·  {entry.duration_min} Min.
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Membership plans */}
          <MembershipPlansList
            studioId={studioId}
            plans={plans}
            loading={plansLoading}
            activeContract={activeContract}
            onContractSigned={() => { refetch(); refetchPlans(); }}
          />

          <View style={styles.bottomPad} />
        </ScrollView>
      )}

      <TrialBookingSheet
        visible={bookingSheetVisible}
        studioId={studioId}
        schedule={schedule}
        onClose={() => setBookingSheetVisible(false)}
        onBooked={() => { refetch(); }}
      />
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
    backgroundColor: colors.dark,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.headerCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.card,
  },
  loader: {
    marginTop: 48,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
  },
  studioName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  studioCity: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  addressText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.accentBlue,
  },
  bookBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  statusTextBlock: {
    flex: 1,
    gap: 2,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  statusValue: {
    fontSize: 13,
    color: colors.textSecondary,
  },
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
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dayBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  scheduleInfo: {
    flex: 1,
    gap: 2,
  },
  scheduleName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  scheduleMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  bottomPad: {
    height: 32,
  },
});
