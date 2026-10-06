// Slide texts live in the auth namespace (auth.welcome.slides.<key>) and are
// translated where the slide renders.
import type React from 'react';
import type { IllustrationProps } from './WelcomeSlide';
import WelcomeMapIllustration from './WelcomeMapIllustration';
import WelcomeCardsIllustration from './WelcomeCardsIllustration';
import WelcomeProfileIllustration from './WelcomeProfileIllustration';

export interface SlideDef {
  key:          'sparrings' | 'cards' | 'profile';
  Illustration: React.ComponentType<IllustrationProps>;
}

export const SLIDES: SlideDef[] = [
  {
    key:          'sparrings',
    Illustration: WelcomeMapIllustration,
  },
  {
    key:          'cards',
    Illustration: WelcomeCardsIllustration,
  },
  {
    key:          'profile',
    Illustration: WelcomeProfileIllustration,
  },
];
