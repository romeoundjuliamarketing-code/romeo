import type { ImageSourcePropType } from 'react-native';

// A cut-out coach pose for CoachInviteOverlay / CoachScene.
export type CoachFigure = {
  source: ImageSourcePropType;
  /** Width / height of the asset. */
  ratio:  number;
  /** Where the bubble's tail aims, as share of the image height (the beak, or
   *  just above whatever the coach holds out towards the bubble). */
  tailY:  number;
  /** Side the coach stands on; he faces the other side. */
  side:   'left' | 'right';
  /** CoachScene: right edge of the head at eye level, as share of the image
   *  width / height. The bubble tail above the coach aims here. */
  head?:  { x: number; y: number };
};

// Open hand towards the right, clipboard in the other hand.
export const COACH_INVITING: CoachFigure = {
  source: require('../../../assets/coach/einladung_ersteller.png'),
  ratio:  508 / 800,
  tailY:  0.16,
  side:   'left',
  head:   { x: 0.64, y: 0.1 },
};

// Holds three SPARR cards out to the left; the tail aims above them.
export const COACH_CARDS: CoachFigure = {
  source: require('../../../assets/coach/einladung_karten.png'),
  ratio:  525 / 800,
  tailY:  0.08,
  side:   'right',
};
