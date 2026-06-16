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
const INITIAL_CENTER: [number, number] = [11.58, 48.14]; // [lng, lat] GeoJSON order
const INITIAL_ZOOM = 11;

export default function LocationPickerMap({
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
      zoom: 13,
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
      <Camera ref={cameraRef} initialViewState={{ center: INITIAL_CENTER, zoom: INITIAL_ZOOM }} />
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
