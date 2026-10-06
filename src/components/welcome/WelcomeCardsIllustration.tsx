import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { colors } from '../../theme/colors';
import SparrLogo from '../common/SparrLogo';
import { CARD_ASPECT } from '../challenge/cardLayout';
import { useSlideEntrance } from './useSlideEntrance';

interface Props {
  width:  number;
  height: number;
  active: boolean;
}

// Slide 2: the card game. Two card backs in the deck colours and a front card
// in the real card layout (blue band, level bars) — a graphic preview only,
// the challenge texts are not final yet. The front card slides forward and
// straightens up when the slide becomes active.
export default function WelcomeCardsIllustration({ width, height, active }: Props): React.ReactElement {
  const progress = useSlideEntrance(active);

  const cardWidth = Math.round(Math.min(width * 0.5, (height - 48) * CARD_ASPECT, 180));
  const cardHeight = Math.round(cardWidth / CARD_ASPECT);
  const size = { width: cardWidth, height: cardHeight };

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (1 - progress.value) * -24 },
      { translateY: (1 - progress.value) * 8 },
      { rotate: `${-9 + progress.value * 11}deg` },
    ],
  }));

  return (
    <View style={[styles.panel, { width, height }]}>
      <View style={[styles.back, styles.backFar, size]}>
        <SparrLogo size={cardWidth * 0.4} opacity={0.18} />
      </View>
      <View style={[styles.back, styles.backNear, size]}>
        <SparrLogo size={cardWidth * 0.4} opacity={0.18} />
      </View>

      <Animated.View style={[styles.front, size, frontStyle]}>
        <View style={styles.band}>
          <SparrLogo size={24} />
          <Text style={styles.bandText} maxFontSizeMultiplier={1.2} numberOfLines={1}>Beispielkarte</Text>
        </View>
        <View style={styles.body}>
          <View style={styles.levelRow}>
            <View style={[styles.levelBar, styles.levelBarOn]} />
            <View style={[styles.levelBar, styles.levelBarOn]} />
            <View style={styles.levelBar} />
          </View>
          <View style={[styles.line, styles.lineTitle]} />
          <View style={[styles.line, styles.lineLong]} />
          <View style={[styles.line, styles.lineLong]} />
          <View style={[styles.line, styles.lineShort]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius:    32,
    overflow:        'hidden',
    backgroundColor: colors.dark,
    alignItems:      'center',
    justifyContent:  'center',
  },
  back: {
    position:       'absolute',
    borderRadius:   16,
    alignItems:     'center',
    justifyContent: 'center',
  },
  backFar: {
    backgroundColor: colors.cardStackFar,
    transform:       [{ translateX: 40 }, { rotate: '12deg' }],
  },
  backNear: {
    backgroundColor: colors.cardStackNear,
    transform:       [{ translateX: 20 }, { rotate: '6deg' }],
  },
  front: {
    borderRadius:    16,
    overflow:        'hidden',
    backgroundColor: colors.background,
  },
  band: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 16,
    paddingVertical:   8,
    backgroundColor:   colors.accentBlue,
  },
  bandText: {
    flex:       1,
    fontSize:   12,
    fontWeight: '800',
    color:      colors.card,
  },
  body: {
    flex:    1,
    padding: 16,
    gap:     8,
  },
  levelRow: {
    flexDirection: 'row',
    gap:           4,
    marginBottom:  8,
  },
  levelBar: {
    width:           16,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.hairline,
  },
  levelBarOn: {
    backgroundColor: colors.accentBlue,
  },
  line: {
    height:          8,
    borderRadius:    4,
    backgroundColor: colors.hairline,
  },
  lineTitle: {
    height:          16,
    width:           '80%',
    backgroundColor: colors.text,
    marginBottom:    8,
  },
  lineLong: {
    width: '100%',
  },
  lineShort: {
    width: '56%',
  },
});
