import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { TextAction } from '../common/TextAction';
import { BlockTitle } from '../profil/ProfileFacts';
import type { GymFighter, GymSparring, LoadStatus } from '../../hooks/useGyms';
import GymSparringList from './GymSparringList';
import GymFightersPreview from './GymFightersPreview';

// Team and sparrings of the gym page in the right order: with an upcoming
// sparring it leads, otherwise the team leads and the empty sparring block
// follows. The order is only decided once the sparrings have settled, so
// nothing jumps while the page builds up.
export default function GymMainSections({ fighters, sparrings, onOpenFighters, onOpenProfile, onOpenSparring, onPlan }: {
  fighters:       { fighters: GymFighter[]; total: number | null; status: LoadStatus; retry: () => void };
  sparrings:      { sparrings: GymSparring[]; status: LoadStatus; retry: () => void };
  onOpenFighters: () => void;
  onOpenProfile:  (userId: string) => void;
  onOpenSparring: (sparringId: string) => void;
  onPlan:         () => void;
}): React.ReactElement {
  const hasUpcoming = sparrings.sparrings.length > 0;
  if (sparrings.status === 'loading' && !hasUpcoming) return <ActivityIndicator color={colors.accentBlue} />;

  // Never "0" while loading: the count only shows once it is known.
  const team = (
    <View style={styles.block}>
      <BlockTitle action={fighters.fighters.length > 0 ? <TextAction label="Alle ansehen" onPress={onOpenFighters} /> : undefined}>
        {fighters.total !== null ? `Das Team · ${fighters.total}` : 'Das Team'}
      </BlockTitle>
      <GymFightersPreview fighters={fighters.fighters} status={fighters.status} retry={fighters.retry} onOpen={onOpenProfile} />
    </View>
  );
  const sparringBlock = (
    <View style={styles.block}>
      <BlockTitle action={hasUpcoming ? <TextAction label="Sparring planen" icon="add" onPress={onPlan} /> : undefined}>
        Sparrings im Gym
      </BlockTitle>
      <GymSparringList {...sparrings} onOpen={onOpenSparring} onOpenOrganizer={onOpenProfile} onPlan={onPlan} />
    </View>
  );

  return hasUpcoming ? <>{sparringBlock}{team}</> : <>{team}{sparringBlock}</>;
}

const styles = StyleSheet.create({
  block: {
    gap: 12,
  },
});
