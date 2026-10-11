import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GeoPoint } from '../utils/mapStartRegion';
import i18n from '../i18n';

// Shared search location for "sparrings near me" (Home card, map, list).
// Either the device position or a place the user picked by hand. The manual
// choice is stored locally and wins until the user switches back to the device
// position. Foreground location only — no background tracking.

const MANUAL_KEY = 'sparring_search_location_v1';
// Last known fixes up to this age are good enough for a search anchor.
const LAST_KNOWN_MAX_AGE_MS = 10 * 60 * 1000;

export interface SearchLocation extends GeoPoint {
  source: 'device' | 'manual';
  /** "Dein Standort" or the picked address. */
  label: string;
}

export type SearchLocationStatus = 'loading' | 'ready' | 'none';

interface StoreState {
  status:   SearchLocationStatus;
  location: SearchLocation | null;
}

// Module-level store so every mounted consumer sees the same location, e.g. a
// place picked on the map shows up on Home without a reload.
let state: StoreState = { status: 'loading', location: null };
let resolving: Promise<void> | null = null;
// Bumped by every explicit choice, so a slower automatic lookup never overwrites it.
let version = 0;
const listeners = new Set<(s: StoreState) => void>();

function publish(next: StoreState): void {
  state = next;
  for (const l of listeners) l(state);
}

async function readManual(): Promise<SearchLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(MANUAL_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as { lat?: unknown; lng?: unknown; label?: unknown };
    if (typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number') return null;
    const label = typeof parsed.label === 'string' && parsed.label.length > 0 ? parsed.label : i18n.t('sparring.searchLocation.picked');
    return { lat: parsed.lat, lng: parsed.lng, label, source: 'manual' };
  } catch {
    return null;
  }
}

async function readDevice(askPermission: boolean): Promise<SearchLocation | null> {
  try {
    const { status } = askPermission
      ? await Location.requestForegroundPermissionsAsync()
      : await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
    const pos = last ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, label: i18n.t('sparring.searchLocation.device'), source: 'device' };
  } catch {
    // Location services off or no fix.
    return null;
  }
}

async function resolve(askPermission: boolean): Promise<void> {
  const started = version;
  const manual = await readManual();
  const location = manual ?? await readDevice(askPermission);
  if (version !== started) return;
  publish({ status: location !== null ? 'ready' : 'none', location });
}

interface Options {
  /**
   * Ask for location permission when none was granted yet. Only where the user
   * is looking for sparrings on the map/list — Home only checks.
   */
  askPermission: boolean;
}

export function useSearchLocation({ askPermission }: Options): {
  status:    SearchLocationStatus;
  location:  SearchLocation | null;
  setManual: (lat: number, lng: number, label: string) => Promise<void>;
  /** Resolves true when a device position was found (asks for permission if needed). */
  switchToDevice: () => Promise<boolean>;
} {
  const [snapshot, setSnapshot] = useState<StoreState>(state);

  useEffect(() => {
    listeners.add(setSnapshot);
    setSnapshot(state);
    // Resolve once per app session; a screen that may ask for permission
    // retries when the silent check found nothing.
    if (resolving === null || (askPermission && state.status === 'none')) {
      resolving = resolve(askPermission);
    }
    return () => { listeners.delete(setSnapshot); };
  }, [askPermission]);

  const setManual = useCallback(async (lat: number, lng: number, label: string): Promise<void> => {
    version += 1;
    publish({ status: 'ready', location: { lat, lng, label, source: 'manual' } });
    try {
      await AsyncStorage.setItem(MANUAL_KEY, JSON.stringify({ lat, lng, label }));
    } catch {
      // Not persisted: still used for this session.
    }
  }, []);

  const switchToDevice = useCallback(async (): Promise<boolean> => {
    version += 1;
    const started = version;
    try {
      await AsyncStorage.removeItem(MANUAL_KEY);
    } catch {
      // Ignore: the device position is used for this session anyway.
    }
    publish({ status: 'loading', location: null });
    const device = await readDevice(true);
    if (version !== started) return device !== null;
    publish({ status: device !== null ? 'ready' : 'none', location: device });
    return device !== null;
  }, []);

  return { status: snapshot.status, location: snapshot.location, setManual, switchToDevice };
}
