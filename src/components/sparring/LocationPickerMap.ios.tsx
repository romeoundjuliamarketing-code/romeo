import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { colors } from '../../theme/colors';
import type { LocationPickerMapProps } from './LocationPickerMap.types';

// Apple Maps (PROVIDER_DEFAULT) — no API key required on iOS.
const FALLBACK_REGION = {
  latitude: 48.14,
  longitude: 11.58,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function LocationPickerMap({
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
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      600,
    );
  }, [centerOn]);

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_DEFAULT}
      style={styles.map}
      initialRegion={FALLBACK_REGION}
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
