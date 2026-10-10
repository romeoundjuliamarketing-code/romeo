import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import type { NavigationAction } from '@react-navigation/native';
import type { ClarityValue, SparringChallenge } from '../data/sparringChallenges';
import { useChallengeRating } from './useChallengeRating';
import { recordMissionSession } from './useWeeklyMissionPath';

export interface ExitFeedbackQuestion {
  card:      SparringChallenge;
  rate:      (clarity: ClarityValue) => void;
  skip:      () => void;
}

// Drawing is never interrupted. When the player leaves the game (header back, Android
// back, modal swipe) the exit is held once to ask about the card that is currently open
// — earlier cards are not asked about. Skipping is always possible. Every card drawn
// during this visit still counts towards the weekly mission path.
export function useExitCardFeedback(current: SparringChallenge | null): ExitFeedbackQuestion | null {
  const navigation = useNavigation();
  const { submit } = useChallengeRating();

  const [played, setPlayed] = useState<SparringChallenge[]>([]);
  const [asking, setAsking] = useState<SparringChallenge | null>(null);
  const [done, setDone]     = useState(false);
  const pendingAction = useRef<NavigationAction | null>(null);

  useEffect(() => {
    if (current === null) return;
    setPlayed((prev) => (prev.some((c) => c.id === current.id) ? prev : [...prev, current]));
  }, [current]);

  const finish = useCallback((): void => {
    void recordMissionSession(played.map((c) => c.focus.de).filter((f) => f.length > 0));
    setAsking(null);
    setDone(true);
  }, [played]);

  usePreventRemove(played.length > 0 && !done, ({ data }) => {
    pendingAction.current = data.action;
    if (current !== null) setAsking(current);
    else finish();
  });

  // Leaves only after the render that lifted the exit guard, so the held action is not
  // blocked a second time.
  useEffect(() => {
    if (!done || pendingAction.current === null) return;
    const action = pendingAction.current;
    pendingAction.current = null;
    navigation.dispatch(action);
  }, [done, navigation]);

  if (asking === null) return null;

  const card = asking;
  return {
    card,
    rate: (clarity) => {
      submit(card.id, clarity);
      finish();
    },
    skip: finish,
  };
}
