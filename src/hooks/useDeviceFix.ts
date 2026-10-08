import { useCallback, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import type { DeviceFix } from '../types/sparringTrust';
import { classifyFix } from '../utils/sparringTrust';

// One-shot, foreground-only device position for binding sparring actions
// (publish, join, check-in). Never uses the manual search location, the map
// centre or any stored profile position, and never tracks in the background.
// Positions are only sent to the server for the check and not stored there.

export type FixError =
  | 'services_off'   // location services switched off on the device
  | 'denied'         // permission denied, can be asked again
  | 'blocked'        // permission denied permanently -> settings
  | 'imprecise'      // only approximate location granted (iOS reduced / Android coarse)
  | 'timeout'        // no position in time
  | 'inaccurate'     // position too inaccurate (> 200 m)
  | 'unavailable';   // other failure of the location provider

export type FixOutcome = { ok: true; fix: DeviceFix } | { ok: false; error: FixError };

export type LocationPermissionState = 'granted' | 'undetermined' | 'denied' | 'blocked';

const FIX_TIMEOUT_MS = 15000;

// Last good fix of this app session, reused while still fresh enough.
let lastFix: DeviceFix | null = null;

export async function getLocationPermissionState(): Promise<LocationPermissionState> {
  const perm = await Location.getForegroundPermissionsAsync();
  if (perm.granted) return 'granted';
  if (perm.status === Location.PermissionStatus.UNDETERMINED) return 'undetermined';
  return perm.canAskAgain ? 'denied' : 'blocked';
}

function isImprecise(perm: Location.LocationPermissionResponse): boolean {
  if (Platform.OS === 'ios') return perm.ios?.accuracy === 'reduced';
  if (Platform.OS === 'android') return perm.android?.accuracy === 'coarse';
  return false;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve('timeout'), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err: unknown) => { clearTimeout(timer); reject(err); },
    );
  });
}

// Asks for permission only when the caller allows it (after the in-app primer).
export async function acquireDeviceFix(askPermission: boolean): Promise<FixOutcome> {
  if (lastFix !== null && classifyFix(lastFix, Date.now()) === 'ok') {
    return { ok: true, fix: lastFix };
  }
  try {
    if (!(await Location.hasServicesEnabledAsync())) return { ok: false, error: 'services_off' };

    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && askPermission && perm.canAskAgain) {
      perm = await Location.requestForegroundPermissionsAsync();
    }
    if (!perm.granted) return { ok: false, error: perm.canAskAgain ? 'denied' : 'blocked' };
    if (isImprecise(perm)) return { ok: false, error: 'imprecise' };

    const pos = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      FIX_TIMEOUT_MS,
    );
    if (pos === 'timeout') return { ok: false, error: 'timeout' };

    const fix: DeviceFix = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracyM: pos.coords.accuracy ?? Number.POSITIVE_INFINITY,
      timestamp: pos.timestamp,
    };
    const quality = classifyFix(fix, Date.now());
    if (quality === 'inaccurate') return { ok: false, error: 'inaccurate' };
    // A provider may hand back a cached reading: treat an old one like a timeout.
    if (quality === 'stale') return { ok: false, error: 'timeout' };
    lastFix = fix;
    return { ok: true, fix };
  } catch {
    return { ok: false, error: 'unavailable' };
  }
}

// Forget the cached fix (e.g. before a check-in renewal that needs a new one).
export function clearDeviceFix(): void {
  lastFix = null;
}

export function openLocationSettings(): void {
  void Linking.openSettings();
}

export function useDeviceFix(): {
  measuring: boolean;
  measure: (askPermission: boolean) => Promise<FixOutcome>;
} {
  const [measuring, setMeasuring] = useState(false);
  const measure = useCallback(async (askPermission: boolean): Promise<FixOutcome> => {
    setMeasuring(true);
    try {
      return await acquireDeviceFix(askPermission);
    } finally {
      setMeasuring(false);
    }
  }, []);
  return { measuring, measure };
}
