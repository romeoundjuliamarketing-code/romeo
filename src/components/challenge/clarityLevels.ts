import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ClarityValue } from '../../data/sparringChallenges';

interface ClarityLevel {
  value: ClarityValue;
  icon:  ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
}

// How long the confirmation is shown before the parent is told about the choice.
export const THANKS_DURATION_MS = 1500;

// Single source of truth for the three clarity levels — shared by the inline rating
// row and the rating overlay. Swapping these icons for penguin illustrations later
// only touches this array.
export const CLARITY_LEVELS: ClarityLevel[] = [
  { value: 1, icon: 'emoticon-confused-outline', label: 'Unklar' },
  { value: 2, icon: 'emoticon-neutral-outline',  label: 'Geht so' },
  { value: 3, icon: 'emoticon-happy-outline',    label: 'Klar' },
];

// Shared choice mechanics: a level can be picked once, the confirmation is shown
// for a beat, then the parent is told. Both the inline row and the overlay use this
// so the duration and the one-shot lock cannot drift apart.
export function useClarityChoice(onRate: (clarity: ClarityValue) => void): {
  selected: ClarityValue | null;
  choose:   (value: ClarityValue) => void;
} {
  const [selected, setSelected] = useState<ClarityValue | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  const choose = useCallback((value: ClarityValue): void => {
    if (selected !== null) return;
    setSelected(value);
    timerRef.current = setTimeout(() => onRate(value), THANKS_DURATION_MS);
  }, [selected, onRate]);

  return { selected, choose };
}
