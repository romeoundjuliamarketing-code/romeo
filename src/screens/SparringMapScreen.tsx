import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useOpenSparrings } from '../hooks/useOpenSparrings';
import { useSparringActions } from '../hooks/useSparringActions';
import { useStudio } from '../hooks/useStudio';
import { useStudioAddress } from '../hooks/useStudioAddress';
import { useStudioMapMarkers } from '../hooks/useStudioMapMarkers';
import type { StudioMapMarker } from '../hooks/useStudioMapMarkers';
import SparringDetailSheet from '../components/sparring/SparringDetailSheet';
import CreateSparringSheet from '../components/sparring/CreateSparringSheet';
import StudioMapDetailSheet from '../components/sparring/StudioMapDetailSheet';
import SparringMapView from '../components/sparring/SparringMapView';
import { getTimeWindow } from '../utils/sparringTimeWindow';
import type { SparringWithMeta } from '../hooks/useOpenSparrings';

interface NavProp {
  goBack(): void;
  canGoBack(): boolean;
}

type Props = { navigation: NavProp };

type TimeFilter = 'all' | 'jetzt' | 'demnaechst' | 'bald';

const FILTER_TABS: Array<{ key: Exclude<TimeFilter, 'all'>; label: string }> = [
  { key: 'jetzt',      label: 'Jetzt' },
  { key: 'demnaechst', label: 'Demnächst' },
  { key: 'bald',       label: 'Bald' },
];

export default function SparringMapScreen({ navigation: _navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { sparrings, refetch } = useOpenSparrings();
  const { signUp, cancelSignup, createSparring, deactivateSparring } = useSparringActions();
  const [selected, setSelected]             = useState<SparringWithMeta | null>(null);
  const [actionLoading, setActionLoading]   = useState(false);
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
  const [timeFilter, setTimeFilter]         = useState<TimeFilter>('all');
  const [mode, setMode]                     = useState<'sparrings' | 'studios'>('sparrings');
  const [selectedStudio, setSelectedStudio] = useState<StudioMapMarker | null>(null);

  const { currentStudio } = useStudio();
  const { address: studioAddress, lat: studioLat, lng: studioLng } = useStudioAddress(
    currentStudio?.id ?? '',
  );
  const { studios: studioMarkers } = useStudioMapMarkers();

  const coachStudio =
    currentStudio !== null &&
    studioAddress !== null &&
    studioAddress.trim().length > 0
      ? {
          id: currentStudio.id,
          address: studioAddress,
          lat: studioLat,
          lng: studioLng,
        }
      : null;

  const withCoords = sparrings.filter((s) => s.lat !== null && s.lng !== null);
  const filtered   = timeFilter === 'all'
    ? withCoords
    : withCoords.filter((s) => getTimeWindow(s.scheduled_at) === timeFilter);

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
      <SparringMapView
        sparrings={filtered}
        studioMarkers={studioMarkers}
        mode={mode}
        onSparringPress={setSelected}
        onStudioPress={setSelectedStudio}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.closeBtn, timeFilter === 'all' && styles.closeBtnDimmed]}
            onPress={() => setTimeFilter('all')}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.segmentGroup}>
            {FILTER_TABS.map((tab) => {
              const count    = sparrings.filter((s) => getTimeWindow(s.scheduled_at) === tab.key).length;
              const isActive = timeFilter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.segment, isActive && styles.segmentActive]}
                  onPress={() => setTimeFilter(tab.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                    {`${tab.label} (${count})`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <SparringDetailSheet
        sparring={selected}
        currentUserId={user?.id ?? null}
        onClose={() => setSelected(null)}
        onToggleSignup={handleToggleSignup}
        onDeactivate={handleDeactivate}
        onBoostActivated={refetch}
        loading={actionLoading}
      />

      {mode === 'sparrings' && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 16 }]}
          onPress={() => setCreateSheetVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={22} color={colors.card} />
          <Text style={styles.fabText}>Sparring anmelden</Text>
        </TouchableOpacity>
      )}

      <CreateSparringSheet
        visible={createSheetVisible}
        mode="user"
        coachStudio={coachStudio}
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

      <StudioMapDetailSheet
        studio={selectedStudio}
        onClose={() => setSelectedStudio(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
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
  closeBtnDimmed: { opacity: 0.35 },
  segmentGroup: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 4,
    height: 40,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  segment: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.accentBlue },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentTextActive: { color: colors.card },
  fab: {
    position: 'absolute',
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
