import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';
import SparrLogo, { prefetchSparrLogo } from '../common/SparrLogo';
import { CARD_ASPECT } from '../challenge/cardLayout';

// Same proportion as the real deck. The radius is deliberately not scaled down with
// it — at this size the card would stop reading as rounded.
const CARD_W = 74;
const CARD_H = Math.round(CARD_W / CARD_ASPECT);
const CARD_R = 10;

// Fanned deck on the right of the hero. Only the front card carries the mark; the
// two behind are filled surfaces so nothing shows through.
function CardFan(): React.ReactElement {
  return (
    <View style={styles.fan} pointerEvents="none">
      <View style={[styles.fanCard, styles.fanFar]} />
      <View style={[styles.fanCard, styles.fanNear]} />
      <View style={[styles.fanCard, styles.fanFront]}>
        <SparrLogo size={40} />
      </View>
    </View>
  );
}

interface Props {
  onPress: () => void;
}

export default function SparringChallengeEntry({ onPress }: Props): React.ReactElement {
  // The deck is one tap away from here — warm the mark before the screen opens.
  useEffect(() => { prefetchSparrLogo(); }, []);

  return (
    <TouchableOpacity
      style={styles.hero}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel="Sparrings-Challenge öffnen"
    >
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>SPARRING GAME</Text>
        <Text style={styles.headline}>Zieh deine Mission.</Text>
        <Text style={styles.subline}>Eine geheime Aufgabe für deine nächste Runde.</Text>
        <View style={styles.action}>
          <Text style={styles.actionText}>Mission ziehen →</Text>
        </View>
      </View>

      <CardFan />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: 16,
    marginTop: 16,
    minHeight: 140,
    borderRadius: 16,
    backgroundColor: colors.accentBlue,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  copy: {
    flex: 1,
    paddingRight: 8,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: colors.headerTextSecondary,
  },
  headline: {
    marginTop: 4,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  subline: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: colors.headerTextSecondary,
  },
  action: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },

  // ── Card fan ───────────────────────────────────────────────────────────────
  fan: {
    width: CARD_W + 24,
    height: CARD_H,
    // Lets the front card reach past the hero padding, as requested.
    marginRight: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fanCard: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    borderRadius: CARD_R,
    borderWidth: 2,
    borderColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fanFar: {
    backgroundColor: colors.cardStackFar,
    transform: [{ rotate: '-5deg' }, { translateX: -18 }],
  },
  fanNear: {
    backgroundColor: colors.cardStackNear,
    transform: [{ rotate: '3deg' }, { translateX: -8 }],
  },
  fanFront: {
    backgroundColor: colors.background,
    transform: [{ rotate: '5deg' }, { translateX: 6 }],
  },
});
