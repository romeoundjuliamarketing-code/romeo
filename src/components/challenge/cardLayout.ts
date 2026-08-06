import { Platform, useWindowDimensions } from 'react-native';
import { colors } from '../../theme/colors';

// Width / height of a real playing card.
export const CARD_ASPECT = 0.7;

export const CARD_RADIUS = 18;

export const MAX_CARD_WIDTH = 320;

export interface CardSize {
  width:  number;
  height: number;
}

// 80 % of the screen width, capped at 320 pt. The height cap only bites on short
// screens, where a full-width card would push the actions off the screen.
export function useCardSize(maxHeightFraction = 0.52): CardSize {
  const { width, height } = useWindowDimensions();
  const byWidth  = Math.min(width * 0.8, MAX_CARD_WIDTH);
  const byHeight = height * maxHeightFraction * CARD_ASPECT;
  const cardWidth = Math.max(170, Math.min(byWidth, byHeight));
  return {
    width:  Math.round(cardWidth),
    height: Math.round(cardWidth / CARD_ASPECT),
  };
}

export const cardShadow = Platform.select({
  ios:     { shadowColor: colors.dark, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16 },
  android: { elevation: 8 },
});

export const entryShadow = Platform.select({
  ios:     { shadowColor: colors.dark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 },
  android: { elevation: 3 },
});
