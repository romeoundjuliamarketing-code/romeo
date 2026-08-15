import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type ClarityValue = 1 | 2 | 3;

interface ClarityLevel {
  value: ClarityValue;
  icon:  ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
}

// Single source of truth for the three clarity levels — shared by the inline rating
// row and the rating overlay. Swapping these icons for penguin illustrations later
// only touches this array.
export const CLARITY_LEVELS: ClarityLevel[] = [
  { value: 1, icon: 'emoticon-confused-outline', label: 'Unklar' },
  { value: 2, icon: 'emoticon-neutral-outline',  label: 'Geht so' },
  { value: 3, icon: 'emoticon-happy-outline',    label: 'Klar' },
];
