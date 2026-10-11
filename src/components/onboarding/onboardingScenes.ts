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
