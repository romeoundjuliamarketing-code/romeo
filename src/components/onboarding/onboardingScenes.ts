import type { ImageSourcePropType } from 'react-native';

// Full coach scenes (cut-out, transparent background) for the onboarding.
export type OnboardingScene = {
  source: ImageSourcePropType;
  /** Width / height of the asset. */
  ratio:  number;
};

// Welcome: close-up at the ring corner, fist out for a fist bump.
export const SCENE_WELCOME: OnboardingScene = {
  source: require('../../../assets/coach/coach-welcome-ring.png'),
  ratio:  1152 / 768,
};

// Coach crouching over a spread map, setting a pin.
export const SCENE_LOCATION: OnboardingScene = {
  source: require('../../../assets/coach/coach-location-map.png'),
  ratio:  1152 / 768,
};

// Coach holding out a single SPARR card (intro card step; shown mirrored so
// he presents it towards the real card on the right).
export const SCENE_DRAW_CARD: OnboardingScene = {
  source: require('../../../assets/coach/coach-draw-card.png'),
  ratio:  1152 / 768,
};
