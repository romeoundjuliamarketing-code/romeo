import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PROXIMITY_RADIUS_KEY, DEFAULT_RADIUS_KM } from './useProximitySparringNotifications';
import { computeStartRegion } from '../utils/mapStartRegion';
import type { GeoPoint, MapRegion } from '../utils/mapStartRegion';

interface Options {
  /** Marker positions the start view should take into account. */
  points:      GeoPoint[];
  /** True once the first marker load finished (cache or network). */
  pointsReady: boolean;
  /** Fallback anchor without a position (the user's own studio). */
  home:        GeoPoint | null;
}

// Last known fixes up to this age are good enough for the start view.
const LAST_KNOWN_MAX_AGE_MS = 10 * 60 * 1000;
// Decide at the latest after this, even if markers or GPS are still loading.
const DECIDE_TIMEOUT_MS     = 3000;

// Decides the map's start viewport ONCE per mount: search radius around the
// position (or home studio), widened to the nearest hit when that is empty.
// The location request is the one the map always made on open — no new prompt.
export function useMapStartRegion({ points, pointsReady, home }: Options): MapRegion | null {
  const [region, setRegion]             = useState<MapRegion | null>(null);
  const [user, setUser]                 = useState<GeoPoint | null>(null);
  const [radiusKm, setRadiusKm]         = useState(DEFAULT_RADIUS_KM);
  const [locationDone, setLocationDone] = useState(false);
  const [timedOut, setTimedOut]         = useState(false);
  const decidedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(PROXIMITY_RADIUS_KEY);
        const parsed = raw !== null ? parseInt(raw, 10) : NaN;
        if (!cancelled && !Number.isNaN(parsed)) setRadiusKm(parsed);
      } catch {
        // Unreadable preference: keep the default radius.
      }
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
          const pos = last ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (!cancelled) setUser({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch {
        // No fix (e.g. location services off): continue without a position.
      }
      if (!cancelled) setLocationDone(true);
    })();
    const timer = setTimeout(() => setTimedOut(true), DECIDE_TIMEOUT_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (decidedRef.current) return;
    if (!timedOut && !(locationDone && pointsReady)) return;
    decidedRef.current = true;
    setRegion(computeStartRegion({ user, home, radiusKm, points }));
  }, [timedOut, locationDone, pointsReady, user, home, radiusKm, points]);

  return region;
}
