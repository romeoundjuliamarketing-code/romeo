import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { PrimaryButton } from '../profil/ProfileParts';

// The viewer's own link to this gym, for a gym that is not yet their main
// gym. Only a profile self-declaration (profiles.home_gym_id): no join
// request, booking, payment or membership. Once it is the main gym, a small
// label in GymHero shows it and switching/removing sits in the page menu.
export default function GymHomeAction({ busy, onSet }: {
  busy:  boolean;
  onSet: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <PrimaryButton icon="add" label={t('gym.homeAction.label')} onPress={onSet} loading={busy} />
      <Text style={styles.hint}>{t('gym.homeAction.hint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  hint: {
    fontSize:   13,
    lineHeight: 18,
    color:      colors.textMuted,
  },
});
