import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useStudioProfile } from '../hooks/useStudioProfile';
import { useFeaturedFighters } from '../hooks/useFeaturedFighters';
import { useSchedule } from '../hooks/useSchedule';
import { useMyStudioRequests } from '../hooks/useMyStudioRequests';
import { useStudioMembershipPlans } from '../hooks/useStudioMembershipPlans';
import StudioHero from '../components/studio/StudioHero';
import DisciplineChips from '../components/studio/DisciplineChips';
import FeaturedFightersRow from '../components/studio/FeaturedFightersRow';
import TrialBookingSheet from '../components/studio/TrialBookingSheet';
import MembershipPlansList from '../components/studio/MembershipPlansList';

type Props = NativeStackScreenProps<RootStackParamList, 'StudioDetail'>;

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const STATUS_LABELS: Record<string, string> = {
  pending:   'Ausstehend',
  confirmed: 'Bestätigt',
  declined:  'Abgelehnt',
  cancelled: 'Abgebrochen',
};

export default function StudioDetailScreen({ route, navigation }: Props): React.ReactElement {
  const { studioId } = route.params;
  const { user } = useAuth();

  const { studio, loading: studioLoading } = useStudioProfile(studioId);
  const { fighters, loading: fightersLoading, removeFighter } = useFeaturedFighters(studioId);
  const { schedule, loading: scheduleLoading } = useSchedule(undefined, studioId);
  const { trialBookings, contracts, loading: requestsLoading, refetch } = useMyStudioRequests();
  const { plans, loading: plansLoading, refetch: refetchPlans } = useStudioMembershipPlans(studioId);
  const [bookingSheetVisible, setBookingSheetVisible] = useState(false);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);

  const isOwner = studio !== null && user !== null && studio.owner_user_id === user.id;

  const studioBooking = trialBookings.find((b) => b.studio_id === studioId) ?? null;
  const activeBooking =
    studioBooking !== null &&
    (studioBooking.status === 'pending' || studioBooking.status === 'confirmed')
      ? studioBooking
      : null;

  const activeContract =
    contracts.find(
      (c) =>
        c.studio_id === studioId &&
        (c.status === 'pending' || c.status === 'active' || c.status === 'cancellation_requested'),
    ) ?? null;

  async function handleRemoveSelf(): Promise<void> {
    if (user === null) return;
    Alert.alert(
      'Featured-Status entfernen',
      'Dein Profil wird nicht mehr auf dieser Studioseite angezeigt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: async () => {
            const { error } = await removeFighter(user.id);
            if (error !== null) Alert.alert('Fehler', error);
          },
        },
      ],
    );
  }

  const isLoading = studioLoading || requestsLoading;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      </SafeAreaView>
    );
  }

  if (studio === null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TouchableOpacity style={styles.backBtnStandalone} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <Ionicons name="chevron-back" size={22} color={colors.card} />
      </TouchableOpacity>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <StudioHero
          name={studio.name}
          city={studio.city}
          address={studio.address}
          bannerUrl={studio.banner_url}
          avatarUrl={studio.avatar_url}
          isOwner={isOwner}
          onEditPress={() => navigation.navigate('StudioProfileEdit', { studioId })}
        />

        {studio.disciplines.length > 0 && (
          <DisciplineChips disciplines={studio.disciplines} />
        )}

        {studio.description !== null && studio.description.trim().length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Über uns</Text>
            <Text style={styles.description}>{studio.description}</Text>
          </View>
        )}

        {(fighters.length > 0 || fightersLoading) && (
          <View style={styles.sectionNopad}>
            <Text style={[styles.sectionLabel, styles.sectionLabelPad]}>Featured Fighters</Text>
            <FeaturedFightersRow
              fighters={fighters}
              loading={fightersLoading}
              currentUserId={user?.id ?? null}
              onRemoveSelf={handleRemoveSelf}
            />
          </View>
        )}

        <View style={styles.content}>
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

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setScheduleExpanded((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionLabel}>Stundenplan</Text>
              <Ionicons
                name={scheduleExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.text}
              />
            </TouchableOpacity>
            {scheduleExpanded && (
              scheduleLoading ? (
                <ActivityIndicator color={colors.accentBlue} style={styles.loaderInline} />
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
              )
            )}
          </View>

          <MembershipPlansList
            studioId={studioId}
            plans={plans}
            loading={plansLoading}
            activeContract={activeContract}
            onContractSigned={() => { refetch(); refetchPlans(); }}
          />
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>

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
  backBtn: {
    position: 'absolute',
    top: 56,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.heroFloatingBtn,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  backBtnStandalone: {
    margin: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    marginTop: 48,
  },
  loaderInline: {
    marginVertical: 8,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionNopad: {
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabelPad: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
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
    height: 48,
  },
});
