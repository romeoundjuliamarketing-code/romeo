import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { haversineKm } from '../utils/geoUtils';
import { useAuth } from '../context/AuthContext';

export const PROXIMITY_RADIUS_KEY = 'proximity_radius_km';
const NOTIFIED_KEY                 = 'proximity_notified_v1';
const DEFAULT_RADIUS_KM            = 30;
const TTL_MS                       = 24 * 60 * 60 * 1000; // 24 hours

type NotifiedMap = Record<string, string>; // sparringId → ISO timestamp

// Runs once per app session when the user is available
export function useProximitySparringNotifications(): void {
  const { user } = useAuth();
  const hasRun = useRef(false);

  useEffect(() => {
    if (user === null || hasRun.current) return;
    hasRun.current = true;
    void checkProximitySparrings();
  }, [user]);
}

async function checkProximitySparrings(): Promise<void> {
  // 1. Check notification permission
  const { status: notifStatus } = await Notifications.getPermissionsAsync();
  if (notifStatus !== 'granted') return;

  // 2. Check location permission
  const { status: locStatus } = await Location.getForegroundPermissionsAsync();
  if (locStatus !== 'granted') return;

  // 3. Get current location
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const { latitude, longitude } = location.coords;

  // 4. Load radius preference
  const rawRadius = await AsyncStorage.getItem(PROXIMITY_RADIUS_KEY);
  const parsed   = rawRadius !== null ? parseInt(rawRadius, 10) : DEFAULT_RADIUS_KM;
  const radiusKm = Number.isNaN(parsed) ? DEFAULT_RADIUS_KM : parsed;

  // 5. Load already-notified map and prune expired entries
  const rawNotified            = await AsyncStorage.getItem(NOTIFIED_KEY);
  let notifiedMap: NotifiedMap = {};
  if (rawNotified !== null) {
    try {
      notifiedMap = JSON.parse(rawNotified) as NotifiedMap;
    } catch {
      // corrupt AsyncStorage value — start with empty map
    }
  }
  const now             = Date.now();
  const pruned: NotifiedMap = {};
  for (const [id, ts] of Object.entries(notifiedMap)) {
    if (now - new Date(ts).getTime() < TTL_MS) pruned[id] = ts;
  }

  // 6. Fetch upcoming open sparrings with coordinates
  type StudioJoin = { name: string } | null;
  const { data: rows, error: rowsError } = await supabase
    .from('open_sparrings')
    .select('id, title, lat, lng, scheduled_at, studios!studio_id(name)')
    .eq('is_active', true)
    .gte('scheduled_at', new Date().toISOString())
    .not('lat', 'is', null)
    .not('lng', 'is', null);

  if (rowsError !== null || rows === null || rows.length === 0) {
    await AsyncStorage.setItem(NOTIFIED_KEY, JSON.stringify(pruned));
    return;
  }

  // 7. Filter sparrings within radius that haven't been notified yet; carry distance to avoid double-call
  const toNotify = rows
    .filter((r) => pruned[r.id] === undefined)
    .map((r) => ({ ...r, dist: haversineKm(latitude, longitude, r.lat as number, r.lng as number) }))
    .filter((r) => r.dist <= radiusKm);

  // 8. Fire local notifications
  for (const sparring of toNotify) {
    const dist    = sparring.dist;
    const distStr = dist < 1
      ? `${Math.round(dist * 1000)} m`
      : `${dist.toFixed(1)} km`;
    const date    = new Date(sparring.scheduled_at);
    const dateStr = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
    const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const studio  = (sparring.studios as StudioJoin)?.name ?? 'Privat';

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `proximity-${sparring.id}`,
        content: {
          title: 'Sparring in deiner Nähe',
          body:  `${sparring.title} · ${distStr} entfernt · ${studio}, ${dateStr} ${timeStr}`,
        },
        trigger: null,
      });
    } catch {
      // Scheduling failed — skip this entry, do not mark as notified
      continue;
    }
    pruned[sparring.id] = new Date().toISOString();
  }

  await AsyncStorage.setItem(NOTIFIED_KEY, JSON.stringify(pruned));
}
