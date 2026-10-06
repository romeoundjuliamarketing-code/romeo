import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { colors } from '../../theme/colors';
import type { LocationPickerMapProps } from './LocationPickerMap.types';

// Apple Maps (PROVIDER_DEFAULT) — no API key required on iOS.
// Without a position: Germany overview instead of a made-up city.
const OVERVIEW_REGION = {
  latitude: 51.2,
  longitude: 10.4,
  latitudeDelta: 9,
  longitudeDelta: 9,
};
const USER_DELTA = 0.05;

export default function LocationPickerMap({
  initialCenter,
  centerOn,
  marker,
  onPress,
  showsUserLocation = false,
}: LocationPickerMapProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (centerOn === null) return;
    mapRef.current?.animateToRegion(
      {
        latitude: centerOn.latitude,
        longitude: centerOn.longitude,
        latitudeDelta: USER_DELTA,
        longitudeDelta: USER_DELTA,
      },
      600,
    );
  }, [centerOn]);

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_DEFAULT}
      style={styles.map}
      initialRegion={
        initialCenter !== null
          ? { ...initialCenter, latitudeDelta: USER_DELTA, longitudeDelta: USER_DELTA }
          : OVERVIEW_REGION
      }
      onPress={(e) => onPress(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}
      showsUserLocation={showsUserLocation}
    >
      {marker !== null && <Marker coordinate={marker} pinColor={colors.accentBlue} />}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
