import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import type { NavigationAction } from '@react-navigation/native';
import type { ClarityValue, SparringChallenge } from '../data/sparringChallenges';
import { useChallengeRating } from './useChallengeRating';
import { recordMissionSession } from './useWeeklyMissionPath';

export interface ExitFeedbackQuestion {
  card:      SparringChallenge;
  progress:  string;
  rate:      (clarity: ClarityValue) => void;
  skip:      () => void;
  // Undefined for a single question — "Alle überspringen" would only repeat "Überspringen".
  skipAll?:  () => void;
}

// Drawing is never interrupted. Every card drawn during this visit is collected, and
// when the player leaves the game (header back, Android back, modal swipe) the exit is
// held once to ask about each of them in turn. Skipping is always possible. The visit
// also counts towards the weekly mission path.
export function useExitCardFeedback(current: SparringChallenge | null): ExitFeedbackQuestion | null {
  const navigation = useNavigation();
  const { submit } = useChallengeRating();

  const [played, setPlayed] = useState<SparringChallenge[]>([]);
  const [index, setIndex]   = useState<number | null>(null);
  const [done, setDone]     = useState(false);
  const pendingAction = useRef<NavigationAction | null>(null);

  useEffect(() => {
    if (current === null) return;
    setPlayed((prev) => (prev.some((c) => c.id === current.id) ? prev : [...prev, current]));
  }, [current]);

  usePreventRemove(played.length > 0 && !done, ({ data }) => {
    pendingAction.current = data.action;
    setIndex(0);
  });

  const finish = useCallback((): void => {
    void recordMissionSession(played.map((c) => c.focus).filter((f) => f.length > 0));
    setIndex(null);
    setDone(true);
  }, [played]);

  // Leaves only after the render that lifted the exit guard, so the held action is not
  // blocked a second time.
  useEffect(() => {
    if (!done || pendingAction.current === null) return;
    const action = pendingAction.current;
    pendingAction.current = null;
    navigation.dispatch(action);
  }, [done, navigation]);

  const next = useCallback((): void => {
    if (index === null) return;
    if (index + 1 >= played.length) finish();
    else setIndex(index + 1);
  }, [index, played.length, finish]);

  if (index === null || index >= played.length) return null;

  const card = played[index];
  return {
    card,
    progress: `Karte ${index + 1} von ${played.length}`,
    rate: (clarity) => {
      submit(card.id, clarity);
      next();
    },
    skip: next,
    skipAll: played.length > 1 ? finish : undefined,
  };
}
