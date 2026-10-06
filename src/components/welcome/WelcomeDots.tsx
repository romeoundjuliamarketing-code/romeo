import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { colors } from '../../theme/colors';

interface Props {
  count:     number;
  index:     number;
  // Horizontal pager offset; the dots follow it on the UI thread.
  scrollX:   SharedValue<number>;
  pageWidth: number;
}

// Progress dots of the welcome intro. The blue fill tracks the swipe on the
// UI thread (opacity + scale only); the label comes from the settled index.
export default function WelcomeDots({ count, index, scrollX, pageWidth }: Props): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('auth.welcome.page', { current: index + 1, total: count })}
    >
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} position={i} scrollX={scrollX} pageWidth={pageWidth} />
      ))}
    </View>
  );
}

function Dot({ position, scrollX, pageWidth }: {
  position:  number;
  scrollX:   SharedValue<number>;
  pageWidth: number;
}): React.ReactElement {
  const fillStyle = useAnimatedStyle(() => {
    const page = pageWidth > 0 ? scrollX.value / pageWidth : 0;
    const t = interpolate(Math.abs(page - position), [0, 1], [1, 0], Extrapolation.CLAMP);
    return { opacity: t, transform: [{ scale: 0.6 + t * 0.4 }] };
  });

  return (
    <View style={styles.dot}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const DOT = 8;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap:           8,
    alignItems:    'center',
  },
  dot: {
    width:           DOT,
    height:          DOT,
    borderRadius:    DOT / 2,
    backgroundColor: colors.fieldBorder,
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius:    DOT / 2,
    backgroundColor: colors.accentBlue,
  },
});
