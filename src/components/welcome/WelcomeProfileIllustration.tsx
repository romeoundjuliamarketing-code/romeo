import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useSlideEntrance } from './useSlideEntrance';

interface Props {
  width:  number;
  height: number;
  active: boolean;
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Slide 3: a compact fighter-card preview in the style of the profile (photo
// area, name band, discipline badges, a few facts, solid offset shadow).
// Clearly an example: placeholder avatar and name, no verification, no numbers.
export default function WelcomeProfileIllustration({ width, height, active }: Props): React.ReactElement {
  const progress = useSlideEntrance(active);
  const cardWidth = Math.round(Math.min(width * 0.72, 264));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 20 }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.9 + progress.value * 0.1 }],
  }));

  return (
    <View style={[styles.panel, { width, height }]}>
      <View style={styles.blueBlock} />
      <Animated.View style={[styles.cardWrap, { width: cardWidth }, cardStyle]}>
        <View style={styles.solidShadow} />
        <View style={styles.card}>
          <View style={styles.photo}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color={colors.dark} />
            </View>
            <View style={styles.exampleChip}>
              <Text style={styles.exampleText} maxFontSizeMultiplier={1.2}>Beispiel</Text>
            </View>
          </View>
          <View style={styles.content}>
            <Text style={styles.name} maxFontSizeMultiplier={1.2} numberOfLines={1}>Dein Name</Text>
            <Animated.View style={[styles.badges, badgeStyle]}>
              <View style={[styles.badge, styles.badgeDark]}>
                <Text style={[styles.badgeText, styles.badgeTextLight]} maxFontSizeMultiplier={1.2}>Boxen</Text>
              </View>
              <View style={[styles.badge, styles.badgeBlue]}>
                <Text style={[styles.badgeText, styles.badgeTextBlue]} maxFontSizeMultiplier={1.2}>Muay Thai</Text>
              </View>
            </Animated.View>
            <Fact icon="trophy-outline" label="Erfahrung" value="Fortgeschritten" />
            <Fact icon="barbell-outline" label="Gym" value="Dein Gym" />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function Fact({ icon, label, value }: { icon: IconName; label: string; value: string }): React.ReactElement {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={16} color={colors.accentBlueText} />
      <Text style={styles.factLabel} maxFontSizeMultiplier={1.2}>{label}</Text>
      <Text style={styles.factValue} maxFontSizeMultiplier={1.2} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const SHADOW_OFFSET = 8;

const styles = StyleSheet.create({
  panel: {
    borderRadius:    32,
    overflow:        'hidden',
    backgroundColor: colors.card,
    alignItems:      'center',
    justifyContent:  'center',
  },
  blueBlock: {
    position:        'absolute',
    top:             0,
    right:           0,
    bottom:          0,
    width:           '42%',
    backgroundColor: colors.accentBlue,
  },
  cardWrap: {
    paddingRight:  SHADOW_OFFSET,
    paddingBottom: SHADOW_OFFSET,
  },
  solidShadow: {
    position:        'absolute',
    top:             SHADOW_OFFSET,
    left:            SHADOW_OFFSET,
    right:           0,
    bottom:          0,
    borderRadius:    24,
    backgroundColor: colors.dark,
  },
  card: {
    borderRadius:    24,
    borderWidth:     2,
    borderColor:     colors.dark,
    overflow:        'hidden',
    backgroundColor: colors.card,
  },
  photo: {
    height:          88,
    backgroundColor: colors.dark,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatar: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: colors.background,
    alignItems:      'center',
    justifyContent:  'center',
  },
  exampleChip: {
    position:          'absolute',
    top:               8,
    left:              8,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      8,
    backgroundColor:   colors.headerCard,
  },
  exampleText: {
    fontSize:   11,
    fontWeight: '700',
    color:      colors.headerTextPrimary,
  },
  content: {
    padding: 16,
    gap:     8,
  },
  name: {
    fontSize:      20,
    fontWeight:    '900',
    letterSpacing: -0.3,
    color:         colors.text,
  },
  badges: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
    marginBottom:  8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      8,
  },
  badgeDark: {
    backgroundColor: colors.dark,
  },
  badgeBlue: {
    backgroundColor: colors.accentBlueTint,
  },
  badgeText: {
    fontSize:   12,
    fontWeight: '800',
  },
  badgeTextLight: {
    color: colors.card,
  },
  badgeTextBlue: {
    color: colors.accentBlueText,
  },
  fact: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  factLabel: {
    fontSize: 13,
    color:    colors.textMuted,
  },
  factValue: {
    flex:       1,
    fontSize:   13,
    fontWeight: '700',
    color:      colors.text,
    textAlign:  'right',
  },
});
