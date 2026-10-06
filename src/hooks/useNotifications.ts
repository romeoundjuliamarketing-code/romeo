import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

// Push tokens only work on physical devices with APNs configured
const IS_REAL_DEVICE = Platform.OS !== 'web';

const PROJECT_ID = '9811826e-5835-47ff-9c96-8fb7a14cdab3';
const CLEANUP_KEY = 'notifications_legacy_cleanup_v1';

// Configure how notifications are shown while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function savePushToken(token: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user === null) return;
  await supabase.from('profiles').update({ expo_push_token: token }).eq('id', user.id);
}

// Water, weekly weight and studio training reminders were scheduled locally on
// the device by older versions. The features are gone, so clear them once per
// install — otherwise the daily/weekly triggers keep firing.
const LEGACY_IDS: readonly string[] = ['water-9', 'water-13', 'water-17', 'weight-monday'];
const LEGACY_PREFIXES: readonly string[] = ['training-', 'preworkout-'];

async function cancelLegacyNotifications(): Promise<void> {
  const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    allScheduled
      .filter((n) =>
        LEGACY_IDS.includes(n.identifier)
        || LEGACY_PREFIXES.some((prefix) => n.identifier.startsWith(prefix)),
      )
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined)),
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications(): void {
  useEffect(() => {
    void (async () => {
      // Cleanup does not need notification permission.
      const cleaned = await AsyncStorage.getItem(CLEANUP_KEY);
      if (cleaned !== 'true') {
        try {
          await cancelLegacyNotifications();
          await AsyncStorage.setItem(CLEANUP_KEY, 'true');
        } catch {
          // retried on next start
        }
      }

      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      // Push tokens only available on real devices with APNs configured
      if (IS_REAL_DEVICE) {
        try {
          const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
          await savePushToken(token);
        } catch {
          // missing APNs entitlement or EAS credentials — silently skip
        }
      }
    })();
  }, []);
}
