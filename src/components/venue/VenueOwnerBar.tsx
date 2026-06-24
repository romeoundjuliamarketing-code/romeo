import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface Props {
  onEditProfile:  () => void;
  onCreateEvent:  () => void;
}

export default function VenueOwnerBar({ onEditProfile, onCreateEvent }: Props): React.ReactElement {
  return (
    <View style={styles.container}>
      {/* Edit venue profile */}
      <TouchableOpacity
        style={styles.chip}
        activeOpacity={0.8}
        onPress={onEditProfile}
      >
        <Ionicons name="create-outline" size={16} color={colors.textPrimary} />
        <Text style={styles.chipLabel}>Profil bearbeiten</Text>
      </TouchableOpacity>

      {/* Create event placeholder — Task 10 will wire the real sheet */}
      <TouchableOpacity
        style={styles.chip}
        activeOpacity={0.8}
        onPress={onCreateEvent}
      >
        <Ionicons name="calendar-outline" size={16} color={colors.textPrimary} />
        <Text style={styles.chipLabel}>Event anlegen</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
