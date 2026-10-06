import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CHALLENGE_AREAS,
  areaFromDisciplines,
  challengeById,
  emptyAreaRecord,
} from '../data/sparringChallenges';
import type { ChallengeArea, SparringChallenge } from '../data/sparringChallenges';
import { drawChallenge } from '../utils/challengeDraw';
import { availableChallengeAreas, normalizeChallengeArea, playableChallengesForArea } from '../utils/challengeAvailability';

const STORAGE_KEY = 'sparr.challenge.v1';

// Only the chosen discipline survives an app restart — everything else lives for the
// lifetime of the mounted screen, so every open is a fresh deck (see design spec).
interface PersistedState {
  area: ChallengeArea;
}

interface SessionState {
  drawn:   Record<ChallengeArea, string[]>;
  current: Record<ChallengeArea, string | null>;
  done:    string[];
}

type State = PersistedState & SessionState;

function emptyState(): State {
  return {
    area:    'kickboxen',
    drawn:   emptyAreaRecord<string[]>(() => []),
    current: emptyAreaRecord<string | null>(() => null),
    done:    [],
  };
}

function isArea(value: unknown): value is ChallengeArea {
  return CHALLENGE_AREAS.some((a) => a.key === value);
}

// Reads the one persisted field defensively — null means "never chosen", which is
// what makes the screen show the picker. Older stored states carried more fields
// (drawn/current/done); those are simply ignored, the session always starts fresh.
function storedArea(raw: string | null): ChallengeArea | null {
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const area = (parsed as Record<string, unknown>).area;
  return isArea(area) ? area : null;
}

export interface UseSparringChallengeResult {
  area:      ChallengeArea;
  areaChosen: boolean;
  setArea:   (area: ChallengeArea) => void;
  current:   SparringChallenge | null;
  deckSize:  number;
  remaining: number;
  draw:      () => void;
  toggleDone: (id: string) => void;
  isDone:    (id: string) => boolean;
  doneCount: number;
  loading:   boolean;
}

// Keeps the chosen discipline on the device; the drawn card, the draw history and the
// done markers live only for as long as the screen is mounted. No backend involved —
// the challenge deck is static app data.
export function useSparringChallenge(disciplines: string[]): UseSparringChallengeResult {
  const [state, setState] = useState<State>(emptyState);
  const [loading, setLoading] = useState(true);
  // Mirrors `state` synchronously so a callback can read the current value and write
  // the next one in a single pass, without waiting for a re-render.
  const stateRef = useRef<State>(state);
  // True once the user (or a previous session) picked an area explicitly — the profile
  // disciplines must not override that choice when the profile loads late, and the
  // screen shows the picker until it flips.
  const [areaChosen, setAreaChosen] = useState(false);

  // In-memory state leads; the ref mirror lets a callback read and write in one pass.
  // Nothing here touches disk — see setArea for the single persisted field.
  const apply = useCallback((next: State): void => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        const chosen = storedArea(raw);
        setAreaChosen(chosen !== null || availableChallengeAreas().length === 1);
        apply({ ...emptyState(), area: normalizeChallengeArea(chosen ?? 'kickboxen') });
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setAreaChosen(availableChallengeAreas().length === 1);
        setLoading(false);
      });
    return () => { active = false; };
  }, [apply]);

  // Preselect the area from the profile disciplines, but only until a choice exists.
  useEffect(() => {
    if (loading || areaChosen || disciplines.length === 0) return;
    const area = normalizeChallengeArea(areaFromDisciplines(disciplines));
    if (area === stateRef.current.area) return;
    apply({ ...stateRef.current, area });
  }, [loading, areaChosen, disciplines, apply]);

  const setArea = useCallback((area: ChallengeArea): void => {
    setAreaChosen(true);
    const availableArea = normalizeChallengeArea(area);
    apply({ ...stateRef.current, area: availableArea });
    const persisted: PersistedState = { area: availableArea };
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)).catch(() => undefined);
  }, [apply]);

  const draw = useCallback((): void => {
    const prev = stateRef.current;
    const result = drawChallenge(playableChallengesForArea(prev.area), prev.drawn[prev.area]);
    if (result === null) return;
    apply({
      ...prev,
      drawn:   { ...prev.drawn, [prev.area]: result.drawnIds },
      current: { ...prev.current, [prev.area]: result.card.id },
    });
  }, [apply]);

  const toggleDone = useCallback((id: string): void => {
    const prev = stateRef.current;
    const done = prev.done.includes(id)
      ? prev.done.filter((d) => d !== id)
      : [...prev.done, id];
    apply({ ...prev, done });
  }, [apply]);

  const doneIds = useMemo(() => new Set(state.done), [state.done]);
  const isDone = useCallback((id: string): boolean => doneIds.has(id), [doneIds]);

  const currentId = state.current[state.area];
  const deckSize  = playableChallengesForArea(state.area).length;

  return {
    area:       state.area,
    areaChosen,
    setArea,
    current:    currentId === null ? null : challengeById(currentId),
    deckSize,
    remaining:  Math.max(0, deckSize - state.drawn[state.area].length),
    draw,
    toggleDone,
    isDone,
    doneCount:  state.done.filter((id) => challengeById(id)?.area === state.area).length,
    loading,
  };
}
