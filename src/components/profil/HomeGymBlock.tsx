import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { Gym } from '../../hooks/useGyms';
import GymBanner, { gymBannerReserve } from '../gym/GymBanner';
import { PressScale } from './ProfileParts';
import { QuietAdd } from './ProfileFacts';

// "Hier trainiere ich": the self-declared main gym as a flat, wide surface.
// Deliberately neutral wording — a self-declaration, not a confirmed
// membership or partnership. Without a gym: a quiet prompt on the own profile,
// nothing on foreign profiles.
export default function HomeGymBlock({ gym, onOpen, onAdd }: {
  gym:    Gym | null;
  onOpen: (gymId: string) => void;
  onAdd?: () => void;
}): React.ReactElement | null {
  if (gym === null) {
    return onAdd !== undefined ? <QuietAdd label="Gym hinzufügen" onPress={onAdd} /> : null;
  }
  return (
    <PressScale
      onPress={() => onOpen(gym.id)}
      style={styles.press}
      accessibilityLabel={`Hier trainiere ich: ${gym.name}${gym.city.length > 0 ? `, ${gym.city}` : ''}. Gym-Seite öffnen`}
    >
      <GymBanner name={gym.name} bannerUrl={gym.banner_url} logoUrl={gym.avatar_url} height={128}>
        <View style={[styles.content, { paddingRight: gymBannerReserve(gym.banner_url) }]}>
          <Text style={styles.label}>Hier trainiere ich</Text>
          <View style={styles.nameRow}>
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={2} maxFontSizeMultiplier={1.3}>{gym.name}</Text>
              {gym.city.length > 0 && <Text style={styles.city} numberOfLines={1}>{gym.city}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.headerTextPrimary} />
          </View>
        </View>
      </GymBanner>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  press: {
    width: '100%',
  },
  content: {
    flex:           1,
    minHeight:      128,
    justifyContent: 'space-between',
    gap:            16,
    padding:        16,
  },
  label: {
    fontSize:   13,
    fontWeight: '700',
    color:      colors.coverTextMuted,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    gap:           8,
  },
  flex: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.display,
    fontSize:   28,
    lineHeight: 30,
    color:      colors.headerTextPrimary,
  },
  city: {
    fontSize: 14,
    color:    colors.coverTextMuted,
  },
});
