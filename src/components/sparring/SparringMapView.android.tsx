import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, View, PanResponder, StyleSheet, Text, Image, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Map,
  Camera,
  Marker,
  UserLocation,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors } from '../../theme/colors';
import { getTimeWindow } from '../../utils/sparringTimeWindow';
import type { SparringMapViewProps } from './SparringMapView.types';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const INITIAL_CENTER: [number, number] = [11.58, 48.14]; // [lng, lat] GeoJSON order
const INITIAL_ZOOM = 5;
const MIN_ZOOM     = 1;
const MAX_ZOOM     = 16;

const TRACK_HEIGHT  = 160;
const THUMB_SIZE    = 28;
const INITIAL_THUMB = TRACK_HEIGHT / 2;

const MARKER_CONFIGS = {
  jetzt:      { iconStyle: 'markerJetzt'      as const, icon: 'flame'        as const, size: 20 },
  demnaechst: { iconStyle: 'markerDemnaechst' as const, icon: 'calendar'     as const, size: 18 },
  bald:       { iconStyle: 'markerBald'       as const, icon: 'time-outline' as const, size: 18 },
};

function SparringMarker({ window: tw }: { window: 'jetzt' | 'demnaechst' | 'bald' }) {
  const { iconStyle, icon, size } = MARKER_CONFIGS[tw];
  return (
    <View style={[styles.markerBase, styles[iconStyle]]}>
      <Ionicons name={icon} size={size} color={colors.card} />
    </View>
  );
}

function FeaturedMarker({ isAtStudio }: { isAtStudio: boolean }) {
  const ringColor = isAtStudio ? colors.studioGreen : colors.accentBlue;
  return (
    <View style={styles.featuredMarkerWrapper}>
      <View style={[styles.featuredMarkerBase, { borderColor: ringColor }]}>
        <Image
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          source={require('../../../assets/logo-home.png')}
          style={styles.featuredLogo}
          resizeMode="contain"
        />
      </View>
      <View style={[styles.featuredLabel, { backgroundColor: ringColor }]}>
        <Text style={styles.featuredLabelText}>Sparr Pick</Text>
      </View>
    </View>
  );
}

function SparringAtStudioMarker({ window: tw }: { window: 'jetzt' | 'demnaechst' | 'bald' }) {
  const { iconStyle, icon, size } = MARKER_CONFIGS[tw];
  return (
    <View style={styles.studioSparringWrapper}>
      <View style={[styles.markerBase, styles[iconStyle]]}>
        <Ionicons name={icon} size={size} color={colors.card} />
      </View>
      <View style={styles.studioBadgeCorner}>
        <Ionicons name="business" size={9} color={colors.card} />
      </View>
    </View>
  );
}

function StudioDotMarker() {
  return (
    <View style={styles.studioDotBase}>
      <Ionicons name="business" size={14} color={colors.card} />
    </View>
  );
}

function EventMarker() {
  return (
    <View style={styles.eventMarkerBase}>
      <MaterialCommunityIcons name="television-play" size={18} color={colors.card} />
    </View>
  );
}

export default function SparringMapView({
  sparrings,
  studioDots,
  onSparringPress,
  onStudioPress,
  totalUnread,
  onChatPress,
  events = [],
  onEventPress,
}: SparringMapViewProps) {
  const cameraRef     = useRef<CameraRef>(null);
  const insets        = useSafeAreaInsets();
  const thumbAnim     = useRef(new Animated.Value(INITIAL_THUMB)).current;
  const gestureStartY = useRef(INITIAL_THUMB);
  const thumbYRef     = useRef(INITIAL_THUMB);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      const { coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (cancelled) return;
      cameraRef.current?.setStop({
        center: [coords.longitude, coords.latitude],
        zoom: 10,
        duration: 1000,
      });
    })();
    return () => { cancelled = true; };
  }, []);

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
        thumbAnim.setValue(next);
        const t       = next / TRACK_HEIGHT; // 0=top=zoomed in, 1=bottom=zoomed out
        const newZoom = MAX_ZOOM - t * (MAX_ZOOM - MIN_ZOOM);
        cameraRef.current?.zoomTo(newZoom, { duration: 0 });
      },
    }),
  ).current;

  const sortedSparrings = useMemo(
    () => [...sparrings].sort((a, b) => Number(a.is_featured) - Number(b.is_featured)),
    [sparrings],
  );

  return (
    <View style={styles.root}>
      <Map mapStyle={MAP_STYLE} style={styles.map}>
        <Camera
          ref={cameraRef}
          initialViewState={{ center: INITIAL_CENTER, zoom: INITIAL_ZOOM }}
        />
        <UserLocation />

        {sortedSparrings.map((s) => (
          <Marker
            key={s.id}
            lngLat={[s.lng!, s.lat!]}
            onPress={() => onSparringPress(s)}
          >
            {s.is_featured
              ? <FeaturedMarker isAtStudio={s.is_at_studio} />
              : s.is_at_studio
                ? <SparringAtStudioMarker window={getTimeWindow(s.scheduled_at)} />
                : <SparringMarker window={getTimeWindow(s.scheduled_at)} />
            }
          </Marker>
        ))}

        {studioDots.map((st) => (
          <Marker
            key={`dot-${st.id}`}
            lngLat={[st.lng, st.lat]}
            onPress={() => onStudioPress(st)}
          >
            <StudioDotMarker />
          </Marker>
        ))}

        {events.filter((e) => e.lat !== null && e.lng !== null).map((e) => (
          <Marker
            key={`event-${e.id}`}
            lngLat={[e.lng!, e.lat!]}
            onPress={() => { if (onEventPress) onEventPress(e); }}
          >
            <EventMarker />
          </Marker>
        ))}
      </Map>

      <View style={styles.zoomSliderOuter} pointerEvents="box-none">
        <Ionicons name="add" size={16} color={colors.textSecondary} />
        <View style={[styles.zoomTrackWrapper, { height: TRACK_HEIGHT + THUMB_SIZE }]}>
          <View style={styles.zoomTrack} />
          <Animated.View
            style={[styles.zoomThumb, { top: Animated.subtract(thumbAnim, THUMB_SIZE / 2) }]}
            {...panResponder.panHandlers}
          />
        </View>
        <Ionicons name="remove" size={16} color={colors.textSecondary} />
      </View>

      <TouchableOpacity style={[styles.chatBtn, { bottom: insets.bottom + 16 }]} onPress={onChatPress} activeOpacity={0.85}>
        <Ionicons name="chatbubbles-outline" size={22} color={colors.card} />
        {totalUnread > 0 && (
          <View style={styles.chatBtnBadge}>
            <Text style={styles.chatBtnBadgeText}>
              {totalUnread > 99 ? '99+' : String(totalUnread)}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map:  { flex: 1 },
  markerBase: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  markerJetzt:      { backgroundColor: colors.deleteRed },
  markerDemnaechst: { backgroundColor: colors.sparringsOrange },
  markerBald:       { backgroundColor: colors.accentBlue },
  featuredMarkerWrapper: {
    alignItems: 'center',
    gap: 4,
  },
  featuredMarkerBase: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.accentBlue,
    elevation: 6,
  },
  featuredLogo: { width: 32, height: 32 },
  featuredLabel: {
    backgroundColor: colors.accentBlue,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  featuredLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.card,
    letterSpacing: 0.3,
  },
  studioSparringWrapper: {
    width: 44,
    height: 42,
  },
  studioBadgeCorner: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.studioGreen,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  studioDotBase: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  eventMarkerBase: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.sparringsOrange,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  zoomSliderOuter: {
    position: 'absolute',
    right: 16,
    top: '30%',
    alignItems: 'center',
    gap: 8,
  },
  zoomTrackWrapper: {
    width: 28,
    alignItems: 'center',
  },
  zoomTrack: {
    position: 'absolute',
    top: 14,
    bottom: 14,
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.card,
    elevation: 2,
  },
  zoomThumb: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.card,
    elevation: 4,
  },
  chatBtn: {
    position:        'absolute',
    bottom:          32,
    left:            16,
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: colors.dark,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     colors.dark,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.25,
    shadowRadius:    6,
    elevation:       6,
  },
  chatBtnBadge: {
    position:          'absolute',
    top:               -2,
    right:             -2,
    minWidth:          18,
    height:            18,
    borderRadius:      9,
    backgroundColor:   colors.deleteRed,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 3,
  },
  chatBtnBadgeText: {
    fontSize:   10,
    fontWeight: '700',
    color:      colors.card,
  },
});
