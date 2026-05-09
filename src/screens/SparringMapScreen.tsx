import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useOpenSparrings } from '../hooks/useOpenSparrings';
import { useSparringActions } from '../hooks/useSparringActions';
import SparringDetailSheet from '../components/sparring/SparringDetailSheet';
import CreateSparringSheet from '../components/sparring/CreateSparringSheet';
import type { SparringWithMeta } from '../hooks/useOpenSparrings';

const FALLBACK_REGION = {
  latitude: 48.14,
  longitude: 11.58,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

interface NavProp {
  goBack(): void;
  canGoBack(): boolean;
}

type Props = { navigation: NavProp };

export default function SparringMapScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { sparrings, refetch } = useOpenSparrings();
  const { signUp, cancelSignup, createSparring, deactivateSparring } = useSparringActions();
  const [selected, setSelected] = useState<SparringWithMeta | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [region, setRegion] = useState(FALLBACK_REGION);
  const [createSheetVisible, setCreateSheetVisible] = useState(false);

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return;
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(
        ({ coords }) => {
          setRegion({
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 2,
            longitudeDelta: 2,
          });
        },
      );
    });
  }, []);

  const withCoords = sparrings.filter((s) => s.lat !== null && s.lng !== null);

  async function handleToggleSignup(): Promise<void> {
    if (selected === null) return;
    setActionLoading(true);
    const { error } = await (selected.is_signed_up
      ? cancelSignup(selected.id)
      : signUp(selected.id));
    setActionLoading(false);
    if (error !== null) return;
    refetch();
    setSelected(null);
  }

  function handleDeactivate(): void {
    if (selected === null) return;
    Alert.alert(
      'Sparring absagen',
      `"${selected.title}" wirklich absagen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Absagen',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const { error } = await deactivateSparring(selected.id);
            setActionLoading(false);
            if (error !== null) {
              Alert.alert('Fehler', error);
              return;
            }
            refetch();
            setSelected(null);
          },
        },
      ],
    );
  }

  return (
    <View style={styles.root}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
      >
        {withCoords.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat!, longitude: s.lng! }}
            title={s.title}
            description={`${s.studio_name} · ${s.discipline}`}
            onPress={() => setSelected(s)}
          />
        ))}
      </MapView>

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        {navigation.canGoBack() && (
          <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
        )}
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {sparrings.length === 0
              ? 'Keine offenen Sparrings'
              : `${sparrings.length} Sparring${sparrings.length === 1 ? '' : 's'}`}
          </Text>
        </View>
      </View>

      <SparringDetailSheet
        sparring={selected}
        currentUserId={user?.id ?? null}
        onClose={() => setSelected(null)}
        onToggleSignup={handleToggleSignup}
        onDeactivate={handleDeactivate}
        loading={actionLoading}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setCreateSheetVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle-outline" size={22} color={colors.card} />
        <Text style={styles.fabText}>Sparring anmelden</Text>
      </TouchableOpacity>

      <CreateSparringSheet
        visible={createSheetVisible}
        mode="user"
        onClose={() => setCreateSheetVisible(false)}
        onCreate={async (params) => {
          const { error } = await createSparring(params);
          if (error !== null) {
            Alert.alert('Fehler', error);
            return;
          }
          refetch();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  closeBtn: {
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
  },
  countBadge: {
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentBlue,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.card,
  },
});
