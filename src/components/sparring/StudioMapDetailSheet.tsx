import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import type { StudioMapMarker } from '../../hooks/useStudioMapMarkers';

interface ActiveSparring {
  id: string;
  title: string;
  discipline: string;
  scheduled_at: string;
  signup_count: number;
  max_slots: number;
}

interface Props {
  studio: StudioMapMarker | null;
  onClose: () => void;
}

function formatScheduled(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StudioMapDetailSheet({ studio, onClose }: Props) {
  const [sparrings, setSparrings] = useState<ActiveSparring[]>([]);
  const [loadingSparrings, setLoadingSparrings] = useState(false);

  useEffect(() => {
    if (studio === null) {
      setSparrings([]);
      return;
    }

    void (async () => {
      setLoadingSparrings(true);
      try {
        const now = new Date().toISOString();

        const { data: rows } = await supabase
          .from('open_sparrings')
          .select('id, title, discipline, scheduled_at, max_slots')
          .eq('studio_id', studio.id)
          .eq('is_active', true)
          .gte('scheduled_at', now)
          .order('scheduled_at', { ascending: true })
          .limit(5);

        if (rows === null || rows.length === 0) {
          setSparrings([]);
          return;
        }

        const { data: signupData } = await supabase
          .from('sparring_signups')
          .select('sparring_id')
          .in('sparring_id', rows.map((r) => r.id));

        const countMap: Record<string, number> = {};
        for (const s of signupData ?? []) {
          countMap[s.sparring_id] = (countMap[s.sparring_id] ?? 0) + 1;
        }

        setSparrings(
          rows.map((r) => ({
            id: r.id,
            title: r.title,
            discipline: r.discipline,
            scheduled_at: r.scheduled_at,
            max_slots: r.max_slots,
            signup_count: countMap[r.id] ?? 0,
          })),
        );
      } finally {
        setLoadingSparrings(false);
      }
    })();
  }, [studio]);

  if (studio === null) return null;

  return (
    <Modal
      visible={studio !== null}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <View style={styles.studioIcon}>
            <Ionicons name="business" size={22} color={colors.card} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name}>{studio.name}</Text>
            <Text style={styles.city}>{studio.city}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {studio.address !== null && (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.address}>{studio.address}</Text>
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Aktive Sparrings</Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          {loadingSparrings ? (
            <ActivityIndicator color={colors.accentBlue} style={styles.loader} />
          ) : sparrings.length === 0 ? (
            <Text style={styles.empty}>Keine bevorstehenden Sparrings</Text>
          ) : (
            sparrings.map((s) => (
              <View key={s.id} style={styles.sparringRow}>
                <View style={styles.sparringLeft}>
                  <Text style={styles.sparringTitle}>{s.title}</Text>
                  <Text style={styles.sparringMeta}>
                    {s.discipline}  ·  {formatScheduled(s.scheduled_at)}
                  </Text>
                </View>
                <Text style={styles.sparringSlots}>
                  {s.signup_count}/{s.max_slots}
                </Text>
              </View>
            ))
          )}
          <View style={styles.bottomPad} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.mapOverlay,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '70%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  studioIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  city: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  address: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  loader: {
    marginVertical: 24,
  },
  empty: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: 24,
  },
  sparringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  sparringLeft: {
    flex: 1,
  },
  sparringTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  sparringMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sparringSlots: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  bottomPad: {
    height: 16,
  },
});
