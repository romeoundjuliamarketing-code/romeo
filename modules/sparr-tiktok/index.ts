import { requireOptionalNativeModule } from 'expo';

// TikTok App Events SDK (iOS only). On Android, in Jest and in builds made
// before the module existed the native side is missing and every call is a no-op.
export type TrackingPermission = 'authorized' | 'denied' | 'restricted' | 'notDetermined';

interface SparrTikTokNative {
  requestTrackingPermission(): Promise<TrackingPermission>;
  initialize(appId: string, tiktokAppId: string, accessToken: string, debug: boolean): Promise<boolean>;
  trackEvent(name: string): void;
}

const native = requireOptionalNativeModule<SparrTikTokNative>('SparrTikTok');

export function isTikTokAvailable(): boolean {
  return native !== null;
}

export async function requestTrackingPermission(): Promise<TrackingPermission> {
  if (native === null) return 'denied';
  return native.requestTrackingPermission();
}

export async function initializeTikTok(
  appId: string,
  tiktokAppId: string,
  accessToken: string,
  debug: boolean,
): Promise<boolean> {
  if (native === null) return false;
  return native.initialize(appId, tiktokAppId, accessToken, debug);
}

export function trackTikTokNativeEvent(name: string): void {
  if (native === null) return;
  native.trackEvent(name);
}
