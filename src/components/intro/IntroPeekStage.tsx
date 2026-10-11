import React from 'react';
import { View, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { colors } from '../../theme/colors';
import type { OnboardingScene } from '../onboarding/onboardingScenes';

// Coach height from the screen height; with large text it shrinks first,
// so the readable content keeps its room.
const HEIGHT_SHARE = 0.13;
const MIN_HEIGHT = 56;
const MAX_HEIGHT = 120;
// Part of the coach above the content's top edge; the rest stays behind it.
const VISIBLE_SHARE = 0.64;

// A small coach peeking over the top edge of the step's central content
// (the card or the invitation). He sits behind it, takes no text width and
// covers nothing readable: the content is drawn above him and is opaque.
export default function IntroPeekStage({ scene, small = false, children }: {
  scene:    OnboardingScene;
  /** More text above: the coach takes its smallest size. */
  small?:   boolean;
  children: React.ReactNode;
}): React.ReactElement {
  const { height, fontScale } = useWindowDimensions();
  const coachHeight = small ? MIN_HEIGHT
    : Math.round(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, (height * HEIGHT_SHARE) / Math.max(1, fontScale))));
  const coach = { width: Math.round(coachHeight * scene.ratio), height: coachHeight };
  const visible = Math.round(coachHeight * VISIBLE_SHARE);
  const tint = { width: coachHeight, height: coachHeight, borderRadius: coachHeight / 2 };

  return (
    <View style={[styles.root, { paddingTop: visible }]}>
      <View style={[styles.tint, tint]} pointerEvents="none" />
      <Image
        source={scene.source}
        style={[styles.coach, coach]}
        resizeMode="contain"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch' },
  tint: {
    position:        'absolute',
    top:             0,
    right:           24,
    backgroundColor: colors.accentBlueTint,
  },
  coach: {
    position: 'absolute',
    top:      0,
    right:    0,
  },
});
