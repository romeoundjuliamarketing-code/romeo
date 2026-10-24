import { Platform } from 'react-native';
import {
  initializeTikTok,
  isTikTokAvailable,
  requestTrackingPermission,
  trackTikTokNativeEvent,
} from '../../modules/sparr-tiktok';

// TikTok App Events, iOS only for now (Android needs its own app connection in
// TikTok Events Manager). The SDK only starts after the user allowed tracking
// in the ATT prompt; without that nothing is sent to TikTok.
// Install, launch and StoreKit purchases are reported by the SDK itself.
const APP_ID = process.env.EXPO_PUBLIC_TIKTOK_APP_ID ?? '';
const TIKTOK_APP_ID = process.env.EXPO_PUBLIC_TIKTOK_TIKTOK_APP_ID ?? '';
const APP_SECRET = process.env.EXPO_PUBLIC_TIKTOK_APP_SECRET ?? '';

export type TikTokEvent = 'Registration';

let started = false;
// True once the user answered the ATT prompt with anything but "allow".
let declined = false;
let starting: Promise<void> | null = null;
// Events fired before the SDK runs (Registration happens before the prompt).
const pending: TikTokEvent[] = [];

function isConfigured(): boolean {
  return Platform.OS === 'ios'
    && isTikTokAvailable()
    && APP_ID.length > 0
    && TIKTOK_APP_ID.length > 0
    && APP_SECRET.length > 0;
}

function send(event: TikTokEvent): void {
  try {
    trackTikTokNativeEvent(event);
  } catch {
    // Tracking must never break the app.
  }
}

function debugLog(message: string): void {
  if (__DEV__) console.log(`[TikTok] ${message}`);
}

/** Asks for tracking permission and starts the SDK. Safe to call repeatedly. */
export function startTikTok(): Promise<void> {
  if (!isConfigured()) {
    debugLog(`not configured: ios=${String(Platform.OS === 'ios')} native=${String(isTikTokAvailable())} appId=${String(APP_ID.length > 0)} tiktokAppId=${String(TIKTOK_APP_ID.length > 0)} secret=${String(APP_SECRET.length > 0)}`);
    return Promise.resolve();
  }
  if (started || declined) return Promise.resolve();
  if (starting !== null) return starting;
  starting = (async () => {
    try {
      const permission = await requestTrackingPermission();
      debugLog(`tracking permission: ${permission}`);
      if (permission === 'notDetermined') return; // prompt blocked, retried later
      if (permission !== 'authorized') {
        declined = true;
        pending.length = 0;
        return;
      }
      await initializeTikTok(APP_ID, TIKTOK_APP_ID, APP_SECRET, __DEV__);
      started = true;
      debugLog('SDK started');
      pending.splice(0).forEach(send);
    } catch (e) {
      // Tracking must never break the app.
      debugLog(`start failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      starting = null;
    }
  })();
  return starting;
}

export function trackTikTokEvent(event: TikTokEvent): void {
  if (started) send(event);
  else if (!declined) pending.push(event);
}
