import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CHALLENGE_AREAS,
  DEFAULT_AREA,
  areaFromDisciplines,
  challengeById,
  challengesForArea,
  emptyAreaRecord,
} from '../data/sparringChallenges';
import type { ChallengeArea, SparringChallenge } from '../data/sparringChallenges';
import { drawChallenge } from '../utils/challengeDraw';

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
  draws:   number;
}

type State = PersistedState & SessionState;

function emptyState(): State {
  return {
    area:    DEFAULT_AREA,
    drawn:   emptyAreaRecord<string[]>(() => []),
    current: emptyAreaRecord<string | null>(() => null),
    done:    [],
    draws:   0,
  };
}

function isArea(value: unknown): value is ChallengeArea {
  return CHALLENGE_AREAS.some((a) => a.key === value);
}

// Parses the persisted blob defensively: anything unknown is dropped instead of
// throwing, so the feature always stays usable. Older stored states carried more
// fields (drawn/current/done) — those are simply ignored now, the session starts
// fresh regardless of what is on disk.
function parseState(raw: string | null): { area: ChallengeArea; hadArea: boolean } {
  const fallback = { area: DEFAULT_AREA, hadArea: false };
  if (raw === null) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (typeof parsed !== 'object' || parsed === null) return fallback;

  const obj = parsed as Record<string, unknown>;
  const rawArea = obj.area;
  const hadArea = isArea(rawArea);
  return { area: hadArea ? rawArea : DEFAULT_AREA, hadArea };
}

export interface UseSparringChallengeResult {
  area:      ChallengeArea;
  areaChosen: boolean;
  setArea:   (area: ChallengeArea) => void;
  current:   SparringChallenge | null;
  deckSize:  number;
  remaining: number;
  draws:     number;
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

  // In-memory state leads. Only the area is persisted, and only when it changes —
  // drawn/current/done/draws never touch disk.
  const apply = useCallback((next: State, persist: boolean): void => {
    stateRef.current = next;
    setState(next);
    if (persist) {
      const persisted: PersistedState = { area: next.area };
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        const { area, hadArea } = parseState(raw);
        setAreaChosen(hadArea);
        const loaded = { ...emptyState(), area };
        stateRef.current = loaded;
        setState(loaded);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  // Preselect the area from the profile disciplines, but only until a choice exists.
  useEffect(() => {
    if (loading || areaChosen || disciplines.length === 0) return;
    const area = areaFromDisciplines(disciplines);
    if (area === stateRef.current.area) return;
    const next = { ...stateRef.current, area };
    stateRef.current = next;
    setState(next);
  }, [loading, areaChosen, disciplines]);

  const setArea = useCallback((area: ChallengeArea): void => {
    setAreaChosen(true);
    apply({ ...stateRef.current, area }, true);
  }, [apply]);

  const draw = useCallback((): void => {
    const prev = stateRef.current;
    const result = drawChallenge(challengesForArea(prev.area), prev.drawn[prev.area]);
    if (result === null) return;
    apply({
      ...prev,
      drawn:   { ...prev.drawn, [prev.area]: result.drawnIds },
      current: { ...prev.current, [prev.area]: result.card.id },
      draws:   prev.draws + 1,
    }, false);
  }, [apply]);

  const toggleDone = useCallback((id: string): void => {
    const prev = stateRef.current;
    const done = prev.done.includes(id)
      ? prev.done.filter((d) => d !== id)
      : [...prev.done, id];
    apply({ ...prev, done }, false);
  }, [apply]);

  const doneIds = useMemo(() => new Set(state.done), [state.done]);
  const isDone = useCallback((id: string): boolean => doneIds.has(id), [doneIds]);

  const currentId = state.current[state.area];
  const deckSize  = challengesForArea(state.area).length;

  return {
    area:       state.area,
    areaChosen,
    setArea,
    current:    currentId === null ? null : challengeById(currentId),
    deckSize,
    remaining:  Math.max(0, deckSize - state.drawn[state.area].length),
    draws:      state.draws,
    draw,
    toggleDone,
    isDone,
    doneCount:  state.done.filter((id) => challengeById(id)?.area === state.area).length,
    loading,
  };
}
