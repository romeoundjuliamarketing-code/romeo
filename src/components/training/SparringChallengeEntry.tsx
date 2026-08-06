import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import SparrLogo from '../common/SparrLogo';
import { entryShadow } from '../challenge/cardLayout';

// A miniature Sparr card — same anthracite back and blue inset line as the deck.
function MiniCard(): React.ReactElement {
  return (
    <View style={styles.mini}>
      <View style={styles.miniBehind} />
      <View style={styles.miniCard}>
        <View style={styles.miniInner}>
          <SparrLogo size={18} />
        </View>
      </View>
    </View>
  );
}

interface Props {
  onPress: () => void;
}

export default function SparringChallengeEntry({ onPress }: Props): React.ReactElement {
  return (
    <TouchableOpacity
      style={[styles.card, entryShadow]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Sparrings-Challenge öffnen"
    >
      <MiniCard />
      <View style={styles.info}>
        <Text style={styles.title}>Sparrings-Challenge</Text>
        <Text style={styles.subtitle}>Zieh eine geheime Aufgabe für deine nächste Runde</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.accentBlue} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.accentBlueSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.headerTextSecondary,
  },

  mini: {
    width: 40,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBehind: {
    position: 'absolute',
    width: 32,
    height: 44,
    borderRadius: 6,
    backgroundColor: colors.cardBackEdge,
    transform: [{ translateX: 3 }, { translateY: -3 }, { rotate: '1.5deg' }],
  },
  miniCard: {
    width: 32,
    height: 44,
    borderRadius: 6,
    backgroundColor: colors.cardBack,
    padding: 4,
  },
  miniInner: {
    flex: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.accentBlueMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
