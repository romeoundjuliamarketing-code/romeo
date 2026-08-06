import { Platform, useWindowDimensions } from 'react-native';
import { colors } from '../../theme/colors';

// Proportions of a real playing card (63 x 88 mm).
export const CARD_RATIO = 1.4;

export const CARD_RADIUS = 20;

export interface CardSize {
  width:  number;
  height: number;
}

// Sizes the card against both axes so it never eats the whole screen on tall phones
// and still leaves room for the actions on small ones.
export function useCardSize(maxHeightFraction = 0.44): CardSize {
  const { width, height } = useWindowDimensions();
  const maxWidth  = Math.min(width - 96, 300);
  const maxHeight = height * maxHeightFraction;
  const cardWidth = Math.max(180, Math.min(maxWidth, maxHeight / CARD_RATIO));
  return {
    width:  Math.round(cardWidth),
    height: Math.round(cardWidth * CARD_RATIO),
  };
}

export const cardShadow = Platform.select({
  ios:     { shadowColor: colors.dark, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.24, shadowRadius: 16 },
  android: { elevation: 6 },
});

export const entryShadow = Platform.select({
  ios:     { shadowColor: colors.dark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 },
  android: { elevation: 3 },
});
