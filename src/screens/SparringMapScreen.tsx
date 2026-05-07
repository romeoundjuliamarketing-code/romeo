import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { useOpenSparrings } from '../hooks/useOpenSparrings';
import { useSparringActions } from '../hooks/useSparringActions';
import SparringDetailSheet from '../components/sparring/SparringDetailSheet';
import type { SparringWithMeta } from '../hooks/useOpenSparrings';

const INITIAL_REGION = {
  latitude: 48.14,
  longitude: 11.58,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

type Props = NativeStackScreenProps<RootStackParamList, 'SparringMap'>;

export default function SparringMapScreen({ navigation }: Props) {
  const { sparrings, refetch } = useOpenSparrings();
  const { signUp, cancelSignup } = useSparringActions();
  const [selected, setSelected] = useState<SparringWithMeta | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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

  return (
    <View style={styles.root}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={INITIAL_REGION}
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

      <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {sparrings.length === 0
              ? 'Keine offenen Sparrings'
              : `${sparrings.length} Sparring${sparrings.length === 1 ? '' : 's'}`}
          </Text>
        </View>
      </SafeAreaView>

      <SparringDetailSheet
        sparring={selected}
        onClose={() => setSelected(null)}
        onToggleSignup={handleToggleSignup}
        loading={actionLoading}
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
    paddingTop: 8,
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
});
