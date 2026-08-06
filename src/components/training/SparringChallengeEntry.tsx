import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { entryShadow } from '../challenge/cardLayout';

// Miniature deck — hints at what waits behind the tap without looking like an ad.
function MiniDeck(): React.ReactElement {
  return (
    <View style={styles.mini}>
      <View style={[styles.miniCard, styles.miniCardFar]} />
      <View style={[styles.miniCard, styles.miniCardNear]} />
      <View style={[styles.miniCard, styles.miniCardTop]}>
        <Ionicons name="flash" size={18} color={colors.accentBlue} />
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
      <MiniDeck />
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
    padding: 16,
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
    width: 48,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCard: {
    position: 'absolute',
    width: 32,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCardFar: {
    backgroundColor: colors.headerCard,
    borderWidth: 1,
    borderColor: colors.headerBorder,
    transform: [{ rotate: '-14deg' }, { translateX: -4 }],
  },
  miniCardNear: {
    backgroundColor: colors.headerCard,
    borderWidth: 1,
    borderColor: colors.headerBorder,
    transform: [{ rotate: '8deg' }, { translateX: 4 }],
  },
  miniCardTop: {
    backgroundColor: colors.background,
  },
});
