import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { colors } from '../../theme/colors';

// Width / height of a real playing card.
export const CARD_ASPECT = 0.7;

export const CARD_RADIUS = 24;

export const MAX_CARD_WIDTH = 344;

// Outer margin of the session screens.
export const SESSION_GUTTER = 24;

// Widest a session card gets, so it keeps card proportions on tablets.
const MAX_SESSION_CARD_WIDTH = 440;

export interface CardSize {
  width:  number;
  height: number;
}

// 86 % of the screen width, capped at 344 pt. The height cap only bites on short
// screens, where a full-width card would push the actions off the screen.
export function useCardSize(maxHeightFraction = 0.56): CardSize {
  const { width, height } = useWindowDimensions();
  // Memoised so the size keeps its identity between renders and does not invalidate
  // every consumer that takes it as a prop.
  return useMemo(() => {
    const byWidth   = Math.min(width * 0.86, MAX_CARD_WIDTH);
    const byHeight  = height * maxHeightFraction * CARD_ASPECT;
    const cardWidth = Math.max(170, Math.min(byWidth, byHeight));
    return {
      width:  Math.round(cardWidth),
      height: Math.round(cardWidth / CARD_ASPECT),
    };
  }, [width, height, maxHeightFraction]);
}

// Full width between the session gutters. Height is left to the card's content
// (ChallengeCard fitContent), so only the width is fixed here.
export function useSessionCardWidth(): number {
  const { width } = useWindowDimensions();
  return Math.round(Math.min(width - SESSION_GUTTER * 2, MAX_SESSION_CARD_WIDTH));
}

export const cardShadow =Platform.select({
  ios:     { shadowColor: colors.dark, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16 },
  android: { elevation: 8 },
});
