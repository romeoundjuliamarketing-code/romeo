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

interface StoredState {
  area:    ChallengeArea;
  drawn:   Record<ChallengeArea, string[]>;
  current: Record<ChallengeArea, string | null>;
  done:    string[];
}

function emptyState(): StoredState {
  return {
    area:    DEFAULT_AREA,
    drawn:   emptyAreaRecord<string[]>(() => []),
    current: emptyAreaRecord<string | null>(() => null),
    done:    [],
  };
}

function isArea(value: unknown): value is ChallengeArea {
  return CHALLENGE_AREAS.some((a) => a.key === value);
}

function knownIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === 'string' && challengeById(id) !== null);
}

function knownId(id: unknown): string | null {
  return typeof id === 'string' && challengeById(id) !== null ? id : null;
}

// Parses the persisted blob defensively: anything unknown or stale (e.g. IDs from an
// older card set) is dropped instead of throwing, so the feature always stays usable.
function parseState(raw: string | null): { state: StoredState; hadArea: boolean } {
  const fallback = { state: emptyState(), hadArea: false };
  if (raw === null) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (typeof parsed !== 'object' || parsed === null) return fallback;

  const obj = parsed as Record<string, unknown>;
  const drawn = (typeof obj.drawn === 'object' && obj.drawn !== null ? obj.drawn : {}) as Record<string, unknown>;
  const current = (typeof obj.current === 'object' && obj.current !== null ? obj.current : {}) as Record<string, unknown>;

  const rawArea = obj.area;
  const hadArea = isArea(rawArea);
  const state: StoredState = {
    area:    hadArea ? rawArea : DEFAULT_AREA,
    drawn:   emptyAreaRecord<string[]>(() => []),
    current: emptyAreaRecord<string | null>(() => null),
    done:    knownIds(obj.done),
  };
  for (const { key } of CHALLENGE_AREAS) {
    state.drawn[key]   = knownIds(drawn[key]);
    state.current[key] = knownId(current[key]);
  }
  return { state, hadArea };
}

export interface UseSparringChallengeResult {
  area:      ChallengeArea;
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

// Keeps the drawn card, the draw history and the done markers on the device.
// No backend involved — the challenge deck is static app data.
export function useSparringChallenge(disciplines: string[]): UseSparringChallengeResult {
  const [state, setState] = useState<StoredState>(emptyState);
  const [loading, setLoading] = useState(true);
  // Mirrors `state` synchronously so a callback can read the current value and write
  // the next one in a single pass, without waiting for a re-render.
  const stateRef = useRef<StoredState>(state);
  // True once the user (or a previous session) picked an area explicitly — the profile
  // disciplines must not override that choice when the profile loads late.
  const areaChosen = useRef(false);

  // In-memory state leads; the write is fire-and-forget so the UI never waits on disk.
  const apply = useCallback((next: StoredState): void => {
    stateRef.current = next;
    setState(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        const { state: loaded, hadArea } = parseState(raw);
        areaChosen.current = hadArea;
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
    if (loading || areaChosen.current || disciplines.length === 0) return;
    const area = areaFromDisciplines(disciplines);
    if (area === stateRef.current.area) return;
    const next = { ...stateRef.current, area };
    stateRef.current = next;
    setState(next);
  }, [loading, disciplines]);

  const setArea = useCallback((area: ChallengeArea): void => {
    areaChosen.current = true;
    apply({ ...stateRef.current, area });
  }, [apply]);

  const draw = useCallback((): void => {
    const prev = stateRef.current;
    const result = drawChallenge(challengesForArea(prev.area), prev.drawn[prev.area]);
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
  const deckSize  = challengesForArea(state.area).length;

  return {
    area:       state.area,
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
