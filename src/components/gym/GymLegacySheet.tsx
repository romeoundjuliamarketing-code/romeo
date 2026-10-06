import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <SheetShell visible={visible} title={t('gym.legacy.title')} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          {t('gym.legacy.hint')}
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
