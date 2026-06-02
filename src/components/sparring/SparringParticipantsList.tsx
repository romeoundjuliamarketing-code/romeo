import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';

// Maps DB gender value to short display label
const GENDER_LABEL: Record<string, string> = {
  male:   'M',
  female: 'W',
  other:  'D',
};

interface Participant {
  userId:    string;
  name:      string | null;
  avatarUrl: string | null;
  gender:    string | null;
}

interface Props {
  sparringId:          string;
  currentUserId:       string | null;
  sparringScheduledAt: string;
  onPressProfile:      (userId: string) => void;
}

// Derive up-to-2-letter initials from a display name
function getInitials(name: string | null): string {
  if (name === null || name.trim().length === 0) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export default function SparringParticipantsList({
  sparringId,
  currentUserId,
  onPressProfile,
}: Props): React.ReactElement | null {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void (async () => {
      const { data } = await supabase
        .from('sparring_signups')
        .select('user_id, profiles!user_id(name, avatar_url, gender)')
        .eq('sparring_id', sparringId);

      if (cancelled) return;

      type ProfileJoin = { name: string | null; avatar_url: string | null; gender: string | null } | null;

      const list: Participant[] = (data ?? [])
        .filter((row) => row.user_id !== currentUserId)
        .map((row) => {
          const p = row.profiles as ProfileJoin;
          return {
            userId:    row.user_id,
            name:      p?.name ?? null,
            avatarUrl: p?.avatar_url ?? null,
            gender:    p?.gender ?? null,
          };
        });

      setParticipants(list);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [sparringId, currentUserId]);

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={colors.accentBlue} />
      </View>
    );
  }

  if (participants.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Teilnehmer</Text>
      {participants.map((p) => (
        <TouchableOpacity
          key={p.userId}
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => { onPressProfile(p.userId); }}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(p.name)}</Text>
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{p.name ?? 'Unbekannt'}</Text>
            {p.gender !== null && GENDER_LABEL[p.gender] !== undefined && (
              <View style={styles.genderBadge}>
                <Text style={styles.genderBadgeText}>{GENDER_LABEL[p.gender]}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingRow: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  container: {
    borderTopWidth:  1,
    borderTopColor:  colors.border,
    paddingTop:      16,
    gap:             8,
  },
  sectionLabel: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.textSecondary,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           16,
    paddingVertical: 8,
  },
  avatar: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: colors.accentBlueSoft,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.accentBlue,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    flex:          1,
  },
  name: {
    fontSize:   15,
    fontWeight: '500',
    color:      colors.text,
  },
  genderBadge: {
    backgroundColor:   colors.accentBlueSoft,
    borderRadius:      6,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  genderBadgeText: {
    fontSize:   11,
    fontWeight: '700',
    color:      colors.accentBlue,
  },
});
