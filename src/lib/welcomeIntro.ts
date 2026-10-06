import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { INTRO_SEEN_VALUE, parseIntroSeen } from '../utils/authEntry';

// Device-level flag for the pre-login welcome intro. Deliberately its own
// AsyncStorage key (not queryCache): it must survive sign-out, so a logout
// never forces the intro again.
const STORAGE_KEY = 'sparr.welcomeIntro.v1';

// Dev-only preview: with EXPO_PUBLIC_PREVIEW_WELCOME_INTRO=1 the intro shows on
// every signed-out start and nothing is ever marked as seen.
const PREVIEW = __DEV__ && process.env.EXPO_PUBLIC_PREVIEW_WELCOME_INTRO === '1';

let seen: boolean | null = null;
let loadStarted = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load(): void {
  if (loadStarted) return;
  loadStarted = true;
  if (PREVIEW) {
    seen = false;
    emit();
    return;
  }
  AsyncStorage.getItem(STORAGE_KEY)
    .then((v) => { if (seen === null) seen = parseIntroSeen(v); })
    // Storage unreadable: show the intro; it never blocks the login.
    .catch(() => { if (seen === null) seen = false; })
    .finally(emit);
}

// null while the stored value is still loading.
export function useWelcomeIntroSeen(): boolean | null {
  useEffect(load, []);
  return useSyncExternalStore(subscribe, () => seen);
}

// Called on "Überspringen", "Anmelden" and "Konto erstellen" — not on viewing.
export function markWelcomeIntroSeen(): void {
  if (PREVIEW || seen === true) return;
  seen = true;
  emit();
  void AsyncStorage.setItem(STORAGE_KEY, INTRO_SEEN_VALUE).catch(() => undefined);
}
