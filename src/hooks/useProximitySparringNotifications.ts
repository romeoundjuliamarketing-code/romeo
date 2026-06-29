import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { haversineKm } from '../utils/geoUtils';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';

export const PROXIMITY_RADIUS_KEY = 'proximity_radius_km';
const NOTIFIED_KEY                 = 'proximity_notified_v1';
const NO_SPARRINGS_KEY             = 'no_sparrings_notified_at_v1';
const DEFAULT_RADIUS_KM            = 30;
const TTL_MS                       = 24 * 60 * 60 * 1000; // 24 hours
const NO_SPARRINGS_COOLDOWN_MS     = 7 * 24 * 60 * 60 * 1000; // 7 days

type NotifiedMap = Record<string, string>; // sparringId → ISO timestamp

// Rotating copy for the "nothing nearby" nudge so the notification does not
// feel identical every week. One variant is picked at random per send.
const NO_SPARRINGS_VARIANTS: ReadonlyArray<(radiusKm: number) => { title: string; body: string }> = [
  (km) => ({
    title: 'Keine Sparrings in deiner Nähe',
    body:  `Im Umkreis von ${km} km ist nichts los. Meld doch selber eins an.`,
  }),
  (km) => ({
    title: 'Ganz schön ruhig hier',
    body:  `Im Umkreis von ${km} km hat keiner ein Sparring angesetzt. Sei der Erste.`,
  }),
  (km) => ({
    title: 'Niemand am Start?',
    body:  `${km} km im Umkreis – noch kein Sparring. Erstell eins und hol die Leute aus der Deckung.`,
  }),
  (km) => ({
    title: 'Zeit für Action',
    body:  `In deinen ${km} km tut sich gerade nichts. Setz ein Sparring an und finde Trainingspartner.`,
  }),
  (km) => ({
    title: 'Dein Move',
    body:  `Kein Sparring im Umkreis von ${km} km. Mach den Anfang – die anderen ziehen nach.`,
  }),
  (km) => ({
    title: 'Handschuhe schon gepackt?',
    body:  `Im Umkreis von ${km} km ist Flaute. Meld ein Sparring an und bring Bewegung rein.`,
  }),
];

function pickNoSparringsContent(radiusKm: number): { title: string; body: string } {
  const variant = NO_SPARRINGS_VARIANTS[Math.floor(Math.random() * NO_SPARRINGS_VARIANTS.length)];
  return variant(radiusKm);
}

// Runs once per app session when the user is available
export function useProximitySparringNotifications(): void {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const hasRun = useRef(false);

  useEffect(() => {
    if (user === null || hasRun.current) return;
    hasRun.current = true;
    void checkProximitySparrings();
  }, [user]);

  // Handle taps on the "no sparrings nearby" notification — open the create flow.
  useEffect(() => {
    function handleResponse(response: Notifications.NotificationResponse): void {
      const data = response.notification.request.content.data as { type?: string };
      if (data.type === 'no_sparrings_nearby') {
        navigation.navigate('SparringMap', { openCreate: true });
      }
    }

    // Cold start: app launched by tapping the notification.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response !== null) handleResponse(response);
    });

    // Warm taps while the app is running.
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => sub.remove();
  }, [navigation]);
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

  if (rowsError !== null) {
    await AsyncStorage.setItem(NOTIFIED_KEY, JSON.stringify(pruned));
    return;
  }

  const allRows = rows ?? [];

  // 7. Count ALL active upcoming sparrings within radius (regardless of notified state)
  const withinRadiusCount = allRows.filter(
    (r) => haversineKm(latitude, longitude, r.lat as number, r.lng as number) <= radiusKm,
  ).length;

  // 7a. No sparrings nearby → nudge the user to create one (max once per week)
  if (withinRadiusCount === 0) {
    const lastNoSparrings = await AsyncStorage.getItem(NO_SPARRINGS_KEY);
    const canNotify =
      lastNoSparrings === null ||
      Date.now() - new Date(lastNoSparrings).getTime() >= NO_SPARRINGS_COOLDOWN_MS;
    if (canNotify) {
      try {
        const { title, body } = pickNoSparringsContent(radiusKm);
        await Notifications.scheduleNotificationAsync({
          identifier: 'no-sparrings-nearby',
          content: {
            title,
            body,
            data:  { type: 'no_sparrings_nearby' },
          },
          trigger: null,
        });
        await AsyncStorage.setItem(NO_SPARRINGS_KEY, new Date().toISOString());
      } catch {
        // Scheduling failed — do not record the timestamp so we retry next session
      }
    }
  }

  // 8. Filter sparrings within radius that haven't been notified yet; carry distance to avoid double-call
  const toNotify = allRows
    .filter((r) => pruned[r.id] === undefined)
    .map((r) => ({ ...r, dist: haversineKm(latitude, longitude, r.lat as number, r.lng as number) }))
    .filter((r) => r.dist <= radiusKm);

  // 9. Fire local notifications
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
