import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { sparringMarkerLabel } from '../../utils/sparringMarkerLabel';
import { OVERVIEW_REGION } from '../../utils/mapStartRegion';
import type { MapRegion } from '../../utils/mapStartRegion';
import type { SparringMapViewProps } from './SparringMapView.types';
import type { VenueMapMarker } from '../../hooks/useVenueMapMarkers';
import ActiveMarkerScale from './ActiveMarkerScale';
import { SparringPin, FeaturedPin, StudioPin, EventPin, VenuePin } from './MapMarkers';

export default function SparringMapView({
  sparrings,
  studioDots,
  onSparringPress,
  activeSparringId,
  onStudioPress,
  events = [],
  onEventPress,
  venueDots,
  onVenuePress,
  startRegion,
  overlayTop,
  overlayBottom,
  onUserRegionChange,
}: SparringMapViewProps) {
  const mapRef         = useRef<MapView>(null);
  // Once the user touched the map, a late start region must not yank it away.
  const userTouchedRef = useRef(false);
  const mapReadyRef    = useRef(false);
  const appliedRef     = useRef<MapRegion | null>(null);
  // Set by a touch, cleared by our own camera moves: react-native-maps only reports
  // isGesture for Google Maps, so Apple Maps moves are attributed by touch instead.
  const touchedSinceMoveRef = useRef(false);

  // The first region respects a user who already panned; every later one is
  // an explicit search change (location/radius) and always moves the map.
  function applyStartRegion(): void {
    if (startRegion === null || !mapReadyRef.current || appliedRef.current === startRegion) return;
    if (appliedRef.current === null && userTouchedRef.current) return;
    appliedRef.current = startRegion;
    touchedSinceMoveRef.current = false;
    mapRef.current?.animateToRegion(startRegion, 500);
  }

  // Region and map readiness arrive in either order.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(applyStartRegion, [startRegion]);

  // The screen's overlays (header on top, controls/preview below) are measured
  // there; the map centers within the rest and keeps the Apple legal link
  // visible above the bottom controls.
  const mapPadding = useMemo(
    () => ({ top: overlayTop, bottom: overlayBottom, left: 0, right: 0 }),
    [overlayTop, overlayBottom],
  );

  const sortedSparrings = useMemo(
    () => [...sparrings].sort((a, b) => Number(a.is_featured) - Number(b.is_featured)),
    [sparrings],
  );

  return (
    <View
      style={styles.root}
      onTouchStart={() => {
        userTouchedRef.current = true;
        touchedSinceMoveRef.current = true;
      }}
    >
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={OVERVIEW_REGION}
        onMapReady={() => {
          mapReadyRef.current = true;
          applyStartRegion();
        }}
        mapPadding={mapPadding}
        onRegionChangeComplete={(region) => {
          if (!touchedSinceMoveRef.current) return;
          touchedSinceMoveRef.current = false;
          onUserRegionChange?.(region);
        }}
        // Standard base map keeps roads and place names readable; POIs are
        // hidden so the sparring markers stand out.
        mapType="standard"
        showsPointsOfInterests={false}
        showsUserLocation
      >
        {sortedSparrings.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat!, longitude: s.lng! }}
            onPress={() => onSparringPress(s)}
            tracksViewChanges={false}
            // Selected marker on top, then boosted ones.
            zIndex={s.id === activeSparringId ? 2 : s.is_featured ? 1 : 0}
          >
            <ActiveMarkerScale active={s.id === activeSparringId}>
              {s.is_featured
                ? <FeaturedPin atStudio={s.is_at_studio} active={s.id === activeSparringId} />
                : (
                  <SparringPin
                    label={sparringMarkerLabel(s.discipline, s.scheduled_at)}
                    atStudio={s.is_at_studio}
                    active={s.id === activeSparringId}
                  />
                )}
            </ActiveMarkerScale>
          </Marker>
        ))}

        {studioDots.map((st) => (
          <Marker
            key={`dot-${st.id}`}
            coordinate={{ latitude: st.lat, longitude: st.lng }}
            onPress={() => onStudioPress(st)}
            tracksViewChanges={false}
            zIndex={0}
          >
            <StudioPin />
          </Marker>
        ))}

        {events.filter((e) => e.lat !== null && e.lng !== null).map((e) => (
          <Marker
            key={`event-${e.id}`}
            coordinate={{ latitude: e.lat!, longitude: e.lng! }}
            onPress={() => { if (onEventPress) onEventPress(e); }}
            tracksViewChanges={false}
            zIndex={0}
          >
            <EventPin />
          </Marker>
        ))}

        {venueDots.map((venue: VenueMapMarker) => (
          <Marker
            key={`venue-${venue.id}`}
            coordinate={{ latitude: venue.lat, longitude: venue.lng }}
            onPress={() => onVenuePress(venue)}
            tracksViewChanges={false}
            zIndex={0}
          >
            <VenuePin />
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map:  { flex: 1 },
});
