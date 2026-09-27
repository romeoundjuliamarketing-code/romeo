import type React from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// One consistent badge per discipline (src/data/disciplines.ts: Boxen,
// Kickboxen, Muay Thai, MMA, BJJ, Wrestling). Unknown values get a neutral icon.
const ICONS: Record<string, IconName> = {
  'Boxen':     'boxing-glove',
  'Kickboxen': 'karate',
  'Muay Thai': 'karate',
  'MMA':       'mixed-martial-arts',
  'BJJ':       'kabaddi',
  'Wrestling': 'kabaddi',
};

export function disciplineIcon(discipline: string): IconName {
  return ICONS[discipline] ?? 'arm-flex-outline';
}
