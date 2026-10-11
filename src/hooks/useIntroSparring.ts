import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchLocation } from './useSearchLocation';
import { useNearbySparrings, type NearbySparring } from './useNearbySparrings';
import { HOME_RADIUS_KM } from '../utils/sparringSearch';
import { pickIntroSparring } from '../utils/intro';

// A search that never answers counts as failed after this long, so the
// intro never waits on endlessly.
const LOAD_TIMEOUT_MS = 12000;

export type IntroSparringState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'none' }
  | { status: 'found'; sparring: NearbySparring };

// The sparring the intro's step 4 shows: the same nearby search as the
// sparring page (search location chosen in step 2, its start radius,
// nearest first), the first upcoming, active one with a free slot.
// Mounted from step 3 on, so the answer is usually there in time.
export function useIntroSparring(): { state: IntroSparringState; retry: () => void } {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { status: locationStatus, location } = useSearchLocation({ askPermission: false });
  const { status, sparrings, refetch } = useNearbySparrings(location, HOME_RADIUS_KM);
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const loading = locationStatus === 'loading' || (location !== null && (status === 'loading' || status === 'idle'));

  useEffect(() => {
    setTimedOut(false);
    if (!loading) return undefined;
    const timer = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loading, attempt]);

  const retry = useCallback((): void => {
    setAttempt((n) => n + 1);
    refetch();
  }, [refetch]);

  const state = useMemo<IntroSparringState>(() => {
    // No place at all (e.g. replay without one): nothing to search, the
    // example shows; the real search then asks for a place itself.
    if (locationStatus === 'none' || (locationStatus !== 'loading' && location === null)) return { status: 'none' };
    if (status === 'error') return { status: 'error' };
    if (loading) return timedOut ? { status: 'error' } : { status: 'loading' };
    // Own sparrings (possible on a replay) are no discovery.
    const hit = pickIntroSparring(sparrings.filter((s) => s.created_by !== userId), new Date());
    return hit !== null ? { status: 'found', sparring: hit } : { status: 'none' };
  }, [locationStatus, location, status, loading, timedOut, sparrings, userId]);

  return { state, retry };
}
