import type React from 'react';
import type { IllustrationProps } from './WelcomeSlide';
import WelcomeMapIllustration from './WelcomeMapIllustration';
import WelcomeCardsIllustration from './WelcomeCardsIllustration';
import WelcomeProfileIllustration from './WelcomeProfileIllustration';

export interface SlideDef {
  key:          string;
  title:        string;
  text:         string;
  Illustration: React.ComponentType<IllustrationProps>;
}

export const SLIDES: SlideDef[] = [
  {
    key:          'sparrings',
    title:        'Finde dein nächstes Sparring.',
    text:         'Entdecke Sparrings in deiner Nähe oder organisiere selbst eines.',
    Illustration: WelcomeMapIllustration,
  },
  {
    key:          'cards',
    title:        'Bring neue Ideen in die Runde.',
    text:         'Zieh eine Karte und probiere eine neue Angriffsidee im Sparring aus.',
    Illustration: WelcomeCardsIllustration,
  },
  {
    key:          'profile',
    title:        'Zeig, wer du als Kämpfer bist.',
    text:         'Deine Sportarten, deine Erfahrung, dein Gym — in deinem Kämpferprofil.',
    Illustration: WelcomeProfileIllustration,
  },
];
