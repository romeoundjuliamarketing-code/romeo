import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import LocationPickerMap from './LocationPickerMap';
import { useTranslation } from 'react-i18next';

type Coord = { latitude: number; longitude: number };

const START_TIMEOUT_MS = 5000;

function toCoord(c: { latitude: number; longitude: number }): Coord {
  return { latitude: c.latitude, longitude: c.longitude };
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (lat: number, lng: number, displayAddress: string) => void;
  /** False: only use an already granted permission, never prompt (onboarding "choose myself"). */
  askPermission?: boolean;
};

export default function LocationPickerModal({ visible, onClose, onConfirm, askPermission = true }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // 'pending' until the start position is known: the map mounts directly at
  // the user instead of a fixed city (a later camera jump is unreliable while
  // the map is still loading). null = no position, overview of Germany.
  const [start, setStart] = useState<Coord | null | 'pending'>('pending');
  const [userCenter, setUserCenter] = useState<Coord | null>(null);
  const [marker, setMarker] = useState<Coord | null>(null);
  const [displayAddress, setDisplayAddress] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  // The iOS map asks for permission itself when it shows the user dot.
  const [locationGranted, setLocationGranted] = useState(askPermission);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setMarker(null);
    setDisplayAddress('');
    setUserCenter(null);
    setStart('pending');
    // Never keep the user waiting on a slow GPS fix: open without it.
    const timeout = setTimeout(() => {
      if (!cancelled) setStart((s) => (s === 'pending' ? null : s));
    }, START_TIMEOUT_MS);

    void (async () => {
      try {
        const { status } = askPermission
          ? await Location.requestForegroundPermissionsAsync()
          : await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        setLocationGranted(status === 'granted');
        if (status !== 'granted') { setStart(null); return; }
        // Last known position is instant; the fresh fix refines it afterwards.
        const last = await Location.getLastKnownPositionAsync();
        if (cancelled) return;
        if (last !== null) {
          setStart((s) => (s === 'pending' ? toCoord(last.coords) : s));
        }
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const coord = toCoord(current.coords);
        setStart((s) => (s === 'pending' ? coord : s));
        setUserCenter(coord);
      } catch {
        if (!cancelled) setStart((s) => (s === 'pending' ? null : s));
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [visible, askPermission]);

  async function handleMapPress(latitude: number, longitude: number): Promise<void> {
    const coord: Coord = { latitude, longitude };
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
        {start === 'pending' ? (
          <View style={styles.locating}>
            <ActivityIndicator color={colors.accentBlue} />
            <Text style={styles.locatingText}>{t('map.picker.locating')}</Text>
          </View>
        ) : (
          <LocationPickerMap
            initialCenter={start}
            centerOn={userCenter}
            marker={marker}
            onPress={handleMapPress}
            showsUserLocation={locationGranted}
          />
        )}

        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleClose} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('map.picker.title')}</Text>
          {/* invisible spacer keeps title centered */}
          <View style={styles.iconBtn} />
        </View>

        {/* Bottom info + confirm bar */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
          {marker === null ? (
            <Text style={styles.hint}>{t('map.picker.hint')}</Text>
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
                <Text style={styles.confirmBtnText}>{t('map.picker.confirm')}</Text>
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
  locating: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  locatingText: {
    fontSize: 15,
    color: colors.textMuted,
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
