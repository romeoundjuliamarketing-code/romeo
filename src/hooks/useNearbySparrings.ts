import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';
import { enrichSparringRows } from './useOpenSparrings';
import type { OpenSparringRow, SparringWithMeta, StudioJoin } from './useOpenSparrings';
import { DACH_BOX, boundingBox, withinRadius } from '../utils/sparringSearch';
import type { SearchRadius, WithDistance } from '../utils/sparringSearch';
import type { GeoPoint } from '../utils/mapStartRegion';

export type NearbySparring = WithDistance<SparringWithMeta> & {
  host_name:       string | null;
  host_avatar_url: string | null;
};

export type NearbyStatus = 'idle' | 'loading' | 'ready' | 'error';

type HostJoin = { name: string | null; avatar_url: string | null } | null;
type NearbyRow = OpenSparringRow & { studios: StudioJoin; host: HostJoin };

// Upcoming sparrings within `radiusKm` of `center` (null: all of DACH), nearest first. The one
// source for the Home count, the map markers and the list — they only differ
// in how they show the result.
//
// The server narrows by bounding box (RLS applies as for every read: active
// sparrings for signed-in users); the exact radius cut and the distance sort
// run over the complete candidate set here, so count and order never depend
// on a page.
export function useNearbySparrings(
  center: GeoPoint | null,
  radiusKm: SearchRadius,
  refetchTrigger = 0,
): {
  status:    NearbyStatus;
  sparrings: NearbySparring[];
  refetch:   () => void;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const lat = center?.lat ?? null;
  const lng = center?.lng ?? null;
  const cacheKey = userId !== null && lat !== null && lng !== null
    ? `useNearbySparrings:${userId}:${lat.toFixed(4)}:${lng.toFixed(4)}:${radiusKm ?? 'all'}`
    : null;

  const [result, setResult] = useState<{ key: string | null; sparrings: NearbySparring[] }>(() => ({
    key: cacheKey,
    sparrings: cacheKey !== null ? getCached<NearbySparring[]>(cacheKey) ?? [] : [],
  }));
  const [status, setStatus] = useState<NearbyStatus>(() => {
    if (cacheKey === null) return 'idle';
    return getCached<NearbySparring[]>(cacheKey) !== undefined ? 'ready' : 'loading';
  });
  const [localTrigger, setLocalTrigger] = useState(0);
  // Only the newest request may write; older answers are dropped.
  const requestRef = useRef(0);

  const refetch = useCallback(() => setLocalTrigger((n) => n + 1), []);

  useEffect(() => {
    const requestId = ++requestRef.current;
    if (userId === null || lat === null || lng === null || cacheKey === null) {
      setResult({ key: null, sparrings: [] });
      setStatus('idle');
      return;
    }

    // Stale-while-revalidate: keep showing what is known for this search.
    const cached = getCached<NearbySparring[]>(cacheKey);
    // A failed background refresh keeps the known result instead of an error.
    const failStatus: NearbyStatus = cached !== undefined ? 'ready' : 'error';
    if (cached !== undefined) {
      setResult({ key: cacheKey, sparrings: cached });
      setStatus('ready');
    } else {
      setResult((prev) => (prev.key === cacheKey ? prev : { key: cacheKey, sparrings: [] }));
      setStatus('loading');
    }

    void (async () => {
      const now = new Date();
      const nowIso = now.toISOString();
      const origin = { lat, lng };
      const box = radiusKm === null ? DACH_BOX : boundingBox(origin, radiusKm);

      const { data: rows, error } = await supabase
        .from('open_sparrings')
        .select('*, studios!studio_id(name, city), host:profiles!created_by(name, avatar_url)')
        .eq('is_active', true)
        .gte('scheduled_at', nowIso)
        .gte('lat', box.minLat)
        .lte('lat', box.maxLat)
        .gte('lng', box.minLng)
        .lte('lng', box.maxLng);

      if (requestId !== requestRef.current) return;
      if (error !== null) {
        reportNetworkError(error);
        setStatus(failStatus);
        return;
      }

      const candidates = withinRadius((rows ?? []) as NearbyRow[], origin, radiusKm, now);
      const { data: enriched, error: enrichError } = await enrichSparringRows(candidates, userId, nowIso);

      if (requestId !== requestRef.current) return;
      if (enrichError !== null) {
        // Counts or own status would be wrong — show an error, not half data.
        reportNetworkError(enrichError);
        setStatus(failStatus);
        return;
      }

      const next: NearbySparring[] = enriched.map((s, i) => ({
        ...s,
        distance_km:     candidates[i].distance_km,
        host_name:       candidates[i].host?.name ?? null,
        host_avatar_url: candidates[i].host?.avatar_url ?? null,
      }));

      reportNetworkSuccess();
      setCached<NearbySparring[]>(cacheKey, next);
      setResult({ key: cacheKey, sparrings: next });
      setStatus('ready');
    })();
  }, [userId, lat, lng, radiusKm, cacheKey, refetchTrigger, localTrigger]);

  return { status, sparrings: result.sparrings, refetch };
}
