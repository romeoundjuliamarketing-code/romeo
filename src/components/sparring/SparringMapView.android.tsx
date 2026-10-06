import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Map,
  Camera,
  Marker,
  UserLocation,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { sparringMarkerLabel } from '../../utils/sparringMarkerLabel';
import { OVERVIEW_REGION } from '../../utils/mapStartRegion';
import type { MapRegion } from '../../utils/mapStartRegion';
import type { SparringMapViewProps } from './SparringMapView.types';
import type { VenueMapMarker } from '../../hooks/useVenueMapMarkers';
import ActiveMarkerScale from './ActiveMarkerScale';
import { SparringPin, FeaturedPin, StudioPin, EventPin, VenuePin } from './MapMarkers';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// Overview until the start region is decided ([lng, lat] GeoJSON order).
const INITIAL_CENTER: [number, number] = [OVERVIEW_REGION.longitude, OVERVIEW_REGION.latitude];
const INITIAL_ZOOM = 5;

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
  const cameraRef      = useRef<CameraRef>(null);
  // Once the user touched the map, a late start region must not yank it away.
  const userTouchedRef = useRef(false);
  const appliedRef     = useRef<MapRegion | null>(null);
  // Read at fit time only: a changing overlay must not re-fit the camera.
  const overlayRef     = useRef({ top: overlayTop, bottom: overlayBottom });
  overlayRef.current   = { top: overlayTop, bottom: overlayBottom };

  // The first region respects a user who already panned; every later one is
  // an explicit search change (location/radius) and always moves the map.
  useEffect(() => {
    if (startRegion === null || appliedRef.current === startRegion) return;
    if (appliedRef.current === null && userTouchedRef.current) return;
    appliedRef.current = startRegion;
    const halfLat = startRegion.latitudeDelta / 2;
    const halfLng = startRegion.longitudeDelta / 2;
    cameraRef.current?.fitBounds(
      [
        startRegion.longitude - halfLng,
        startRegion.latitude - halfLat,
        startRegion.longitude + halfLng,
        startRegion.latitude + halfLat,
      ],
      {
        duration: 800,
        // Fit the search area into the part the overlays leave free.
        padding:  { top: overlayRef.current.top, bottom: overlayRef.current.bottom, left: 16, right: 16 },
      },
    );
  }, [startRegion]);

  // Required attribution and logo stay visible above the bottom controls.
  const attributionPosition = useMemo(() => ({ bottom: overlayBottom + 8, right: 8 }), [overlayBottom]);
  const logoPosition        = useMemo(() => ({ bottom: overlayBottom + 8, left: 8 }), [overlayBottom]);

  const sortedSparrings = useMemo(
    () => [...sparrings].sort((a, b) => Number(a.is_featured) - Number(b.is_featured)),
    [sparrings],
  );

  return (
    <View style={styles.root} onTouchStart={() => { userTouchedRef.current = true; }}>
      <Map
        mapStyle={MAP_STYLE}
        style={styles.map}
        attributionPosition={attributionPosition}
        logoPosition={logoPosition}
        onRegionDidChange={(e) => {
          const { userInteraction, bounds } = e.nativeEvent;
          if (!userInteraction || onUserRegionChange === undefined) return;
          // [west, south, east, north]
          const [west, south, east, north] = bounds;
          onUserRegionChange({
            latitude:       (south + north) / 2,
            longitude:      (west + east) / 2,
            latitudeDelta:  north - south,
            longitudeDelta: east - west,
          });
        }}
      >
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
            lngLat={[st.lng, st.lat]}
            onPress={() => onStudioPress(st)}
          >
            <StudioPin />
          </Marker>
        ))}

        {events.filter((e) => e.lat !== null && e.lng !== null).map((e) => (
          <Marker
            key={`event-${e.id}`}
            lngLat={[e.lng!, e.lat!]}
            onPress={() => { if (onEventPress) onEventPress(e); }}
          >
            <EventPin />
          </Marker>
        ))}

        {venueDots.map((venue: VenueMapMarker) => (
          <Marker
            key={`venue-${venue.id}`}
            lngLat={[venue.lng, venue.lat]}
            onPress={() => onVenuePress(venue)}
          >
            <VenuePin />
          </Marker>
        ))}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map:  { flex: 1 },
});
