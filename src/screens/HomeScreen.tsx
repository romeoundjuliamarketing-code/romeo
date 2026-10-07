import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusRefetch } from '../hooks/useFocusRefetch';
import { colors } from '../theme/colors';
import FocusedStatusBar from '../components/common/FocusedStatusBar';
import { TabBarSpacer } from '../components/navigation/SparrTabBar';
import HomeHeader from '../components/home/HomeHeader';
import HomeNextSparring, { HomeNextSparringPlaceholder } from '../components/home/HomeNextSparring';
import HomeCardDeckEntry from '../components/home/HomeCardDeckEntry';
import HomeFightNight from '../components/home/HomeFightNight';
import { AnnouncementNotice } from '../components/home/HomeNotices';
import NearbySparringsCard from '../components/home/NearbySparringsCard';
import LocationPickerModal from '../components/sparring/LocationPickerModal';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useAnnouncement } from '../hooks/useAnnouncement';
import { useNotifications } from '../hooks/useNotifications';
import { useProximitySparringNotifications } from '../hooks/useProximitySparringNotifications';
import { useNotificationsContext } from '../context/NotificationsContext';
import { useSearchLocation } from '../hooks/useSearchLocation';
import { useNearbySparrings } from '../hooks/useNearbySparrings';
import { useHomeNow, useHomeSparring } from '../hooks/useHomeSparring';
import { useCommunityMemberCount } from '../hooks/useCommunityMemberCount';
import { freePreviewChallenge } from '../utils/challengeAvailability';
import { useFightEvents } from '../hooks/useFightEvents';
import { HOME_RADIUS_KM, RADIUS_OPTIONS_KM } from '../utils/sparringSearch';
import { fightEventStart } from '../utils/fightEvents';
import type { FightEvent, FightPromotion } from '../utils/fightEvents';
import type { HomeSparring } from '../utils/homeAgenda';
import { SHOW_EVENTS } from '../data/sparringConfig';
import type { RootStackParamList } from '../navigation/types';
import { useTranslation } from 'react-i18next';

// Home on one continuous warm background (also behind the status bar): compact
// header; with an upcoming commitment the appointment leads, then the card
// stack and the dark "ring corner" with sparrings nearby. Without one, the card
// stack leads and the ring corner carries the single empty invitation.
// Then the fight-night block ("Gemeinsam Kämpfe schauen"). The studio schedule is reached from the studio screens, not Home.
// Previous versions: git branches backup/home-v1 … v5-2026-09-28; removed
// paused cards (water, stretch, points): backup/vor-aufraeumen-2026-10-04.

export default function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [focusTrigger,    setFocusTrigger]    = useState(0);

  useFocusRefetch(() => setFocusTrigger((n) => n + 1));
  const now = useHomeNow(() => setFocusTrigger((n) => n + 1));

  const { profile } = useProfile(focusTrigger);
  const { announcement, deleteAnnouncement } = useAnnouncement(focusTrigger);
  // Push token + one-time cleanup of removed local reminders.
  useNotifications();
  useProximitySparringNotifications();
  const { unreadCount: unreadNotificationCount } = useNotificationsContext();
  const home = useHomeSparring(user?.id ?? null, now, focusTrigger);
  const communityCount = useCommunityMemberCount(user !== null);
  const cardPreview = freePreviewChallenge();
  // Paused with SHOW_EVENTS: no request while the block is hidden.
  const fight = useFightEvents(SHOW_EVENTS && user !== null, focusTrigger);
  // "Sparrings in meiner Nähe": fixed 30 km, same search as the map/list.
  // Home never asks for location permission — only the map or the picker do.
  const { status: searchLocationStatus, location: searchLocation, setManual } = useSearchLocation({ askPermission: false });
  const { status: nearbyStatus, sparrings: nearbySparrings, refetch: refetchNearby } = useNearbySparrings(
    searchLocation,
    HOME_RADIUS_KM,
    focusTrigger,
  );
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

  function openNearby(radiusKm: number): void {
    navigation.navigate('Tabs', { screen: 'Sparring', params: { nearbyRadiusKm: radiusKm, nearbyEntryAt: Date.now() } });
  }

  function openSparring(sparringId: string): void {
    navigation.navigate('Tabs', { screen: 'Sparring', params: { focusSparringId: sparringId } });
  }

  function openSparringChat(sparring: HomeSparring): void {
    navigation.navigate('SparringGroupChat', {
      sparringId:    sparring.id,
      sparringTitle: sparring.title,
      scheduledAt:   sparring.scheduledAt,
      durationMin:   sparring.durationMin,
      isOrganizer:   sparring.role === 'organizer',
    });
  }

  // Event map in watch-party mode for this promotion (and fight night, when
  // known). An official fight night is never turned into a watch party here.
  function openWatchParties(promotion: FightPromotion, event: FightEvent | null): void {
    navigation.navigate('Tabs', {
      screen: 'Sparring',
      params: {
        watchEntryAt:   Date.now(),
        watchPromotion: promotion,
        watchEventName: event?.name,
        watchStart:     event !== null ? fightEventStart(event)?.toISOString() : undefined,
        watchEventDate: event?.eventDate,
      },
    });
  }

  const featured = home.featured;

  const nearby = (
    <NearbySparringsCard
      radiusKm={HOME_RADIUS_KM}
      locationLabel={searchLocation?.label ?? null}
      locationStatus={searchLocationStatus}
      status={nearbyStatus}
      sparrings={nearbySparrings}
      now={now}
      onOpen={() => openNearby(HOME_RADIUS_KM)}
      onOpenSparring={openSparring}
      onPickLocation={() => setLocationPickerVisible(true)}
      onRetry={refetchNearby}
      onWiden={() => openNearby(RADIUS_OPTIONS_KM.find((km) => km > HOME_RADIUS_KM) ?? HOME_RADIUS_KM)}
      onCreate={() => navigation.navigate('Tabs', { screen: 'Sparring', params: { openCreate: true } })}
      hasCommitment={featured !== null}
    />
  );

  const cardEntry = <HomeCardDeckEntry preview={cardPreview} onDraw={() => navigation.navigate('Tabs', { screen: 'Karten' })} />;

  const fightNight = (
    <HomeFightNight events={fight.events} status={fight.status} now={now} onWatch={openWatchParties} />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FocusedStatusBar style="dark" />
      <View style={styles.page}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <HomeHeader
              name={profile?.name ?? null}
              unreadNotificationCount={unreadNotificationCount}
              onNotificationsPress={() => navigation.navigate('Notifications')}
              communityCount={communityCount}
            />

            <View style={styles.sections}>
              {/* With a commitment (or while it is still loading) the
                  appointment leads; without one, Sparr Cards lead and the
                  nearby section carries the "none yet" note. A load error is
                  never shown as "no commitment". */}
              {home.status === 'loading' && <HomeNextSparringPlaceholder />}
              {featured !== null && (
                <HomeNextSparring
                  sparring={featured}
                  now={now}
                  currentUserId={user?.id ?? null}
                  upcomingCount={home.upcomingCount}
                  chatUnread={home.chatUnread}
                  confirming={home.confirming}
                  confirmError={home.confirmError}
                  onConfirm={home.confirm}
                  onDetails={() => openSparring(featured.id)}
                  onChat={() => openSparringChat(featured)}
                  onAll={() => navigation.navigate('SparringChatList')}
                />
              )}

              {cardEntry}

              {home.status === 'error' && (
                <TouchableOpacity style={styles.loadError} onPress={home.retry} accessibilityRole="button">
                  <Text style={styles.loadErrorText}>{t('home.screen.loadFailed')}</Text>
                </TouchableOpacity>
              )}

              {announcement !== null && (
                <AnnouncementNotice
                  message={announcement.message}
                  canDelete={profile?.is_coach ?? false}
                  onDelete={() => { void deleteAnnouncement(); }}
                />
              )}

              {nearby}
              {SHOW_EVENTS && fightNight}
            </View>
          </View>
          <TabBarSpacer />
        </ScrollView>
      </View>

      <LocationPickerModal
        visible={locationPickerVisible}
        onClose={() => setLocationPickerVisible(false)}
        onConfirm={(lat, lng, displayAddress) => {
          setLocationPickerVisible(false);
          void setManual(lat, lng, displayAddress);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  sections: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 32,
  },
  loadError: {
    minHeight: 44,
    justifyContent: 'center',
  },
  loadErrorText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accentBlue,
  },
});
