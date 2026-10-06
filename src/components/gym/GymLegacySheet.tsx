import React from 'react';
import { Text, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import SheetShell from '../common/SheetShell';
import MyRequestsCard from '../profil/MyRequestsCard';

// Legacy access: trial trainings and memberships can no longer be started in
// Sparr, but whoever still has a running one sees its details and the
// existing actions (cancel a pending trial, request cancellation) here.
export default function GymLegacySheet({ visible, studioId, onClose }: {
  visible:  boolean;
  studioId: string;
  onClose:  () => void;
}): React.ReactElement {
  return (
    <SheetShell visible={visible} title="Bestehende Vorgänge" onClose={onClose}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          Neue Probetrainings und Mitgliedschaften gibt es in Sparr nicht mehr. Deine bestehenden Vorgänge mit diesem Gym findest du hier.
        </Text>
        {visible && <MyRequestsCard studioId={studioId} />}
      </ScrollView>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap:           16,
    paddingBottom: 16,
  },
  hint: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.textMuted,
  },
});
