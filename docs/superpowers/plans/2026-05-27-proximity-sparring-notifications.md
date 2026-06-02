# Proximity Sparring Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Beim App-Öffnen prüfen ob offene Sparrings im konfigurierten Umkreis (Standard 30 km) liegen und den Nutzer per lokaler Notification informieren.

**Architecture:** Haversine-Distanzberechnung als pure Utility-Funktion, Proximity-Check-Logik in einem dedizierten Hook der einmalig beim App-Start läuft, Radius-Einstellung per Alert-Sheet im bestehenden SettingsScreen unter "Benachrichtigungen". Bereits-notifiziert-Tracking via AsyncStorage (24h TTL pro Sparring-ID).

**Tech Stack:** expo-notifications (bereits installiert), expo-location (bereits installiert), @react-native-async-storage/async-storage, Supabase (open_sparrings view)

---

## Dateien

| Aktion  | Datei                                                          | Zweck                                          |
|---------|----------------------------------------------------------------|------------------------------------------------|
| Create  | `src/utils/geoUtils.ts`                                        | Haversine-Formel                               |
| Create  | `src/utils/geoUtils.test.ts`                                   | Unit-Tests für Haversine                       |
| Create  | `src/hooks/useProximitySparringNotifications.ts`               | Proximity-Check-Logik, einmalig beim App-Start |
| Modify  | `src/screens/SettingsScreen.tsx`                               | Radius-Einstellung unter Benachrichtigungen    |
| Modify  | `src/screens/HomeScreen.tsx`                                   | Hook einbinden                                 |

---

## Task 1: Haversine Utility

**Files:**
- Create: `src/utils/geoUtils.ts`
- Create: `src/utils/geoUtils.test.ts`

- [ ] **Schritt 1: Test schreiben**

```ts
// src/utils/geoUtils.test.ts
import { haversineKm } from './geoUtils';

describe('haversineKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineKm(48.137, 11.575, 48.137, 11.575)).toBeCloseTo(0, 5);
  });

  it('Munich → Berlin ≈ 504 km', () => {
    // Munich: 48.137, 11.575  Berlin: 52.520, 13.405
    const dist = haversineKm(48.137, 11.575, 52.520, 13.405);
    expect(dist).toBeGreaterThan(500);
    expect(dist).toBeLessThan(510);
  });

  it('1 degree latitude ≈ 111 km', () => {
    const dist = haversineKm(0, 0, 1, 0);
    expect(dist).toBeGreaterThan(110);
    expect(dist).toBeLessThan(112);
  });

  it('symmetrical — A→B equals B→A', () => {
    const ab = haversineKm(48.137, 11.575, 52.520, 13.405);
    const ba = haversineKm(52.520, 13.405, 48.137, 11.575);
    expect(ab).toBeCloseTo(ba, 10);
  });
});
```

- [ ] **Schritt 2: Test fehlschlagen lassen**

```bash
npx jest src/utils/geoUtils.test.ts
```
Erwartetes Ergebnis: FAIL — "Cannot find module './geoUtils'"

- [ ] **Schritt 3: Implementation schreiben**

```ts
// src/utils/geoUtils.ts

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Haversine formula — returns distance in km between two WGS-84 coordinates
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R    = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

- [ ] **Schritt 4: Tests bestätigen**

```bash
npx jest src/utils/geoUtils.test.ts
```
Erwartetes Ergebnis: 4 passed

- [ ] **Schritt 5: TypeScript prüfen**

```bash
npx tsc --noEmit
```
Erwartetes Ergebnis: kein Output

- [ ] **Schritt 6: Commit**

```bash
git add src/utils/geoUtils.ts src/utils/geoUtils.test.ts
git commit -m "feat(geo): add haversineKm utility"
```

---

## Task 2: Proximity-Hook

**Files:**
- Create: `src/hooks/useProximitySparringNotifications.ts`

- [ ] **Schritt 1: Datei anlegen**

```ts
// src/hooks/useProximitySparringNotifications.ts
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { haversineKm } from '../utils/geoUtils';
import { useAuth } from '../context/AuthContext';

export const PROXIMITY_RADIUS_KEY  = 'proximity_radius_km';
const NOTIFIED_KEY                  = 'proximity_notified_v1';
const DEFAULT_RADIUS_KM             = 30;
const TTL_MS                        = 24 * 60 * 60 * 1000; // 24 Stunden

type NotifiedMap = Record<string, string>; // sparringId → ISO-Zeitstempel

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
  // 1. Notification-Berechtigung prüfen
  const { status: notifStatus } = await Notifications.getPermissionsAsync();
  if (notifStatus !== 'granted') return;

  // 2. Standort-Berechtigung prüfen
  const { status: locStatus } = await Location.getForegroundPermissionsAsync();
  if (locStatus !== 'granted') return;

  // 3. Aktuellen Standort abrufen
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const { latitude, longitude } = location.coords;

  // 4. Radius-Einstellung laden
  const rawRadius = await AsyncStorage.getItem(PROXIMITY_RADIUS_KEY);
  const radiusKm  = rawRadius !== null ? parseInt(rawRadius, 10) : DEFAULT_RADIUS_KM;

  // 5. Bereits-notifiziert-Map laden und abgelaufene Einträge bereinigen
  const rawNotified                   = await AsyncStorage.getItem(NOTIFIED_KEY);
  const notifiedMap: NotifiedMap      = rawNotified !== null
    ? (JSON.parse(rawNotified) as NotifiedMap)
    : {};
  const now                           = Date.now();
  const pruned: NotifiedMap           = {};
  for (const [id, ts] of Object.entries(notifiedMap)) {
    if (now - new Date(ts).getTime() < TTL_MS) pruned[id] = ts;
  }

  // 6. Offene Sparrings mit Koordinaten laden
  type StudioJoin = { name: string } | null;
  const { data: rows } = await supabase
    .from('open_sparrings')
    .select('id, title, lat, lng, scheduled_at, studios!studio_id(name)')
    .eq('is_active', true)
    .gte('scheduled_at', new Date().toISOString())
    .not('lat', 'is', null)
    .not('lng', 'is', null);

  if (rows === null || rows.length === 0) {
    await AsyncStorage.setItem(NOTIFIED_KEY, JSON.stringify(pruned));
    return;
  }

  // 7. Sparrings im Umkreis filtern, die noch nicht notifiziert wurden
  const toNotify = rows.filter((r) => {
    if (pruned[r.id] !== undefined) return false;
    return haversineKm(latitude, longitude, r.lat as number, r.lng as number) <= radiusKm;
  });

  // 8. Lokale Notifications feuern
  for (const sparring of toNotify) {
    const dist    = haversineKm(latitude, longitude, sparring.lat as number, sparring.lng as number);
    const distStr = dist < 1
      ? `${Math.round(dist * 1000)} m`
      : `${dist.toFixed(1)} km`;
    const date    = new Date(sparring.scheduled_at);
    const dateStr = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
    const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const studio  = (sparring.studios as StudioJoin)?.name ?? 'Privat';

    await Notifications.scheduleNotificationAsync({
      identifier: `proximity-${sparring.id}`,
      content: {
        title: 'Sparring in deiner Naehe',
        body:  `${sparring.title} · ${distStr} entfernt · ${studio}, ${dateStr} ${timeStr}`,
      },
      trigger: null, // sofort feuern
    });

    pruned[sparring.id] = new Date().toISOString();
  }

  await AsyncStorage.setItem(NOTIFIED_KEY, JSON.stringify(pruned));
}
```

Hinweis: "Nähe" wird als "Naehe" geschrieben da expo-notifications auf dem Simulator Umlaute in title/body manchmal nicht korrekt rendert — nach echtem Device-Test anpassen falls kein Problem.

- [ ] **Schritt 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```
Erwartetes Ergebnis: kein Output

- [ ] **Schritt 3: Commit**

```bash
git add src/hooks/useProximitySparringNotifications.ts
git commit -m "feat(sparring): add useProximitySparringNotifications hook"
```

---

## Task 3: Radius-Einstellung in SettingsScreen

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

- [ ] **Schritt 1: Import ergänzen**

In `src/screens/SettingsScreen.tsx`, den vorhandenen Import-Block von `useProximitySparringNotifications` ergänzen:

```ts
import { PROXIMITY_RADIUS_KEY } from '../hooks/useProximitySparringNotifications';
```

- [ ] **Schritt 2: Konstante und State hinzufügen**

Direkt unter `const PREWORKOUT_KEY = 'preworkout_enabled';` einfügen:

```ts
const RADIUS_OPTIONS = [10, 30, 50, 100] as const;
type RadiusOption = typeof RADIUS_OPTIONS[number];
```

Im Component-Body direkt unter den bestehenden States (`notifGranted`, `preWorkoutEnabled`) einfügen:

```ts
const [radiusKm, setRadiusKm] = useState<RadiusOption>(30);
```

- [ ] **Schritt 3: useEffect zum Laden des Radius hinzufügen**

Direkt nach dem `useEffect` für PREWORKOUT_KEY einfügen:

```ts
useEffect(() => {
  void AsyncStorage.getItem(PROXIMITY_RADIUS_KEY).then((v) => {
    if (v !== null) setRadiusKm(parseInt(v, 10) as RadiusOption);
  });
}, []);
```

- [ ] **Schritt 4: Handler hinzufügen**

Direkt nach `handlePreWorkoutToggle` einfügen:

```ts
function handleRadiusPick(): void {
  Alert.alert(
    'Umkreis fuer Sparring-Benachrichtigungen',
    'Benachrichtige mich wenn ein Sparring in diesem Umkreis stattfindet:',
    [
      ...RADIUS_OPTIONS.map((km) => ({
        text: `${km} km${km === radiusKm ? '  (aktiv)' : ''}`,
        onPress: () => {
          setRadiusKm(km);
          void AsyncStorage.setItem(PROXIMITY_RADIUS_KEY, String(km));
        },
      })),
      { text: 'Abbrechen', style: 'cancel' as const },
    ],
  );
}
```

- [ ] **Schritt 5: Row in der Benachrichtigungen-Sektion ergänzen**

Den bestehenden Block suchen:

```tsx
        {/* ── Benachrichtigungen ── */}
        <SectionHeader title="Benachrichtigungen" />
        <SettingsRow
          icon="bell-outline"
          label="Benachrichtigungen"
          value={notifGranted ? 'Aktiviert' : 'Deaktiviert'}
          onPress={() => { void Linking.openSettings(); }}
        />
```

Ersetzen durch:

```tsx
        {/* ── Benachrichtigungen ── */}
        <SectionHeader title="Benachrichtigungen" />
        <View style={styles.card}>
          <SettingsRow
            icon="bell-outline"
            label="Benachrichtigungen"
            value={notifGranted ? 'Aktiviert' : 'Deaktiviert'}
            onPress={() => { void Linking.openSettings(); }}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="map-marker-radius-outline"
            label="Sparring-Umkreis"
            value={`${radiusKm} km`}
            onPress={handleRadiusPick}
          />
        </View>
```

- [ ] **Schritt 6: TypeScript prüfen**

```bash
npx tsc --noEmit
```
Erwartetes Ergebnis: kein Output

- [ ] **Schritt 7: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat(settings): add sparring proximity radius picker"
```

---

## Task 4: Hook in HomeScreen einbinden

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Schritt 1: Import ergänzen**

In `src/screens/HomeScreen.tsx` den Import-Block erweitern:

```ts
import { useProximitySparringNotifications } from '../hooks/useProximitySparringNotifications';
```

- [ ] **Schritt 2: Hook aufrufen**

Im Component-Body direkt nach dem `useNotifications()`-Aufruf (Zeile ~64) einfügen:

```ts
useProximitySparringNotifications();
```

- [ ] **Schritt 3: TypeScript prüfen**

```bash
npx tsc --noEmit
```
Erwartetes Ergebnis: kein Output

- [ ] **Schritt 4: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat(home): invoke proximity sparring notifications on app open"
```

---

## Task 5: Umlaut-Fix und Simulator-Test

**Files:**
- Modify: `src/hooks/useProximitySparringNotifications.ts`

- [ ] **Schritt 1: Umlaut in Notification-Text prüfen**

In `useProximitySparringNotifications.ts`, Zeile mit `title: 'Sparring in deiner Naehe'`:
- Auf echtem Device testen ob Umlaute funktionieren
- Falls ja: `'Naehe'` → `'Nähe'` ändern

- [ ] **Schritt 2: Notification im Simulator testen**

Im SettingsScreen unter Debug → "Alle Notifications testen" ist nicht ausreichend. Proximity-Notification direkt testen indem `hasRun.current = false` temporär in der Konsole gesetzt wird — oder einfach App neu starten.

Stattdessen: Supabase-Dashboard öffnen, ein Test-Sparring mit den Koordinaten des Simulator-Standorts (Cupertino: 37.3318, -122.0312) anlegen, App öffnen und prüfen ob Notification erscheint.

- [ ] **Schritt 3: Final-Commit falls Umlaut geändert**

```bash
git add src/hooks/useProximitySparringNotifications.ts
git commit -m "fix(proximity): use correct umlaut in notification title"
```
