import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert, PanResponder, Image } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useOpenSparrings } from '../hooks/useOpenSparrings';
import { useSparringActions } from '../hooks/useSparringActions';
import { useStudio } from '../hooks/useStudio';
import { useStudioAddress } from '../hooks/useStudioAddress';
import { useStudioMapMarkers } from '../hooks/useStudioMapMarkers';
import type { StudioMapMarker } from '../hooks/useStudioMapMarkers';
import SparringDetailSheet from '../components/sparring/SparringDetailSheet';
import CreateSparringSheet from '../components/sparring/CreateSparringSheet';
import StudioMapDetailSheet from '../components/sparring/StudioMapDetailSheet';
import type { SparringWithMeta } from '../hooks/useOpenSparrings';

const ORANGE_COLOR = '#F5820A'; // Demnächst-Marker
const STUDIO_GREEN = '#22C55E'; // Studio-Sparring am eigenen Standort

const FALLBACK_REGION = {
  latitude: 48.14,
  longitude: 11.58,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

interface NavProp {
  goBack(): void;
  canGoBack(): boolean;
}

type Props = { navigation: NavProp };

type TimeFilter = 'all' | 'jetzt' | 'demnaechst' | 'bald';

// Returns which time-window bucket an ISO date string falls into
function getTimeWindow(isoDate: string): 'jetzt' | 'demnaechst' | 'bald' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sparringDay = new Date(isoDate);
  sparringDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (sparringDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return 'jetzt';
  if (diffDays <= 7) return 'demnaechst';
  return 'bald';
}

// Icon config per time-window bucket
const MARKER_CONFIGS = {
  jetzt:      { iconStyle: 'markerJetzt'      as const, icon: 'flame'        as const, size: 20 }, // rot
  demnaechst: { iconStyle: 'markerDemnaechst' as const, icon: 'calendar'     as const, size: 18 }, // orange
  bald:       { iconStyle: 'markerBald'       as const, icon: 'time-outline' as const, size: 18 }, // blau
};

// Coloured pin rendered as a custom MapView marker child
function SparringMarker({ window: tw }: { window: 'jetzt' | 'demnaechst' | 'bald' }): React.ReactElement {
  const { iconStyle, icon, size } = MARKER_CONFIGS[tw];
  return (
    <View style={[styles.markerBase, styles[iconStyle]]}>
      <Ionicons name={icon} size={size} color={colors.card} />
    </View>
  );
}

// Official Sparr-Sparring marker — shows the app logo + "Sparr Pick" label
function FeaturedMarker(): React.ReactElement {
  return (
    <View style={styles.featuredMarkerWrapper}>
      <View style={styles.featuredMarkerBase}>
        <Image
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          source={require('../../assets/logo-home.png')}
          style={styles.featuredLogo}
          resizeMode="contain"
        />
      </View>
      <View style={styles.featuredLabel}>
        <Text style={styles.featuredLabelText}>Sparr Pick</Text>
      </View>
    </View>
  );
}

// Studio location marker for Studios mode
function StudioMarker(): React.ReactElement {
  return (
    <View style={styles.studioMarkerBase}>
      <Ionicons name="business" size={20} color={colors.card} />
    </View>
  );
}

// Studio-hosted sparring at own location — always green
function AtStudioMarker(): React.ReactElement {
  return (
    <View style={[styles.markerBase, styles.markerAtStudio]}>
      <Ionicons name="shield-checkmark" size={18} color={colors.card} />
    </View>
  );
}

const FILTER_TABS: Array<{ key: Exclude<TimeFilter, 'all'>; label: string }> = [
  { key: 'jetzt',      label: 'Jetzt' },
  { key: 'demnaechst', label: 'Demnächst' },
  { key: 'bald',       label: 'Bald' },
];

export default function SparringMapScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { sparrings, refetch } = useOpenSparrings();
  const { signUp, cancelSignup, createSparring, deactivateSparring } = useSparringActions();
  const [selected, setSelected] = useState<SparringWithMeta | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [region, setRegion] = useState(FALLBACK_REGION);
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [mode, setMode] = useState<'sparrings' | 'studios'>('sparrings');
  const [selectedStudio, setSelectedStudio] = useState<StudioMapMarker | null>(null);

  const { currentStudio } = useStudio();
  const { address: studioAddress, lat: studioLat, lng: studioLng } = useStudioAddress(
    currentStudio?.id ?? '',
  );
  const { studios: studioMarkers } = useStudioMapMarkers();

  const coachStudio =
    currentStudio !== null &&
    studioAddress !== null &&
    studioAddress.trim().length > 0
      ? {
          id: currentStudio.id,
          address: studioAddress,
          lat: studioLat,
          lng: studioLng,
        }
      : null;

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return;
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(
        ({ coords }) => {
          setRegion({
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 2,
            longitudeDelta: 2,
          });
        },
      );
    });
  }, []);

  const withCoords = sparrings.filter((s) => s.lat !== null && s.lng !== null);

  // ── Zoom slider ───────────────────────────────────────────────────────────
  // thumbY: 0 = top = most zoomed in, TRACK_HEIGHT = bottom = most zoomed out
  const TRACK_HEIGHT  = 160;
  const THUMB_SIZE    = 28;
  const LOG_MIN       = Math.log(0.005); // max zoom in
  const LOG_MAX       = Math.log(60);    // max zoom out
  const INITIAL_THUMB = TRACK_HEIGHT / 2;

  const [thumbY, setThumbY]       = useState(INITIAL_THUMB);
  const gestureStartY             = useRef(INITIAL_THUMB);
  const thumbYRef                 = useRef(INITIAL_THUMB);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        gestureStartY.current = thumbYRef.current;
      },
      onPanResponderMove: (_evt, gs) => {
        const next = Math.max(0, Math.min(TRACK_HEIGHT, gestureStartY.current + gs.dy));
        thumbYRef.current = next;
        setThumbY(next);
        const t     = next / TRACK_HEIGHT;
        const delta = Math.exp(LOG_MIN + t * (LOG_MAX - LOG_MIN));
        setRegion((r) => ({ ...r, latitudeDelta: delta, longitudeDelta: delta }));
      },
    }),
  ).current;
  const filtered = timeFilter === 'all'
    ? withCoords
    : withCoords.filter((s) => getTimeWindow(s.scheduled_at) === timeFilter);

  async function handleToggleSignup(): Promise<void> {
    if (selected === null) return;
    setActionLoading(true);
    const { error } = await (selected.is_signed_up
      ? cancelSignup(selected.id)
      : signUp(selected.id));
    setActionLoading(false);
    if (error !== null) return;
    refetch();
    setSelected(null);
  }

  function handleDeactivate(): void {
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
            refetch();
            setSelected(null);
          },
        },
      ],
    );
  }

  return (
    <View style={styles.root}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
      >
        {/* Sparring markers */}
        {mode === 'sparrings' && filtered.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat!, longitude: s.lng! }}
            onPress={() => setSelected(s)}
            tracksViewChanges={false}
          >
            {s.is_featured
              ? <FeaturedMarker />
              : s.is_at_studio
                ? <AtStudioMarker />
                : <SparringMarker window={getTimeWindow(s.scheduled_at)} />
            }
          </Marker>
        ))}

        {/* Studio markers */}
        {mode === 'studios' && studioMarkers.map((st) => (
          <Marker
            key={st.id}
            coordinate={{ latitude: st.lat, longitude: st.lng }}
            onPress={() => setSelectedStudio(st)}
            tracksViewChanges={false}
          >
            <StudioMarker />
          </Marker>
        ))}
      </MapView>

      {/* Vertical zoom slider */}
      <View style={styles.zoomSliderOuter} pointerEvents="box-none">
        <Ionicons name="add" size={16} color={colors.textSecondary} />
        <View style={[styles.zoomTrackWrapper, { height: TRACK_HEIGHT + THUMB_SIZE }]}>
          <View style={styles.zoomTrack} />
          <View
            style={[styles.zoomThumb, { top: thumbY - THUMB_SIZE / 2 }]}
            {...panResponder.panHandlers}
          />
        </View>
        <Ionicons name="remove" size={16} color={colors.textSecondary} />
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        {/* Mode switch — always visible */}
        <View style={styles.modeSwitchRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'sparrings' && styles.modeBtnActive]}
            onPress={() => setMode('sparrings')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeBtnText, mode === 'sparrings' && styles.modeBtnTextActive]}>
              Sparrings
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'studios' && styles.modeBtnActive]}
            onPress={() => setMode('studios')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeBtnText, mode === 'studios' && styles.modeBtnTextActive]}>
              Studios
            </Text>
          </TouchableOpacity>
        </View>

        {/* Time filter — only in Sparrings mode */}
        {mode === 'sparrings' && (
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.closeBtn, timeFilter === 'all' && styles.closeBtnDimmed]}
              onPress={() => setTimeFilter('all')}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.segmentGroup}>
              {FILTER_TABS.map((tab) => {
                const count = sparrings.filter(
                  (s) => getTimeWindow(s.scheduled_at) === tab.key,
                ).length;
                const isActive = timeFilter === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.segment, isActive && styles.segmentActive]}
                    onPress={() => setTimeFilter(tab.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                      {`${tab.label} (${count})`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      <SparringDetailSheet
        sparring={selected}
        currentUserId={user?.id ?? null}
        onClose={() => setSelected(null)}
        onToggleSignup={handleToggleSignup}
        onDeactivate={handleDeactivate}
        loading={actionLoading}
      />

      {mode === 'sparrings' && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 16 }]}
          onPress={() => setCreateSheetVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={22} color={colors.card} />
          <Text style={styles.fabText}>Sparring anmelden</Text>
        </TouchableOpacity>
      )}

      <CreateSparringSheet
        visible={createSheetVisible}
        mode="user"
        coachStudio={coachStudio}
        onClose={() => setCreateSheetVisible(false)}
        onCreate={async (params) => {
          const { error } = await createSparring(params);
          if (error !== null) {
            Alert.alert('Fehler', error);
            return;
          }
          refetch();
        }}
      />

      <StudioMapDetailSheet
        studio={selectedStudio}
        onClose={() => setSelectedStudio(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 16,
    gap: 0,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  closeBtnDimmed: {
    opacity: 0.35,
  },
  segmentGroup: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 4,
    height: 40,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  segment: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.accentBlue,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.card,
  },
  markerBase: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  markerJetzt:      { backgroundColor: colors.deleteRed },
  markerDemnaechst: { backgroundColor: ORANGE_COLOR },
  markerBald:       { backgroundColor: colors.accentBlue },
  featuredMarkerWrapper: {
    alignItems: 'center',
    gap:        4,
  },
  featuredMarkerBase: {
    width:           48,
    height:          48,
    borderRadius:    24,
    backgroundColor: colors.card,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
    borderColor:     colors.accentBlue,
    shadowColor:     colors.dark,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.25,
    shadowRadius:    6,
  },
  featuredLogo: {
    width:  32,
    height: 32,
  },
  featuredLabel: {
    backgroundColor:  colors.accentBlue,
    borderRadius:     8,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  featuredLabelText: {
    fontSize:   10,
    fontWeight: '700',
    color:      colors.card,
    letterSpacing: 0.3,
  },
  zoomSliderOuter: {
    position:        'absolute',
    right:           16,
    top:             '30%',
    alignItems:      'center',
    gap:             8,
  },
  zoomTrackWrapper: {
    width:    28,
    alignItems: 'center',
  },
  zoomTrack: {
    position:        'absolute',
    top:             14,   // thumb radius — track starts centred inside thumb range
    bottom:          14,
    width:           4,
    borderRadius:    2,
    backgroundColor: colors.card,
    shadowColor:     colors.dark,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.15,
    shadowRadius:    4,
  },
  zoomThumb: {
    position:        'absolute',
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: colors.card,
    shadowColor:     colors.dark,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.25,
    shadowRadius:    4,
  },
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentBlue,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.card,
  },
  // ── Mode switch ─────────────────────────────────────────────────────────
  modeSwitchRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 4,
    height: 40,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    alignSelf: 'center',
  },
  modeBtn: {
    paddingHorizontal: 20,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnActive: {
    backgroundColor: colors.accentBlue,
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeBtnTextActive: {
    color: colors.card,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  // ── Studio marker ────────────────────────────────────────────────────────
  studioMarkerBase: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: colors.card,
  },
  // ── At-studio sparring marker ────────────────────────────────────────────
  markerAtStudio: {
    backgroundColor: STUDIO_GREEN,
  },
});
