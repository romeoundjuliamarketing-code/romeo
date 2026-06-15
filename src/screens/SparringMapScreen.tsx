import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusRefetch } from '../hooks/useFocusRefetch';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useOpenSparrings } from '../hooks/useOpenSparrings';
import { useSparringActions } from '../hooks/useSparringActions';
import { useStudio } from '../hooks/useStudio';
import { useStudioAddress } from '../hooks/useStudioAddress';
import { useStudioMapMarkers } from '../hooks/useStudioMapMarkers';
import { useVerification } from '../hooks/useVerification';
import { useSparringChatList } from '../hooks/useSparringChatList';
import { useOpenEvents } from '../hooks/useOpenEvents';
import { useEventActions } from '../hooks/useEventActions';
import SparringDetailSheet from '../components/sparring/SparringDetailSheet';
import CreateSparringSheet from '../components/sparring/CreateSparringSheet';
import MapBoostSheet from '../components/sparring/MapBoostSheet';
import CreateEventSheet from '../components/sparring/CreateEventSheet';
import EventPaymentSheet from '../components/sparring/EventPaymentSheet';
import EventDetailSheet from '../components/sparring/EventDetailSheet';
import MapModeToggle from '../components/sparring/MapModeToggle';
import MapTimeFilter from '../components/sparring/MapTimeFilter';
import SparringMapView from '../components/sparring/SparringMapView';
import { getTimeWindow } from '../utils/sparringTimeWindow';
import { canJoinSparring } from '../utils/sparringAccess';
import type { SparringWithMeta } from '../hooks/useOpenSparrings';
import type { EventWithMeta } from '../hooks/useOpenEvents';
import type { RootStackParamList } from '../navigation/types';
import type { MapMode } from '../components/sparring/MapModeToggle';
import type { TimeFilter } from '../components/sparring/MapTimeFilter';

interface NavProp {
  goBack(): void;
  canGoBack(): boolean;
}

type Props = { navigation: NavProp };

export default function SparringMapScreen({ navigation: _navigation }: Props) {
  const insets     = useSafeAreaInsets();
  const { user }   = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // ── Sparring data ─────────────────────────────────────────────────────────
  const { sparrings, refetch: refetchSparrings } = useOpenSparrings();
  const { signUp, cancelSignup, createSparring, deactivateSparring } = useSparringActions();
  const { totalUnread } = useSparringChatList();

  // ── Event data ────────────────────────────────────────────────────────────
  const { events, refetch: refetchEvents } = useOpenEvents();
  const { createEvent, signUp: signUpEvent, cancelSignup: cancelSignupEvent, deactivateEvent } = useEventActions();

  // ── Studio / verification ─────────────────────────────────────────────────
  const { currentStudio } = useStudio();
  const { address: studioAddress, lat: studioLat, lng: studioLng } = useStudioAddress(
    currentStudio?.id ?? '',
  );
  const { studios: studioMarkers } = useStudioMapMarkers();
  const { tier, refetch: refetchVerification } = useVerification();

  // Keep verification tier fresh when returning to the map.
  useFocusRefetch(refetchVerification);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [mapMode, setMapMode]           = useState<MapMode>('sparrings');
  const [timeFilter, setTimeFilter]     = useState<TimeFilter>('all');
  const [selected, setSelected]         = useState<SparringWithMeta | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventWithMeta | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
  const [createEventVisible, setCreateEventVisible] = useState(false);

  // After creating a sparring, prompt the boost sheet (defer to avoid double iOS modal).
  const [boostSparringId, setBoostSparringId] = useState<string | null>(null);
  const boostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // After creating an event, prompt the payment sheet (same defer pattern).
  const [paymentEventId, setPaymentEventId] = useState<string | null>(null);
  const paymentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      if (boostTimerRef.current !== null) clearTimeout(boostTimerRef.current);
      if (paymentTimerRef.current !== null) clearTimeout(paymentTimerRef.current);
    };
  }, []);

  // ── Derived: coach studio marker ──────────────────────────────────────────
  const coachStudio =
    currentStudio !== null &&
    studioAddress !== null &&
    studioAddress.trim().length > 0
      ? { id: currentStudio.id, address: studioAddress, lat: studioLat, lng: studioLng }
      : null;

  // ── Derived: sparrings (unchanged) ────────────────────────────────────────
  const sparringsWithCoords = useMemo(
    () => sparrings.filter((s) => s.lat !== null && s.lng !== null),
    [sparrings],
  );

  const filteredSparrings = useMemo(
    () => timeFilter === 'all'
      ? sparringsWithCoords
      : sparringsWithCoords.filter((s) => getTimeWindow(s.scheduled_at) === timeFilter),
    [sparringsWithCoords, timeFilter],
  );

  const sparringTabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sparringsWithCoords) {
      const w = getTimeWindow(s.scheduled_at);
      counts[w] = (counts[w] ?? 0) + 1;
    }
    return counts;
  }, [sparringsWithCoords]);

  const coveredStudioIds = useMemo(
    () => new Set(
      filteredSparrings
        .filter((s) => s.is_at_studio && s.studio_id !== null)
        .map((s) => s.studio_id as string),
    ),
    [filteredSparrings],
  );

  const sparringModeStudios = useMemo(
    () => studioMarkers.filter((st) => !coveredStudioIds.has(st.id)),
    [studioMarkers, coveredStudioIds],
  );

  // ── Derived: events ───────────────────────────────────────────────────────
  const eventsWithCoords = useMemo(
    () => events.filter((e) => e.lat !== null && e.lng !== null),
    [events],
  );

  const filteredEvents = useMemo(
    () => timeFilter === 'all'
      ? eventsWithCoords
      : eventsWithCoords.filter((e) => getTimeWindow(e.scheduled_at) === timeFilter),
    [eventsWithCoords, timeFilter],
  );

  const eventTabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of eventsWithCoords) {
      const w = getTimeWindow(e.scheduled_at);
      counts[w] = (counts[w] ?? 0) + 1;
    }
    return counts;
  }, [eventsWithCoords]);

  // Active counts for the time filter depend on the current mode.
  const activeTabCounts = mapMode === 'sparrings' ? sparringTabCounts : eventTabCounts;

  // ── Guard: require verified user before interacting ───────────────────────
  function requireVerified(): boolean {
    if (tier === 'verified') return true;
    Alert.alert(
      'Verifizierung erforderlich',
      'Um an Sparrings teilzunehmen oder eigene zu erstellen, musst du dein Profil verifizieren.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Jetzt verifizieren', onPress: () => navigation.navigate('Verification') },
      ],
    );
    return false;
  }

  // ── Sparring handlers ─────────────────────────────────────────────────────
  async function handleToggleSparringSignup(): Promise<void> {
    if (selected === null) return;
    if (!selected.is_signed_up && !canJoinSparring(selected.verified_only, tier)) {
      requireVerified();
      return;
    }
    setActionLoading(true);
    const { error } = await (selected.is_signed_up
      ? cancelSignup(selected.id)
      : signUp(selected.id));
    setActionLoading(false);
    if (error !== null) return;
    refetchSparrings();
    setSelected(null);
  }

  function handleDeactivateSparring(): void {
    if (selected === null) return;
    Alert.alert(
      'Sparring absagen',
      `"${selected.title}" wirklich absagen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Absagen',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const { error } = await deactivateSparring(selected.id);
            setActionLoading(false);
            if (error !== null) {
              Alert.alert('Fehler', error);
              return;
            }
            refetchSparrings();
            setSelected(null);
          },
        },
      ],
    );
  }

  // ── Event handlers ────────────────────────────────────────────────────────
  async function handleToggleEventSignup(): Promise<void> {
    if (selectedEvent === null) return;
    setActionLoading(true);
    const { error } = await (selectedEvent.is_signed_up
      ? cancelSignupEvent(selectedEvent.id)
      : signUpEvent(selectedEvent.id));
    setActionLoading(false);
    if (error !== null) {
      Alert.alert('Fehler', error);
      return;
    }
    refetchEvents();
    setSelectedEvent(null);
  }

  function handleDeactivateEvent(): void {
    if (selectedEvent === null) return;
    const ev = selectedEvent;
    Alert.alert(
      'Event absagen',
      `"${ev.title}" wirklich absagen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Absagen',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const { error } = await deactivateEvent(ev.id);
            setActionLoading(false);
            if (error !== null) {
              Alert.alert('Fehler', error);
              return;
            }
            refetchEvents();
            setSelectedEvent(null);
          },
        },
      ],
    );
  }

  // ── Map view props by mode ────────────────────────────────────────────────
  const mapSparrings  = mapMode === 'sparrings' ? filteredSparrings : [];
  const mapStudioDots = mapMode === 'sparrings' ? sparringModeStudios : [];
  const mapEvents     = mapMode === 'events'    ? filteredEvents      : [];

  return (
    <View style={styles.root}>
      <SparringMapView
        sparrings={mapSparrings}
        studioDots={mapStudioDots}
        events={mapEvents}
        onSparringPress={setSelected}
        onStudioPress={(studio) => navigation.navigate('StudioDetail', { studioId: studio.id })}
        onEventPress={setSelectedEvent}
        totalUnread={totalUnread}
        onChatPress={() => navigation.navigate('SparringChatList')}
      />

      {/* ── Top overlay: mode toggle (center) + time filter (left) ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        {/* Row: left side holds the vertical time filter; center holds the mode toggle */}
        <View style={styles.topRow}>
          <View style={styles.leftPanel}>
            <MapTimeFilter
              value={timeFilter}
              onChange={setTimeFilter}
              tabCounts={activeTabCounts}
            />
          </View>
          <View style={styles.centerPanel}>
            <MapModeToggle mode={mapMode} onChange={setMapMode} />
          </View>
          {/* Right placeholder to keep toggle visually centered */}
          <View style={styles.rightPanel} />
        </View>
      </View>

      {/* ── Sparring detail sheet ── */}
      <SparringDetailSheet
        sparring={selected}
        currentUserId={user?.id ?? null}
        userTier={tier}
        onClose={() => setSelected(null)}
        onToggleSignup={handleToggleSparringSignup}
        onDeactivate={handleDeactivateSparring}
        onBoostActivated={refetchSparrings}
        loading={actionLoading}
      />

      {/* ── Event detail sheet ── */}
      <EventDetailSheet
        event={selectedEvent}
        currentUserId={user?.id ?? null}
        onClose={() => setSelectedEvent(null)}
        onToggleSignup={handleToggleEventSignup}
        onDeactivate={handleDeactivateEvent}
        onOpenChat={() => {
          // TODO: navigate to event-specific chat once the event chat route is finalised (chat task).
          navigation.navigate('SparringChatList');
        }}
        loading={actionLoading}
      />

      {/* ── FAB: action depends on mode ── */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={() => {
          if (!requireVerified()) return;
          if (mapMode === 'sparrings') {
            setCreateSheetVisible(true);
          } else {
            setCreateEventVisible(true);
          }
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle-outline" size={22} color={colors.card} />
        <Text style={styles.fabText}>
          {mapMode === 'sparrings' ? 'Sparring anmelden' : 'Event anmelden'}
        </Text>
      </TouchableOpacity>

      {/* ── Create sparring sheet (existing flow) ── */}
      <CreateSparringSheet
        visible={createSheetVisible}
        mode="user"
        coachStudio={coachStudio}
        onClose={() => setCreateSheetVisible(false)}
        onCreate={async (params) => {
          const { error, sparringId } = await createSparring(params);
          if (error !== null) {
            Alert.alert('Fehler', error);
            return;
          }
          refetchSparrings();
          if (sparringId !== undefined) {
            boostTimerRef.current = setTimeout(() => setBoostSparringId(sparringId), 400);
          }
        }}
      />

      {/* ── Map boost sheet for sparring (existing flow) ── */}
      {boostSparringId !== null && (
        <MapBoostSheet
          sparringId={boostSparringId}
          visible
          onClose={() => setBoostSparringId(null)}
          onBoostActivated={() => {
            setBoostSparringId(null);
            refetchSparrings();
          }}
        />
      )}

      {/* ── Create event sheet ── */}
      <CreateEventSheet
        visible={createEventVisible}
        onClose={() => setCreateEventVisible(false)}
        onCreate={async (params) => {
          const { error, eventId } = await createEvent(params);
          if (error !== null) {
            Alert.alert('Fehler', error);
            return;
          }
          refetchEvents();
          // Defer opening the payment sheet so iOS does not present two modals at once.
          if (eventId !== undefined) {
            paymentTimerRef.current = setTimeout(() => setPaymentEventId(eventId), 400);
          }
        }}
      />

      {/* ── Event payment sheet (mirrors boost flow) ── */}
      {paymentEventId !== null && (
        <EventPaymentSheet
          eventId={paymentEventId}
          visible
          onClose={() => setPaymentEventId(null)}
          onActivated={() => {
            setPaymentEventId(null);
            refetchEvents();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    position:          'absolute',
    top:               0,
    left:              0,
    right:             0,
    paddingHorizontal: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
  },
  leftPanel: {
    width:      80,
    alignItems: 'flex-start',
  },
  centerPanel: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'flex-start',
  },
  rightPanel: {
    width: 80,
  },
  fab: {
    position:        'absolute',
    right:           16,
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: colors.accentBlue,
    borderRadius:    24,
    paddingVertical:   12,
    paddingHorizontal: 20,
    gap:             8,
    shadowColor:     colors.dark,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.2,
    shadowRadius:    6,
    elevation:       4,
  },
  fabText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.card,
  },
});
