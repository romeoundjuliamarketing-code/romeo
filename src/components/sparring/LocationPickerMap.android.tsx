import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Map,
  Camera,
  Marker,
  UserLocation,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { LocationPickerMapProps } from './LocationPickerMap.types';

// MapLibre + OpenFreeMap tiles — no API key, no cost. Mirrors SparringMapView.android.tsx.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
// Without a position: Germany overview instead of a made-up city.
const OVERVIEW_CENTER: [number, number] = [10.4, 51.2]; // [lng, lat] GeoJSON order
const OVERVIEW_ZOOM = 5;
const USER_ZOOM = 13;

export default function LocationPickerMap({
  initialCenter,
  centerOn,
  marker,
  onPress,
  showsUserLocation = false,
}: LocationPickerMapProps) {
  const cameraRef = useRef<CameraRef>(null);

  useEffect(() => {
    if (centerOn === null) return;
    cameraRef.current?.setStop({
      center: [centerOn.longitude, centerOn.latitude],
      zoom: USER_ZOOM,
      duration: 600,
    });
  }, [centerOn]);

  return (
    <Map
      mapStyle={MAP_STYLE}
      style={styles.map}
      onPress={(e) => {
        const [lng, lat] = e.nativeEvent.lngLat;
        onPress(lat, lng);
      }}
    >
      <Camera ref={cameraRef} initialViewState={
          initialCenter !== null
            ? { center: [initialCenter.longitude, initialCenter.latitude], zoom: USER_ZOOM }
            : { center: OVERVIEW_CENTER, zoom: OVERVIEW_ZOOM }
        } />
      {showsUserLocation && <UserLocation />}
      {marker !== null && (
        <Marker lngLat={[marker.longitude, marker.latitude]}>
          <View style={styles.pin}>
            <Ionicons name="location" size={32} color={colors.accentBlue} />
          </View>
        </Marker>
      )}
    </Map>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  pin: { alignItems: 'center', justifyContent: 'center' },
});
