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
import SparringDetailSheet from '../components/sparring/SparringDetailSheet';
import CreateSparringSheet from '../components/sparring/CreateSparringSheet';
import type { SparringWithMeta } from '../hooks/useOpenSparrings';

const ORANGE_COLOR = '#F5820A'; // Demnächst-Marker

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

// Official Sparr-Sparring marker — shows the app logo
function FeaturedMarker(): React.ReactElement {
  return (
    <View style={styles.featuredMarkerBase}>
      <Image
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source={require('../../assets/logo-home.png')}
        style={styles.featuredLogo}
        resizeMode="contain"
      />
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
        {filtered.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat!, longitude: s.lng! }}
            onPress={() => setSelected(s)}
            tracksViewChanges={false}
          >
            {s.is_featured
              ? <FeaturedMarker />
              : <SparringMarker window={getTimeWindow(s.scheduled_at)} />
            }
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
        {/* X resets active filter; dimmed when no filter is active */}
        <TouchableOpacity
          style={[styles.closeBtn, timeFilter === 'all' && styles.closeBtnDimmed]}
          onPress={() => setTimeFilter('all')}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={22} color={colors.text} />
        </TouchableOpacity>

        {/* Segmented time-window filter */}
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

      <SparringDetailSheet
        sparring={selected}
        currentUserId={user?.id ?? null}
        onClose={() => setSelected(null)}
        onToggleSignup={handleToggleSignup}
        onDeactivate={handleDeactivate}
        loading={actionLoading}
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={() => setCreateSheetVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle-outline" size={22} color={colors.card} />
        <Text style={styles.fabText}>Sparring anmelden</Text>
      </TouchableOpacity>

      <CreateSparringSheet
        visible={createSheetVisible}
        mode="user"
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
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
});
