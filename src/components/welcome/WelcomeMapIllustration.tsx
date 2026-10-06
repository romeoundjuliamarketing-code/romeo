import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useSlideEntrance } from './useSlideEntrance';

interface Props {
  width:  number;
  height: number;
  active: boolean;
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Slide 1: a stylised, static map (no live map, no location) with two sparring
// markers in the style of the real map pins and an example sparring card.
export default function WelcomeMapIllustration({ width, height, active }: Props): React.ReactElement {
  const { t } = useTranslation();
  const progress = useSlideEntrance(active);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 16 }],
  }));

  return (
    <View style={[styles.panel, { width, height }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {/* Streets */}
        <Path d={`M -20 ${height * 0.28} L ${width + 20} ${height * 0.12}`} stroke={colors.card} strokeWidth={14} />
        <Path d={`M ${width * 0.3} -20 L ${width * 0.46} ${height + 20}`} stroke={colors.card} strokeWidth={10} />
        <Path d={`M -20 ${height * 0.62} L ${width + 20} ${height * 0.5}`} stroke={colors.card} strokeWidth={8} />
        <Path d={`M ${width * 0.78} -20 L ${width * 0.7} ${height + 20}`} stroke={colors.card} strokeWidth={6} />
        {/* Park block */}
        <Rect
          x={width * 0.52}
          y={height * 0.2}
          width={width * 0.16}
          height={height * 0.22}
          rx={8}
          fill={colors.accentBlueSoft}
        />
      </Svg>

      <Marker progress={progress} icon="people" left={width * 0.18} top={height * 0.08} />
      <Marker progress={progress} icon="business" left={width * 0.62} top={height * 0.3} highlight />

      <Animated.View style={[styles.card, cardStyle]}>
        <View style={styles.cardIcon}>
          <Ionicons name="hand-left" size={18} color={colors.card} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardCaption}>{t('auth.welcome.illustration.example')}</Text>
          <Text style={styles.cardTitle} numberOfLines={1}>{t('auth.welcome.illustration.openSparring')}</Text>
          <Text style={styles.cardMeta} numberOfLines={1}>{t('auth.welcome.illustration.sparringMeta')}</Text>
        </View>
        <View style={styles.cardAction}>
          <Ionicons name="chevron-forward" size={16} color={colors.card} />
        </View>
      </Animated.View>
    </View>
  );
}

function Marker({ progress, icon, left, top, highlight = false }: {
  progress:   SharedValue<number>;
  icon:       IconName;
  left:       number;
  top:        number;
  highlight?: boolean;
}): React.ReactElement {
  // Drops in from slightly above.
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - progress.value) * -12 },
      { scale: 0.9 + progress.value * 0.1 },
    ],
  }));

  return (
    <Animated.View style={[styles.marker, { left, top }, style]}>
      <View style={[styles.markerChip, highlight && styles.markerChipHighlight]}>
        <Ionicons name={icon} size={16} color={colors.card} />
      </View>
      <View style={styles.markerStem} />
      <View style={styles.markerAnchor} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius:    32,
    overflow:        'hidden',
    backgroundColor: colors.accentBlueTint,
  },
  marker: {
    position:   'absolute',
    alignItems: 'center',
  },
  markerChip: {
    width:           40,
    height:          40,
    borderRadius:    12,
    borderWidth:     2,
    borderColor:     colors.card,
    backgroundColor: colors.dark,
    alignItems:      'center',
    justifyContent:  'center',
  },
  markerChipHighlight: {
    backgroundColor: colors.accentBlue,
  },
  markerStem: {
    width:           2,
    height:          8,
    backgroundColor: colors.dark,
  },
  markerAnchor: {
    width:           12,
    height:          12,
    borderRadius:    6,
    borderWidth:     2,
    borderColor:     colors.card,
    backgroundColor: colors.accentBlue,
  },
  card: {
    position:        'absolute',
    left:            16,
    right:           16,
    bottom:          16,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             16,
    padding:         16,
    borderRadius:    16,
    backgroundColor: colors.card,
  },
  cardIcon: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: colors.dark,
    alignItems:      'center',
    justifyContent:  'center',
  },
  cardBody: {
    flex: 1,
  },
  cardCaption: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color:         colors.accentBlueText,
  },
  cardTitle: {
    fontSize:   16,
    fontWeight: '800',
    color:      colors.text,
  },
  cardMeta: {
    fontSize: 13,
    color:    colors.textMuted,
  },
  cardAction: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: colors.accentBlue,
    alignItems:      'center',
    justifyContent:  'center',
  },
});
