import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { SparringWithMeta } from '../../hooks/useOpenSparrings';

// DACH region
const INITIAL_REGION = {
  latitude: 48.14,
  longitude: 11.58,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

interface Props {
  sparrings: SparringWithMeta[];
  onPress: () => void;
}

export default function SparringMapCard({ sparrings, onPress }: Props) {
  const withCoords = sparrings.filter((s) => s.lat !== null && s.lng !== null);
  const count = sparrings.length;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Offene Sparrings</Text>
        <Text style={styles.cardCount}>
          {count === 0 ? 'Keine' : `${count} offen`}
        </Text>
      </View>

      <View style={styles.mapWrap}>
        <MapView
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={INITIAL_REGION}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          pointerEvents="none"
        >
          {withCoords.map((s) => (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.lat!, longitude: s.lng! }}
            />
          ))}
        </MapView>

        <TouchableOpacity style={styles.overlay} onPress={onPress} activeOpacity={0.85}>
          <View style={styles.expandBtn}>
            <Ionicons name="expand-outline" size={16} color={colors.card} />
            <Text style={styles.expandLabel}>Karte öffnen</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  cardCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  mapWrap: {
    height: 160,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: 12,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.mapOverlay,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  expandLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.card,
  },
});
