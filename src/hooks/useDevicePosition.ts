import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { GeoPoint } from '../utils/mapStartRegion';

// A last known fix up to this age is good enough for drawing the reach circle.
const LAST_KNOWN_MAX_AGE_MS = 10 * 60 * 1000;

// Device position for display only (e.g. the join reach circle). Never asks for
// permission: without an earlier grant or without a fix it stays null.
export function useDevicePosition(): GeoPoint | null {
  const [position, setPosition] = useState<GeoPoint | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
        const pos = last ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // Location services off or no fix: no circle.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return position;
}
