import type { ImageSourcePropType } from 'react-native';
import type { TourStation } from '../../utils/tour';

// Coach scenes of the tour (cut-out, transparent; 3:2 except the cards coach).
export type TourScene = {
  source: ImageSourcePropType;
  ratio:  number;
};

const RATIO = 1152 / 768;

export const TOUR_SCENES: Record<TourStation, TourScene> = {
  // Holds a large, still blank fighter pass.
  profile:  { source: require('../../../assets/coach/coach-fighter-pass.png'), ratio: RATIO },
  // Upright, holds out three real SPARR card backs.
  cards:    { source: require('../../../assets/coach/coach-sparr-cards.png'), ratio: 600 / 924 },
  // Crouches over a spread map, setting a pin.
  discover: { source: require('../../../assets/coach/coach-location-map.png'), ratio: RATIO },
  // Holds the ring ropes apart: the step into your own use.
  detail:   { source: require('../../../assets/coach/coach-ring-entry.png'), ratio: RATIO },
};
