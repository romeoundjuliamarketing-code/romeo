import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, BackHandler, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarOverlap } from '../components/navigation/SparrTabBar';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusRefetch } from '../hooks/useFocusRefetch';
import { useStoreEntitlements } from '../hooks/useStoreEntitlements';
import { creatorGateAllows, subscriptionRejection } from '../utils/subscriptionPlans';
import { useAuth } from '../context/AuthContext';
import { fetchSparringById } from '../hooks/useOpenSparrings';
import { useNearbySparrings } from '../hooks/useNearbySparrings';
import { useSearchLocation } from '../hooks/useSearchLocation';
import { useSparringActions } from '../hooks/useSparringActions';
import { useSparringReach } from '../hooks/useSparringReach';
import { useSparringJoinFlow } from '../hooks/useSparringJoinFlow';
import ReachIntroSheet from '../components/sparring/trust/ReachIntroSheet';
import { useStudio } from '../hooks/useStudio';
import { useStudioAddress } from '../hooks/useStudioAddress';
import { useVerification } from '../hooks/useVerification';
import { useSparringChatList } from '../hooks/useSparringChatList';
import { useOpenEvents } from '../hooks/useOpenEvents';
import { useEventActions } from '../hooks/useEventActions';
import SparringDetailSheet from '../components/sparring/SparringDetailSheet';
import SparringMapPreview, { SparringMapEmptyCard } from '../components/sparring/SparringMapPreview';
import SparringMapHeader from '../components/sparring/SparringMapHeader';
import MapBottomControls from '../components/sparring/MapBottomControls';
import SparringSearchBar from '../components/sparring/SparringSearchBar';
import SparringListView from '../components/sparring/SparringListView';
import LocationPickerModal from '../components/sparring/LocationPickerModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OVERVIEW_REGION, regionAround } from '../utils/mapStartRegion';
import type { GeoPoint, MapRegion } from '../utils/mapStartRegion';
import { HOME_RADIUS_KM, radiusForZoom, visibleRadiusKm, widerRadius } from '../utils/sparringSearch';
import type { SearchRadius } from '../utils/sparringSearch';
import { useMapStartRegion } from '../hooks/useMapStartRegion';
import { changedSparringFields, isMaterialEdit, editNotifyMessage } from '../utils/sparringEdit';
import type { SparringEditFields } from '../utils/sparringEdit';
import type { UpdateSparringInput } from '../hooks/useSparringActions';
import type { SparringCommitmentResult } from '../components/sparring/SparringCommitmentResultCard';
import CreateSparringSheet from '../components/sparring/CreateSparringSheet';
import CreateSparringFlow from '../components/sparring/create/CreateSparringFlow';
import CreateEventSheet from '../components/sparring/CreateEventSheet';
import EventPaymentSheet from '../components/sparring/EventPaymentSheet';
import EventDetailSheet from '../components/sparring/EventDetailSheet';
import MapModeToggle from '../components/sparring/MapModeToggle';
import MapTimeFilter from '../components/sparring/MapTimeFilter';
import SparringMapView from '../components/sparring/SparringMapView';
import { useGym } from '../hooks/useGyms';
import { getTimeWindow } from '../utils/sparringTimeWindow';
import { canJoinSparring } from '../utils/sparringAccess';
import { resolveCommitmentCta } from '../utils/sparringCommitment';
import { nearbyRadiusWithin } from '../utils/joinGate';
import type { SparringWithMeta } from '../hooks/useOpenSparrings';
import type { EventWithMeta } from '../hooks/useOpenEvents';
import type { RootStackParamList } from '../navigation/types';
import type { MapMode } from '../components/sparring/MapModeToggle';
import type { TimeFilter } from '../components/sparring/MapTimeFilter';
import type { SparringView } from '../components/sparring/SparringSearchBar';
import type { NearbySparring } from '../hooks/useNearbySparrings';
import { watchPartyMatches } from '../utils/fightEvents';
import { SHOW_EVENTS } from '../data/sparringConfig';
import type { FightPromotion } from '../utils/fightEvents';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../i18n/language';
import { sparringDisplayTitle } from '../utils/sparringDisplayTitle';

// Last chosen sparring view (map/list). Without a stored choice the list opens.
const VIEW_KEY = 'sparring_view_v1';
const NO_POINTS: Array<{ lat: number; lng: number }> = [];

interface NavProp {
  goBack(): void;
  canGoBack(): boolean;
}

type Props = { navigation: NavProp };

export default function SparringMapScreen({ navigation: _navigation }: Props) {
  const { t }      = useTranslation();
  const { language } = useLanguage();
  const insets     = useSafeAreaInsets();
  // Floating tab bar lies over the map; bottom controls sit above it.
  const bottomSafe = Math.max(insets.bottom, useTabBarOverlap());
  const { user }   = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route      = useRoute<RouteProp<RootStackParamList, 'SparringMap'>>();

  // ── Sparring data ─────────────────────────────────────────────────────────
  // One search for map and list: search location + radius (+ time filter below).
  const [radiusKm, setRadiusKm] = useState<SearchRadius>(HOME_RADIUS_KM);
  // Radius the map was last fitted to. Only explicit changes (chips, "Umkreis
  // erweitern", Home entry, new location) move the camera; a radius that grew from
  // zooming out keeps the map where the user put it.
  const [fitRadiusKm, setFitRadiusKm] = useState<SearchRadius>(HOME_RADIUS_KM);
  const radiusRef = useRef<SearchRadius>(radiusKm);
  radiusRef.current = radiusKm;
  const chooseRadius = useCallback((next: SearchRadius): void => {
    setRadiusKm(next);
    setFitRadiusKm(next);
  }, []);
  const {
    status: locationStatus, location: searchLocation, setManual, switchToDevice,
  } = useSearchLocation({ askPermission: true });
  // Place search ("Berlin"): a temporary view only. Sparrings load around the
  // found place, but the search location is never changed or stored.
  const [placeJump, setPlaceJump] = useState<(GeoPoint & { label: string }) | null>(null);
  const { status: nearbyStatus, sparrings, refetch: refetchNearby } = useNearbySparrings(placeJump ?? searchLocation, radiusKm);
  useFocusRefetch(refetchNearby);
  const {
    cancelSignup, confirmSparring, deactivateSparring, updateSparring, countEditAffected, setSparringGym,
  } = useSparringActions();
  const { totalUnread, refetch: refetchChatList } = useSparringChatList();
  // Server-side reach status (radius, planned slot, intro state).
  const reach = useSparringReach();
  useFocusRefetch(reach.refetch);

  // ── Event data ────────────────────────────────────────────────────────────
  const { events, refetch: refetchEvents } = useOpenEvents(0, SHOW_EVENTS);
  const { createEvent, signUp: signUpEvent, cancelSignup: cancelSignupEvent, deactivateEvent } = useEventActions();

  // ── Studio / verification ─────────────────────────────────────────────────
  const { currentStudio } = useStudio();
  const { address: studioAddress, lat: studioLat, lng: studioLng } = useStudioAddress(
    currentStudio?.id ?? '',
  );
  const { tier, refetch: refetchVerification } = useVerification();

  // Keep verification tier fresh when returning to the map.
  useFocusRefetch(refetchVerification);
  // Read markers are written inside the chat screen; refresh the badge on return.
  useFocusRefetch(() => { void refetchChatList(); });
  const {
    entitlements: storeEntitlements, loading: storeEntitlementsLoading, refetch: refetchStoreEntitlements,
  } = useStoreEntitlements();
  useFocusRefetch(() => { void refetchStoreEntitlements(); });

  // ── UI state ──────────────────────────────────────────────────────────────
  const [mapMode, setMapMode]           = useState<MapMode>('sparrings');
  // Read by the map's region callback, which stays stable across renders.
  const mapModeRef = useRef<MapMode>(mapMode);
  mapModeRef.current = mapMode;
  const [timeFilter, setTimeFilter]     = useState<TimeFilter>('all');
  // Set by the Home fight-night entry: only watch parties for that promotion
  // (and fight night, when known). Cleared on mode change or via the chip.
  const [watchFilter, setWatchFilter] = useState<{
    promotion: FightPromotion; name: string | null; start: string | null; eventDate: string | null;
  } | null>(null);
  const [watchEmptyClosed, setWatchEmptyClosed] = useState(false);
  const [view, setView]                 = useState<SparringView>('list');
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  // Height of the overlaying top bar, so the list starts below it.
  const [topBarHeight, setTopBarHeight] = useState(0);
  // Same, but only taken while the search editor is closed, so opening it
  // does not shift the map.
  const [mapTopHeight, setMapTopHeight] = useState(0);
  // Height of the bottom stack (preview + controls) incl. its offset.
  const [bottomHeight, setBottomHeight] = useState(0);
  const [searchOpen, setSearchOpen]     = useState(false);
  const [selected, setSelected]         = useState<SparringWithMeta | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventWithMeta | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  // Rules consent sheet for the selected sparring (rendered inside the detail sheet)
  const [consentVisible, setConsentVisible] = useState(false);
  // Branded result card after a successful join/cancel (inside the detail sheet)
  const [commitmentResult, setCommitmentResult] = useState<SparringCommitmentResult | null>(null);
  // Branded "really cancel?" card (inside the detail sheet)
  const [cancelAskVisible, setCancelAskVisible] = useState(false);
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
  // One-time intro before the first create (own sheet: no other modal is open then).
  const [createIntroVisible, setCreateIntroVisible] = useState(false);
  const [createIntroBusy, setCreateIntroBusy] = useState(false);
  const [createIntroError, setCreateIntroError] = useState<string | null>(null);
  const [createEventVisible, setCreateEventVisible] = useState(false);
  // Gym page "Sparring planen": this gym is preselected as the place.
  const [createGymId, setCreateGymId] = useState<string | null>(null);
  const { gym: createGym } = useGym(createGymId);
  // However the sheet closes, the next opening starts without a preselection.
  useEffect(() => {
    if (!createSheetVisible) setCreateGymId(null);
  }, [createSheetVisible]);

  // Edit sheet: opened after the detail window closed (two modals must never be
  // shown at once). The target stays set while the sheet slides out.
  const [editTarget, setEditTarget] = useState<SparringWithMeta | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const editTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // After creating an event, prompt the payment sheet (same defer pattern).
  const [paymentEventId, setPaymentEventId] = useState<string | null>(null);
  const paymentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preview card above the bottom controls: the tapped marker, otherwise the
  // nearest hit. Once closed, the automatic pick stays away until a marker is
  // tapped again (panning never changes the search, so it cannot pop back).
  const [previewId, setPreviewId]           = useState<string | null>(null);
  // Search (radius:lat:lng) for which the automatic pick / the "no hits" card
  // was closed; a new search may show them again.
  const [autoClosedFor, setAutoClosedFor]   = useState<string | null>(null);
  const [emptyClosedFor, setEmptyClosedFor] = useState<string | null>(null);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      if (paymentTimerRef.current !== null) clearTimeout(paymentTimerRef.current);
      if (editTimerRef.current !== null) clearTimeout(editTimerRef.current);
    };
  }, []);

  // ── Derived: coach studio marker ──────────────────────────────────────────
  const coachStudio =
    currentStudio !== null &&
    studioAddress !== null &&
    studioAddress.trim().length > 0
      ? { id: currentStudio.id, name: currentStudio.name, address: studioAddress, lat: studioLat, lng: studioLng }
      : null;

  // ── Derived: sparrings (unchanged) ────────────────────────────────────────
  // The nearby search only returns sparrings with coordinates.
  const sparringsWithCoords = sparrings;

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

  // ── Derived: events ───────────────────────────────────────────────────────
  const eventsWithCoords = useMemo(
    () => events.filter((e) => e.lat !== null && e.lng !== null),
    [events],
  );

  const watchedEvents = useMemo(() => {
    if (watchFilter === null) return eventsWithCoords;
    const anchor = watchFilter.name !== null ? { start: watchFilter.start, eventDate: watchFilter.eventDate } : null;
    return eventsWithCoords.filter((e) => watchPartyMatches(
      { title: e.title, fightCard: e.fight_card, scheduledAt: e.scheduled_at },
      watchFilter.promotion,
      anchor,
    ));
  }, [eventsWithCoords, watchFilter]);

  const filteredEvents = useMemo(
    () => timeFilter === 'all'
      ? watchedEvents
      : watchedEvents.filter((e) => getTimeWindow(e.scheduled_at) === timeFilter),
    [watchedEvents, timeFilter],
  );

  const eventTabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of watchedEvents) {
      const w = getTimeWindow(e.scheduled_at);
      counts[w] = (counts[w] ?? 0) + 1;
    }
    return counts;
  }, [watchedEvents]);

  // Active counts for the time filter depend on the current mode.
  const activeTabCounts = mapMode === 'sparrings' ? sparringTabCounts : eventTabCounts;

  // ── Start viewport: search radius around position / home studio ──────────
  // With a search location the map shows exactly the search circle; it moves
  // again only when location or radius change (panning never changes the search).
  const homePoint = useMemo(
    () => (studioLat !== null && studioLng !== null ? { lat: studioLat, lng: studioLng } : null),
    [studioLat, studioLng],
  );
  const fallbackRegion = useMapStartRegion({ points: NO_POINTS, pointsReady: true, home: homePoint });
  const searchLat = searchLocation?.lat ?? null;
  const searchLng = searchLocation?.lng ?? null;
  // A new search location is fitted with the radius in effect at that moment.
  useEffect(() => {
    setFitRadiusKm(radiusRef.current);
  }, [searchLat, searchLng]);
  const searchRegion = useMemo((): MapRegion | null => {
    if (searchLat === null || searchLng === null) return null;
    // "Überall": the whole DACH overview.
    return fitRadiusKm === null ? { ...OVERVIEW_REGION } : regionAround({ lat: searchLat, lng: searchLng }, fitRadiusKm);
  }, [searchLat, searchLng, fitRadiusKm]);

  // Zooming out past the circle widens the search (up to "Überall"); see radiusForZoom.
  const handleUserRegionChange = useCallback((region: MapRegion): void => {
    if (mapModeRef.current !== 'sparrings') return;
    setRadiusKm((prev) => radiusForZoom(prev, visibleRadiusKm(region)));
  }, []);
  // A new search region (location or radius chosen) ends the place view.
  useEffect(() => { setPlaceJump(null); }, [searchRegion]);
  const placeJumpRegion = useMemo(
    (): MapRegion | null => (placeJump !== null ? regionAround(placeJump, PLACE_JUMP_RADIUS_KM) : null),
    [placeJump],
  );
  function handlePlaceFound(lat: number, lng: number, label: string): void {
    setPlaceJump({ lat, lng, label });
    changeView('map');
  }
  const startRegion = placeJumpRegion ?? searchRegion ?? fallbackRegion;

  // ── Search: refresh, view preference, entry from Home ─────────────────────
  // After an action: refresh the search; a sparring opened outside of it
  // (deep link, push) is re-read directly so its status updates too.
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selected?.id ?? null;
  const refetchSparrings = useCallback((): void => {
    refetchNearby();
    const id = selectedIdRef.current;
    if (id === null || user === null || sparrings.some((s) => s.id === id)) return;
    void fetchSparringById(id, user.id).then((fresh) => {
      if (fresh !== null) setSelected((prev) => (prev?.id === fresh.id ? fresh : prev));
    });
  }, [refetchNearby, sparrings, user?.id]);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(VIEW_KEY).then((stored) => {
      if (!cancelled && (stored === 'map' || stored === 'list')) setView(stored);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  function changeView(next: SparringView): void {
    setView(next);
    setPreviewId(null);
    setSearchOpen(false);
    void AsyncStorage.setItem(VIEW_KEY, next).catch(() => undefined);
  }

  // Home "Sparrings in meiner Nähe": sparrings only, the given radius and no
  // other filter, so the hits match the number shown on Home.
  useEffect(() => {
    const entryAt = route.params?.nearbyEntryAt;
    if (entryAt === undefined) return;
    setMapMode('sparrings');
    setTimeFilter('all');
    chooseRadius(route.params?.nearbyRadiusKm ?? HOME_RADIUS_KM);
    setPreviewId(null);
    navigation.setParams({ nearbyEntryAt: undefined, nearbyRadiusKm: undefined });
  }, [route.params?.nearbyEntryAt]);

  // Home "UFC gucken": event map, watch parties for that fight night. The search
  // location is shared; sparring filters (radius, time window) do not carry over.
  useEffect(() => {
    const entryAt = route.params?.watchEntryAt;
    const promotion = route.params?.watchPromotion;
    if (entryAt === undefined || promotion === undefined) return;
    if (!SHOW_EVENTS) {
      navigation.setParams({
        watchEntryAt: undefined, watchPromotion: undefined, watchEventName: undefined,
        watchStart: undefined, watchEventDate: undefined,
      });
      return;
    }
    setMapMode('events');
    setTimeFilter('all');
    setSearchOpen(false);
    setWatchEmptyClosed(false);
    setWatchFilter({
      promotion,
      name:      route.params?.watchEventName ?? null,
      start:     route.params?.watchStart ?? null,
      eventDate: route.params?.watchEventDate ?? null,
    });
    navigation.setParams({
      watchEntryAt: undefined, watchPromotion: undefined, watchEventName: undefined,
      watchStart: undefined, watchEventDate: undefined,
    });
  }, [route.params?.watchEntryAt]);

  function handleLocationPress(): void {
    Alert.alert(t('map.screen.locationTitle'), t('map.screen.locationMessage'), [
      { text: t('map.screen.locationOnMap'), onPress: () => setLocationPickerVisible(true) },
      { text: t('map.screen.locationDevice'), onPress: () => { setPlaceJump(null); void switchToDevice(); } },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  const handleListPress = useCallback((s: NearbySparring): void => setSelected(s), []);

  // ── Guard: require verified user before interacting ───────────────────────
  function requireVerified(): boolean {
    if (tier === 'verified') return true;
    Alert.alert(
      t('map.screen.verifyTitle'),
      t('map.screen.verifyMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('map.screen.verifyNow'), onPress: () => navigation.navigate('Verification') },
      ],
    );
    return false;
  }

  // Private sparrings need the creator subscription (see creatorGateAllows).
  function requireCreator(): boolean {
    if (creatorGateAllows({
      loading: storeEntitlementsLoading,
      canCreateSparring: storeEntitlements.canCreateSparring,
      inStudio: coachStudio !== null,
    })) return true;
    navigation.navigate('Paywall', { focus: 'creator' });
    return false;
  }

  // Opens the create flow; before the very first create (per account, stored
  // on the server) the intro comes first. "Später" marks nothing as done.
  function openCreateFlow(): void {
    if (reach.status?.intro_acked !== true) {
      setCreateIntroError(null);
      setCreateIntroVisible(true);
      return;
    }
    setCreateSheetVisible(true);
  }

  async function handleCreateIntroNext(): Promise<void> {
    setCreateIntroBusy(true);
    setCreateIntroError(null);
    const ok = await reach.ackIntro();
    setCreateIntroBusy(false);
    if (!ok) {
      setCreateIntroError(t('sparringTrust.intro.saveFailed'));
      return;
    }
    setCreateIntroVisible(false);
    setCreateSheetVisible(true);
  }

  // Closes any sheet and shows sparrings around the device position, within a
  // radius filter the user may actually join (never wider than the reach).
  function showNearbyAtDevice(): void {
    setCreateSheetVisible(false);
    setConsentVisible(false);
    setCommitmentResult(null);
    setSelected(null);
    setMapMode('sparrings');
    setTimeFilter('all');
    changeView('list');
    chooseRadius(nearbyRadiusWithin(reach.status?.radius_km));
    void switchToDevice();
  }

  // Closes the current sheet, then opens the given sparring (focus mechanism).
  function focusSparring(sparringId: string): void {
    setCreateSheetVisible(false);
    setConsentVisible(false);
    setCommitmentResult(null);
    setSelected(null);
    navigation.setParams({ focusSparringId: sparringId });
  }

  // Deep-link from the "no sparrings nearby" notification: open the create sheet.
  useEffect(() => {
    if (route.params?.openCreate !== true) return;
    const gymId = route.params?.createAtGymId ?? null;
    navigation.setParams({ openCreate: undefined, createAtGymId: undefined });
    if (requireVerified() && requireCreator()) {
      setCreateGymId(gymId);
      openCreateFlow();
    }
  }, [route.params?.openCreate]);

  // Open the detail sheet when arriving via a deep link (https://DOMAIN/s/<id>)
  // or a push tap. Falls back to a direct fetch when the sparring is not in
  // the upcoming list (e.g. it already started, or a push arrived before the
  // list refreshed).
  useEffect(() => {
    const id = route.params?.focusSparringId;
    if (id === undefined) return;
    const match = sparrings.find((sp) => sp.id === id);
    if (match) {
      setSelected(match);
      navigation.setParams({ focusSparringId: undefined });
      return;
    }
    if (user === null) return;
    void (async () => {
      const fetched = await fetchSparringById(id, user.id);
      navigation.setParams({ focusSparringId: undefined });
      if (fetched !== null) {
        setSelected(fetched);
      } else {
        Alert.alert(t('map.screen.notFoundTitle'), t('map.screen.notFoundMessage'));
      }
    })();
  }, [route.params?.focusSparringId, sparrings, navigation, user]);

  // Keep the open detail sheet in sync with refetched data (e.g. after joining),
  // so status and counts update in place. Sparrings outside the upcoming list
  // (opened via fetchSparringById) keep their snapshot.
  useEffect(() => {
    setSelected((prev) => (prev === null ? prev : sparrings.find((s) => s.id === prev.id) ?? prev));
  }, [sparrings]);

  // A tapped preview only counts while its marker is still on the map.
  const tappedPreview = previewId !== null ? filteredSparrings.find((s) => s.id === previewId) ?? null : null;
  // Search results come nearest first.
  const searchKey = `${radiusKm ?? 'all'}:${searchLat ?? ''}:${searchLng ?? ''}`;
  const preview = tappedPreview ?? (autoClosedFor === searchKey ? null : filteredSparrings[0] ?? null);

  function closePreview(): void {
    setPreviewId(null);
    setAutoClosedFor(searchKey);
  }

  // Android back closes the search editor or a tapped preview before leaving
  // the map (the automatic pick is not something the user opened).
  useEffect(() => {
    if ((!searchOpen && tappedPreview === null) || selected !== null) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (searchOpen) setSearchOpen(false);
      else closePreview();
      return true;
    });
    return () => sub.remove();
  }, [searchOpen, tappedPreview, selected]);

  // ── Sparring handlers ─────────────────────────────────────────────────────
  function handleSparringMarkerPress(s: SparringWithMeta): void {
    setPreviewId(s.id);
    setSearchOpen(false);
  }

  // Binding join (intro, eligibility, location primer, consent, position check)
  // lives in useSparringJoinFlow; this screen only owns the consent sheet and
  // the result card.
  // Same CTA decision as the detail sheet: only check eligibility on open
  // when the normal join button would show.
  const joinCheckOnOpen = selected !== null && resolveCommitmentCta({
    myStatus:      selected.my_status,
    scheduledAt:   selected.scheduled_at,
    now:           new Date(),
    isFull:        selected.max_slots - selected.signup_count <= 0,
    isCreator:     selected.created_by === user?.id,
    verifiedBlock: !canJoinSparring(selected.verified_only, tier),
  }).type === 'join';
  const joinFlow = useSparringJoinFlow({
    sparringId:     selected?.id ?? null,
    checkOnOpen:    joinCheckOnOpen,
    reachStatus:    reach.status,
    ackIntro:       reach.ackIntro,
    refetchReach:   reach.refetch,
    setBusy:        setActionLoading,
    openConsent:    () => setConsentVisible(true),
    onJoined:       (status) => {
      // Keep the detail sheet open: the refetch below updates `selected`
      // (see the sync effect), so the CTA switches to the new status in place.
      refetchSparrings();
      setCommitmentResult(status);
    },
    onOpenSparring: focusSparring,
    onShowNearby:   showNearbyAtDevice,
  });

  function handleJoinSparring(): void {
    if (selected === null) return;
    if (!canJoinSparring(selected.verified_only, tier)) {
      requireVerified();
      return;
    }
    joinFlow.start();
  }

  async function handleConfirmSparringConsent(rulesVersion: number): Promise<void> {
    await joinFlow.confirm(rulesVersion);
    setConsentVisible(false);
  }

  function handleCancelSparringSignup(): void {
    if (selected === null) return;
    // Ask first — the branded question card lives inside the detail sheet.
    setCancelAskVisible(true);
  }

  async function performCancelSparringSignup(): Promise<void> {
    if (selected === null) return;
    setActionLoading(true);
    const wasWaitlisted = selected.my_status === 'waitlisted';
    const { error, status } = await cancelSignup(selected.id);
    setActionLoading(false);
    if (error !== null) {
      Alert.alert(t('common.error'), error);
      return;
    }
    // Keep the sheet open (the sync effect refreshes it) and show the result
    // card on top of it.
    refetchSparrings();
    if (status !== null) {
      setCommitmentResult(wasWaitlisted ? 'left_waitlist' : status);
    }
  }

  async function handleConfirmSparring(): Promise<void> {
    if (selected === null) return;
    setActionLoading(true);
    const { error } = await confirmSparring(selected.id);
    setActionLoading(false);
    if (error !== null) {
      Alert.alert(t('common.error'), error);
      return;
    }
    refetchSparrings();
    setSelected(null);
  }

  function handleDeactivateSparring(): void {
    if (selected === null) return;
    Alert.alert(
      t('map.screen.cancelSparringTitle'),
      t('map.screen.cancelMessage', { title: sparringDisplayTitle(selected.title, language) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('map.screen.cancelConfirm'),
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const { error } = await deactivateSparring(selected.id);
            setActionLoading(false);
            if (error !== null) {
              Alert.alert(t('common.error'), error);
              return;
            }
            refetchSparrings();
            setSelected(null);
          },
        },
      ],
    );
  }

  function handleEditSparring(): void {
    if (selected === null) return;
    const target = selected;
    setConsentVisible(false);
    setCommitmentResult(null);
    setCancelAskVisible(false);
    setSelected(null);
    setEditTarget(target);
    if (editTimerRef.current !== null) clearTimeout(editTimerRef.current);
    editTimerRef.current = setTimeout(() => setEditVisible(true), 400);
  }

  function confirmAsync(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(title, message, [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('map.screen.save'), onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) });
    });
  }

  async function handleSaveEdit(input: UpdateSparringInput): Promise<boolean> {
    if (editTarget === null) return false;
    const before: SparringEditFields = {
      title:        editTarget.title,
      notes:        editTarget.notes,
      discipline:   editTarget.discipline,
      address:      editTarget.address,
      lat:          editTarget.lat,
      lng:          editTarget.lng,
      scheduledAt:  editTarget.scheduled_at,
      durationMin:  editTarget.duration_min,
      maxSlots:     editTarget.max_slots,
      verifiedOnly: editTarget.verified_only,
    };
    const changed = changedSparringFields(before, {
      title:        input.title,
      notes:        input.notes,
      discipline:   input.discipline,
      address:      input.address,
      lat:          input.lat,
      lng:          input.lng,
      scheduledAt:  input.scheduledAt,
      durationMin:  input.durationMin,
      maxSlots:     input.maxSlots,
      verifiedOnly: input.verifiedOnly,
    });
    if (changed.length === 0) {
      // Only the gym link / access note changed: no notification, no "Bearbeitet".
      if (input.gym === undefined) return true;
      const { error: gymError } = await setSparringGym(editTarget.id, input.gym.gymId, input.gym.accessNote);
      if (gymError !== null) {
        Alert.alert(t('map.screen.saveFailed'), gymError);
        return false;
      }
      refetchSparrings();
      const gymTarget = editTarget;
      if (editTimerRef.current !== null) clearTimeout(editTimerRef.current);
      editTimerRef.current = setTimeout(() => setSelected(gymTarget), 400);
      return true;
    }

    if (isMaterialEdit(changed)) {
      const affected = await countEditAffected(editTarget.id);
      if (affected > 0 && !(await confirmAsync(t('map.screen.saveChangesTitle'), editNotifyMessage(affected)))) {
        return false;
      }
    }

    const { error } = await updateSparring(editTarget.id, input);
    if (error !== null) {
      Alert.alert(t('map.screen.saveFailed'), error);
      return false;
    }
    refetchSparrings();
    // Back to the detail window once the sheet is gone; the sync effect swaps
    // in the refetched row.
    const target = editTarget;
    if (editTimerRef.current !== null) clearTimeout(editTimerRef.current);
    editTimerRef.current = setTimeout(() => setSelected(target), 400);
    return true;
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
      Alert.alert(t('common.error'), error);
      return;
    }
    refetchEvents();
    setSelectedEvent(null);
  }

  function handleDeactivateEvent(): void {
    if (selectedEvent === null) return;
    const ev = selectedEvent;
    Alert.alert(
      t('map.screen.cancelEventTitle'),
      t('map.screen.cancelMessage', { title: ev.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('map.screen.cancelConfirm'),
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const { error } = await deactivateEvent(ev.id);
            setActionLoading(false);
            if (error !== null) {
              Alert.alert(t('common.error'), error);
              return;
            }
            refetchEvents();
            setSelectedEvent(null);
          },
        },
      ],
    );
  }

  // ── Search presentation ───────────────────────────────────────────────────
  const showList = mapMode === 'sparrings' && view === 'list';
  const wider = widerRadius(radiusKm);
  const widen = wider !== undefined ? () => chooseRadius(wider) : null;
  // The list shows its own full-size notice; the bar carries it on the map.
  const searchNotice = showList
    ? null
    : nearbyStatus === 'error'
    ? { text: t('map.screen.loadFailed'), actionLabel: t('map.screen.retry'), onAction: refetchNearby }
    : locationStatus === 'none'
      ? { text: t('map.screen.noLocation'), actionLabel: t('map.screen.chooseLocation'), onAction: () => setLocationPickerVisible(true) }
      : null;
  // For sparrings the time filter is only shown with hits or while loading;
  // "no hits" is the map's empty card, errors are the search bar's notice.
  const showTimeFilter = mapMode === 'events'
    || (mapMode === 'sparrings' && (sparringsWithCoords.length > 0 || nearbyStatus === 'loading'));
  const showSparringCards = mapMode === 'sparrings' && !showList;
  const showEmptyCard = showSparringCards
    && nearbyStatus === 'ready'
    && locationStatus !== 'none'
    && sparringsWithCoords.length === 0
    && emptyClosedFor !== searchKey;

  function handleTopLayout(e: LayoutChangeEvent): void {
    const h = e.nativeEvent.layout.height;
    setTopBarHeight(h);
    if (!searchOpen) setMapTopHeight(h);
  }

  // ── Map view props by mode ────────────────────────────────────────────────
  const mapSparrings  = mapMode === 'sparrings' ? filteredSparrings : [];
  const mapEvents     = mapMode === 'events'    ? filteredEvents    : [];
  // Studios and bars/locations are no longer shown as markers. The venue
  // profile is reached via the "Location ansehen" button on the event card.

  return (
    <View style={styles.root}>
      <SparringMapView
        sparrings={mapSparrings}
        studioDots={[]}
        events={mapEvents}
        onSparringPress={handleSparringMarkerPress}
        // Selected while its preview or detail window is shown.
        activeSparringId={selected?.id ?? (showSparringCards ? preview?.id ?? null : null)}
        onStudioPress={(studio) => navigation.navigate('GymDetail', { gymId: studio.id })}
        onEventPress={setSelectedEvent}
        venueDots={[]}
        onVenuePress={(venue) => navigation.navigate('VenueDetail', { venueId: venue.id })}
        startRegion={startRegion}
        overlayTop={mapTopHeight}
        overlayBottom={bottomHeight + 8}
        onUserRegionChange={handleUserRegionChange}
      />

      {/* ── List view: same hits as the markers, over the (still mounted) map ── */}
      {showList && (
        <View style={StyleSheet.absoluteFill}>
          <SparringListView
            sparrings={filteredSparrings}
            status={nearbyStatus}
            locationStatus={locationStatus}
            radiusKm={radiusKm}
            currentUserId={user?.id ?? null}
            topInset={topBarHeight + 8}
            bottomInset={bottomSafe + LIST_BOTTOM_SPACE}
            onPress={handleListPress}
            onRetry={refetchNearby}
            onPickLocation={() => setLocationPickerVisible(true)}
            onWiden={widen}
            onCreate={() => { if (requireVerified() && requireCreator()) openCreateFlow(); }}
          />
        </View>
      )}

      {/* ── Top overlay: one warm panel with title, category, search, time ── */}
      <View
        style={[styles.topBar, { paddingTop: insets.top + 8 }]}
        pointerEvents="box-none"
        onLayout={handleTopLayout}
      >
        {/* Full-screen modal entry (gym page, profile, notifications) has no tab bar: offer a way back */}
        <SparringMapHeader onBack={route.name === 'SparringMap' && navigation.canGoBack() ? () => navigation.goBack() : undefined}>
          {/* Only one mode while events are paused — no single-option toggle. */}
          {SHOW_EVENTS && (
            <MapModeToggle mode={mapMode} onChange={(m) => { setMapMode(m); setSearchOpen(false); setWatchFilter(null); }} />
          )}
          {mapMode === 'events' && watchFilter !== null && (
            <TouchableOpacity
              style={styles.watchChip}
              onPress={() => setWatchFilter(null)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('map.screen.removeFilter', { name: watchFilter.name ?? watchFilter.promotion })}
            >
              <Text style={styles.watchChipText} numberOfLines={1}>{watchFilter.name ?? watchFilter.promotion}</Text>
              <Ionicons name="close" size={16} color={colors.text} />
            </TouchableOpacity>
          )}
          {mapMode === 'sparrings' && (
            <SparringSearchBar
              view={view}
              onViewChange={changeView}
              locationLabel={placeJump?.label ?? searchLocation?.label ?? null}
              onLocationPress={searchLocation !== null ? handleLocationPress : () => setLocationPickerVisible(true)}
              radiusKm={radiusKm}
              onRadiusChange={chooseRadius}
              open={searchOpen}
              onOpenChange={setSearchOpen}
              onPlaceFound={handlePlaceFound}
              notice={searchNotice}
            />
          )}
          {showTimeFilter && (
            <MapTimeFilter
              value={timeFilter}
              onChange={setTimeFilter}
              tabCounts={activeTabCounts}
              emptyLabel={mapMode === 'sparrings' ? t('map.screen.loadingSparrings') : t('map.screen.noEvents')}
            />
          )}
        </SparringMapHeader>
      </View>

      {/* ── Bottom: sparring preview stacked above the controls ── */}
      <View
        style={[styles.bottomStack, { bottom: bottomSafe + 16 }]}
        pointerEvents="box-none"
        onLayout={(e) => setBottomHeight(e.nativeEvent.layout.height + bottomSafe + 16)}
      >
        {showSparringCards && preview !== null && (
          <SparringMapPreview
            sparring={preview}
            caption={tappedPreview === null ? t('map.screen.nearest') : null}
            onOpenDetails={() => setSelected(preview)}
            onClose={closePreview}
          />
        )}
        {showEmptyCard && (
          <SparringMapEmptyCard
            text={radiusKm === null ? t('map.screen.noUpcoming') : t('map.screen.noneInRadius', { km: radiusKm })}
            onWiden={widen}
            onClose={() => setEmptyClosedFor(searchKey)}
          />
        )}
        {mapMode === 'events' && watchFilter !== null && watchedEvents.length === 0 && !watchEmptyClosed && (
          <SparringMapEmptyCard
            text={watchFilter.name !== null
              ? t('map.screen.noWatchEventNamed', { name: watchFilter.name })
              : t('map.screen.noWatchEventPromotion', { promotion: watchFilter.promotion })}
            onWiden={null}
            onClose={() => setWatchEmptyClosed(true)}
            action={{
              label: t('map.screen.offerWatchEvent'),
              onPress: () => { if (requireVerified()) setCreateEventVisible(true); },
            }}
          />
        )}
        <MapBottomControls
          onChat={() => navigation.navigate('SparringChatList')}
          totalUnread={totalUnread}
          primaryLabel={mapMode === 'sparrings' ? t('map.screen.createSparring') : t('map.screen.createEvent')}
          onPrimary={() => {
            if (!requireVerified()) return;
            if (mapMode === 'sparrings') {
              if (requireCreator()) openCreateFlow();
            } else {
              setCreateEventVisible(true);
            }
          }}
        />
      </View>

      {/* ── Sparring detail sheet ── */}
      <SparringDetailSheet
        sparring={selected}
        currentUserId={user?.id ?? null}
        userTier={tier}
        onClose={() => {
          setConsentVisible(false);
          setCommitmentResult(null);
          setCancelAskVisible(false);
          joinFlow.reset();
          setSelected(null);
        }}
        onJoin={handleJoinSparring}
        onConfirm={() => { void handleConfirmSparring(); }}
        onCancelSignup={handleCancelSparringSignup}
        onDeactivate={handleDeactivateSparring}
        onEdit={handleEditSparring}
        onOpenChat={() => {
          if (selected === null) return;
          // Close the sheet first: it is a Modal above the navigator, so a
          // pushed screen would otherwise open underneath it.
          setConsentVisible(false);
          setCommitmentResult(null);
          setSelected(null);
          navigation.navigate('SparringGroupChat', {
            sparringId:    selected.id,
            sparringTitle: selected.title,
            scheduledAt:   selected.scheduled_at,
            durationMin:   selected.duration_min,
            isOrganizer:   selected.created_by === user?.id,
          });
        }}
        consentVisible={consentVisible}
        onConsentClose={() => setConsentVisible(false)}
        onConsentConfirm={(rulesVersion) => { void handleConfirmSparringConsent(rulesVersion); }}
        commitmentResult={commitmentResult}
        onCommitmentResultClose={() => setCommitmentResult(null)}
        cancelAskVisible={cancelAskVisible}
        onCancelAskClose={() => setCancelAskVisible(false)}
        onCancelAskConfirm={() => { void performCancelSparringSignup(); }}
        loading={actionLoading}
        joinFlow={joinFlow.view}
        onReachChanged={reach.refetch}
        onFindNearby={showNearbyAtDevice}
      />

      {/* ── Event detail sheet ── */}
      <EventDetailSheet
        event={selectedEvent}
        currentUserId={user?.id ?? null}
        onClose={() => setSelectedEvent(null)}
        onToggleSignup={handleToggleEventSignup}
        onDeactivate={handleDeactivateEvent}
        onOpenChat={() => {
          if (selectedEvent === null) return;
          // Close the sheet first (Modal above the navigator, see sparring chat).
          setSelectedEvent(null);
          navigation.navigate('EventGroupChat', {
            eventId:     selectedEvent.id,
            eventTitle:  selectedEvent.title,
            scheduledAt: selectedEvent.scheduled_at,
            durationMin: selectedEvent.duration_min,
            isOrganizer: selectedEvent.created_by === user?.id,
          });
        }}
        onOpenVenue={(venueId) => {
          setSelectedEvent(null);
          navigation.navigate('VenueDetail', { venueId });
        }}
        loading={actionLoading}
      />

      {/* ── Create sparring: full-screen three-step flow ── */}
      <CreateSparringFlow
        visible={createSheetVisible}
        coachStudio={coachStudio}
        initialGym={createGymId !== null ? createGym : null}
        onClose={() => setCreateSheetVisible(false)}
        onPublished={(sparringId) => {
          setCreateSheetVisible(false);
          refetchSparrings();
          reach.refetch();
          navigation.setParams({ focusSparringId: sparringId });
        }}
        onSubscriptionRequired={() => {
          // Close the flow first so the paywall opens above the content.
          // The draft stays in the flow for the next attempt.
          setCreateSheetVisible(false);
          void refetchStoreEntitlements();
          if (subscriptionRejection(storeEntitlements.creatorActive) === 'activating') {
            Alert.alert(t('map.screen.subscriptionActivatingTitle'), t('map.screen.subscriptionActivatingMessage'));
            return;
          }
          Alert.alert(t('map.screen.creatorRequiredTitle'), t('map.screen.creatorRequiredMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('map.screen.viewSubscriptions'), onPress: () => navigation.navigate('Paywall', { focus: 'creator' }) },
          ]);
        }}
        onOpenSparring={focusSparring}
        onShowNearby={showNearbyAtDevice}
      />

      {/* One-time intro before the first create */}
      <ReachIntroSheet
        visible={createIntroVisible}
        mode="intro"
        busy={createIntroBusy}
        error={createIntroError}
        onPrimary={() => { void handleCreateIntroNext(); }}
        onSecondary={() => setCreateIntroVisible(false)}
        onClose={() => setCreateIntroVisible(false)}
      />

      {/* ── Edit sheet (organizer) ── */}
      <CreateSparringSheet
        visible={editVisible}
        mode="user"
        editing={editTarget}
        onClose={() => setEditVisible(false)}
        onCreate={async () => {}}
        onSaveEdit={handleSaveEdit}
      />

      {/* ── Create event sheet ── */}
      <CreateEventSheet
        visible={createEventVisible}
        onClose={() => setCreateEventVisible(false)}
        initialFightCard={watchFilter !== null ? (watchFilter.name ?? undefined) : undefined}
        onCreate={async (params) => {
          const { error, eventId } = await createEvent(params);
          if (error !== null) {
            Alert.alert(t('common.error'), error);
            return;
          }
          refetchEvents();
          // Defer opening the payment sheet so iOS does not present two modals at once.
          if (eventId !== undefined) {
            paymentTimerRef.current = setTimeout(() => setPaymentEventId(eventId), 400);
          }
        }}
      />

      {/* ── Event payment sheet ── */}
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
      <LocationPickerModal
        visible={locationPickerVisible}
        onClose={() => setLocationPickerVisible(false)}
        onConfirm={(lat, lng, displayAddress) => {
          setLocationPickerVisible(false);
          void setManual(lat, lng, displayAddress);
        }}
      />
    </View>
  );
}

// Camera zoom after a place search: roughly one city.
const PLACE_JUMP_RADIUS_KM = 10;

// Room below the last list row for the bottom controls.
const LIST_BOTTOM_SPACE = 104;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  watchChip: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'flex-start',
    gap:               8,
    minHeight:         32,
    marginTop:         8,
    paddingHorizontal: 16,
    borderRadius:      16,
    backgroundColor:   colors.accentBlueSoft,
  },
  watchChipText: {
    flexShrink: 1,
    fontSize:   14,
    fontWeight: '600',
    color:      colors.text,
  },
  topBar: {
    position:          'absolute',
    top:               0,
    left:              0,
    right:             0,
    paddingHorizontal: 16,
  },
  bottomStack: {
    position: 'absolute',
    left:     16,
    right:    16,
    gap:      8,
  },
});
