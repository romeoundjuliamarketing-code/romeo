import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  Extrapolation, interpolate, runOnJS, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle,
  useDerivedValue, useSharedValue,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export const GYM_BAR_HEIGHT = 56;

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// One button, two looks cross-faded by opacity only: white icon on a dark
// disc over the cover, dark icon once the bar is solid.
function BarButton({ icon, label, solid, onPress }: {
  icon:    IconName;
  label:   string;
  solid:   SharedValue<number>;
  onPress: () => void;
}): React.ReactElement {
  const overCover = useAnimatedStyle(() => ({ opacity: 1 - solid.value }));
  const onBar     = useAnimatedStyle(() => ({ opacity: solid.value }));
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.6} accessibilityRole="button" accessibilityLabel={label}>
      <Animated.View style={[styles.disc, styles.discOverCover, overCover]}>
        <Ionicons name={icon} size={22} color={colors.headerTextPrimary} />
      </Animated.View>
      <Animated.View style={[styles.disc, onBar]}>
        <Ionicons name={icon} size={22} color={colors.text} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// The gym page's only top bar: back and menu sit on the cover first; once the
// cover has scrolled away the bar turns opaque (page background) and, after
// the gym name has passed under it, shows the name — never both at once.
// Driven by the scroll position on the UI thread (opacity only, no state per
// frame).
export default function GymTopBar({ title, scrollY, solidFrom, titleFrom, onBack, onMenu }: {
  title:     string;
  scrollY:   SharedValue<number>;
  /** Scroll offset at which the cover's bottom edge reaches the bar's bottom. */
  solidFrom: number;
  /** Scroll offset at which the gym name has passed under the bar. */
  titleFrom: number;
  onBack:    () => void;
  onMenu:    () => void;
}): React.ReactElement {
  const insets = useSafeAreaInsets();

  // 0 over the cover, 1 once the bar is solid; shared by both buttons.
  const solid = useDerivedValue(() => interpolate(scrollY.value, [solidFrom - 24, solidFrom], [0, 1], Extrapolation.CLAMP));
  const backdrop = useAnimatedStyle(() => ({ opacity: solid.value }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(scrollY.value, [titleFrom, titleFrom + 16], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [titleFrom, titleFrom + 16], [8, 0], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={[styles.bar, { height: insets.top + GYM_BAR_HEIGHT }]} pointerEvents="box-none">
      {/* Opaque once solid: content never shows through behind the buttons. */}
      <Animated.View style={[styles.backdrop, backdrop]} />
      <View style={[styles.row, { marginTop: insets.top }]} pointerEvents="box-none">
        <BarButton icon="chevron-back" label="Zurück" solid={solid} onPress={onBack} />
        <Animated.Text
          style={[styles.title, titleStyle]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {title}
        </Animated.Text>
        <BarButton icon="ellipsis-horizontal" label="Weitere Aktionen" solid={solid} onPress={onMenu} />
      </View>
    </View>
  );
}

// Scroll position for the bar, kept on the UI thread; React only hears when
// the bar flips between "over the cover" and "solid" (status bar icons).
export function useGymBarScroll(solidFrom: number): {
  scrollY:  SharedValue<number>;
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
  barSolid: boolean;
} {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const [barSolid, setBarSolid] = useState(false);
  useAnimatedReaction(
    () => scrollY.value > solidFrom - 12,
    (solid, previous) => { if (solid !== previous) runOnJS(setBarSolid)(solid); },
    [solidFrom],
  );
  return { scrollY, onScroll, barSolid };
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:   colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  row: {
    height:            GYM_BAR_HEIGHT,
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 8,
    gap:               8,
  },
  // 48 dp touch target (Android minimum), 40 pt visible disc.
  button: {
    width:          48,
    height:         48,
    alignItems:     'center',
    justifyContent: 'center',
  },
  disc: {
    position:        'absolute',
    width:           40,
    height:          40,
    borderRadius:    20,
    alignItems:      'center',
    justifyContent:  'center',
  },
  discOverCover: {
    backgroundColor: colors.heroFloatingBtn,
  },
  title: {
    flex:       1,
    fontSize:   17,
    fontWeight: '700',
    textAlign:  'center',
    color:      colors.text,
  },
});
