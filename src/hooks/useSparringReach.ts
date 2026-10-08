import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';
import { useAuth } from '../context/AuthContext';
import { SPARRING_TRUST } from '../data/sparringConfig';
import type { SparringReachStatus, SparringTrustState, SparringCheckinEntry } from '../types/sparringTrust';
import { serverOffsetMs } from '../utils/sparringTrust';

// Radius, planned slot, publication counter and intro state of the signed-in
// user (get_sparring_reach_status). Server is the only source for these values.
export function useSparringReach(refetchTrigger = 0): {
  status: SparringReachStatus | null;
  loading: boolean;
  error: boolean;
  refetch: () => void;
  ackIntro: () => Promise<boolean>;
  ackUnlock: () => Promise<void>;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const cacheKey = userId !== null ? `useSparringReach:${userId}` : null;
  const [status, setStatus] = useState<SparringReachStatus | null>(
    () => (cacheKey ? getCached<SparringReachStatus>(cacheKey) ?? null : null),
  );
  const [loading, setLoading] = useState(status === null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (userId === null) {
      setStatus(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error: rpcError } = await supabase.rpc('get_sparring_reach_status');
      if (cancelled) return;
      if (rpcError !== null || data === null) {
        reportNetworkError(rpcError);
        setError(true);
        setLoading(false);
        return;
      }
      reportNetworkSuccess();
      setStatus(data);
      setError(false);
      setLoading(false);
      if (cacheKey) setCached(cacheKey, data);
    })();
    return () => { cancelled = true; };
  }, [userId, cacheKey, refetchTrigger, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  // Stored per account with version; returns false on failure so "Weiter"
  // does not mark the intro as done locally.
  const ackIntro = useCallback(async (): Promise<boolean> => {
    const { error: rpcError } = await supabase.rpc('ack_sparring_intro', { p_version: SPARRING_TRUST.introVersion });
    if (rpcError !== null) {
      reportNetworkError(rpcError);
      return false;
    }
    setStatus((s) => (s === null ? s : { ...s, intro_acked: true }));
    return true;
  }, []);

  const ackUnlock = useCallback(async (): Promise<void> => {
    const { error: rpcError } = await supabase.rpc('ack_reach_unlock');
    if (rpcError === null) setStatus((s) => (s === null ? s : { ...s, unlock_unseen: false }));
  }, []);

  return { status, loading, error, refetch, ackIntro, ackUnlock };
}

// Role-aware check-in / confirmation state of one sparring, with the offset to
// server time for countdowns.
export function useSparringTrustState(sparringId: string | null, refetchTrigger = 0): {
  state: SparringTrustState | null;
  offsetMs: number;
  loading: boolean;
  error: boolean;
  refetch: () => void;
} {
  const [state, setState] = useState<SparringTrustState | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [loading, setLoading] = useState(sparringId !== null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (sparringId === null) {
      setState(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error: rpcError } = await supabase.rpc('get_sparring_trust_state', { p_sparring_id: sparringId });
      if (cancelled) return;
      if (rpcError !== null || data === null) {
        reportNetworkError(rpcError);
        setError(true);
        setLoading(false);
        return;
      }
      reportNetworkSuccess();
      setState(data);
      setOffsetMs(serverOffsetMs(data.server_now, Date.now()));
      setError(false);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sparringId, refetchTrigger, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { state, offsetMs, loading, error, refetch };
}

// Organizer-only list of checked-in participants (empty for everyone else).
export function useSparringCheckins(sparringId: string | null, refetchTrigger = 0): {
  entries: SparringCheckinEntry[];
  loading: boolean;
  refetch: () => void;
} {
  const [entries, setEntries] = useState<SparringCheckinEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (sparringId === null) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase.rpc('get_sparring_checkins', { p_sparring_id: sparringId });
      if (cancelled) return;
      if (error !== null) reportNetworkError(error);
      else setEntries(data ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sparringId, refetchTrigger, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { entries, loading, refetch };
}
