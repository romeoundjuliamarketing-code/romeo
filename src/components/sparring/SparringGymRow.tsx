import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useGym } from '../../hooks/useGyms';

// Gym the sparring takes place at, plus the organizer's access note. Purely a
// place: the wording never suggests an offer or approval of the gym.
export default function SparringGymRow({ gymId, accessNote, onOpenGym }: {
  gymId:      string | null;
  accessNote: string | null;
  onOpenGym:  (gymId: string) => void;
}): React.ReactElement | null {
  const { gym } = useGym(gymId);
  const note = accessNote?.trim() ?? '';
  if (gym === null && note.length === 0) return null;
  return (
    <View style={styles.wrap}>
      {gym !== null && (
        <TouchableOpacity
          style={styles.row}
          onPress={() => onOpenGym(gym.id)}
          activeOpacity={0.6}
          accessibilityRole="link"
          accessibilityLabel={`Ort: ${gym.name}, ${gym.city}. Gym-Seite öffnen`}
        >
          <Ionicons name="business-outline" size={18} color={colors.accentBlue} />
          <Text style={styles.text}>
            Im Gym <Text style={styles.strong}>{gym.name}</Text>{gym.city.length > 0 ? `, ${gym.city}` : ''}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      )}
      {note.length > 0 && (
        <Text style={styles.note}>Zugang laut Organisator: {note}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    minHeight:     44,
  },
  text: {
    flex:       1,
    fontSize:   14,
    lineHeight: 20,
    color:      colors.text,
  },
  strong: {
    fontWeight: '700',
  },
  note: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.textMuted,
  },
});
