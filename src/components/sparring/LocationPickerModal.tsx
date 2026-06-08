import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

type Coord = { latitude: number; longitude: number };

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const FALLBACK: Region = {
  latitude: 48.14,
  longitude: 11.58,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (lat: number, lng: number, displayAddress: string) => void;
};

export default function LocationPickerModal({ visible, onClose, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const [region, setRegion] = useState<Region>(FALLBACK);
  const [marker, setMarker] = useState<Coord | null>(null);
  const [displayAddress, setDisplayAddress] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  // Center map on user location when modal opens
  useEffect(() => {
    if (!visible) return;
    setMarker(null);
    setDisplayAddress('');
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return;
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(
        ({ coords }) => {
          setRegion({
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });
        },
      );
    });
  }, [visible]);

  async function handleMapPress(e: { nativeEvent: { coordinate: Coord } }): Promise<void> {
    const coord = e.nativeEvent.coordinate;
    setMarker(coord);
    setGeocoding(true);
    setDisplayAddress('');
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: coord.latitude,
        longitude: coord.longitude,
      });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.street, r.streetNumber, r.postalCode, r.city].filter(
          (p): p is string => typeof p === 'string' && p.length > 0,
        );
        setDisplayAddress(
          parts.length > 0
            ? parts.join(' ')
            : `${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`,
        );
      } else {
        setDisplayAddress(`${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`);
      }
    } catch {
      setDisplayAddress(`${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`);
    } finally {
      setGeocoding(false);
    }
  }

  function handleConfirm(): void {
    if (marker === null || geocoding) return;
    onConfirm(marker.latitude, marker.longitude, displayAddress);
    setMarker(null);
    setDisplayAddress('');
  }

  function handleClose(): void {
    setMarker(null);
    setDisplayAddress('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.root}>
        <MapView
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          region={region}
          onRegionChangeComplete={setRegion}
          onPress={handleMapPress}
          showsUserLocation
        >
          {marker !== null && (
            <Marker coordinate={marker} pinColor={colors.accentBlue} />
          )}
        </MapView>

        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleClose} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Ort auf Karte wählen</Text>
          {/* invisible spacer keeps title centered */}
          <View style={styles.iconBtn} />
        </View>

        {/* Bottom info + confirm bar */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
          {marker === null ? (
            <Text style={styles.hint}>Auf die Karte tippen, um einen Ort zu markieren</Text>
          ) : (
            <>
              <View style={styles.addressRow}>
                <Ionicons name="location" size={18} color={colors.accentBlue} />
                {geocoding ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.accentBlue}
                    style={styles.spinner}
                  />
                ) : (
                  <Text style={styles.addressText} numberOfLines={2}>
                    {displayAddress}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={[styles.confirmBtn, geocoding && styles.confirmBtnDisabled]}
                onPress={handleConfirm}
                disabled={geocoding}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmBtnText}>Diesen Ort verwenden</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    flex: 1,
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  iconBtn: {
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
    elevation: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 24,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  hint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingBottom: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    minHeight: 40,
  },
  spinner: {
    marginLeft: 4,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  confirmBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
  },
});
