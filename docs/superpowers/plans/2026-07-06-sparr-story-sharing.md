# Sparr Story-Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einen einzelnen Sparr aus der App in die Instagram-Story (und in Chats) teilbar machen, über eine öffentliche Web-Landingpage pro Sparr, die zurück in die App bzw. den App Store führt.

**Architecture:** App rendert ein gebrandetes Story-Bild und teilt es + einen Link `https://DOMAIN/s/<id>`. Der Link ist ein Universal/App-Link: installierte App springt direkt zum Sparr, sonst öffnet eine kleine Next.js-Seite (Vercel) das „Schaufenster" (Daten aus einer öffentlichen Supabase-View `public_sparrings`) mit App-Store-Fallback. Beitreten passiert immer in der App.

**Tech Stack:** React Native + Expo SDK 55, React Navigation (Deep Linking), Supabase (View + Anon-Key), `react-native-view-shot`, `react-native-share`, Next.js (App Router) auf Vercel Free-Tier.

## Global Constraints

- **TypeScript strict, `any` verboten**, Typen explizit. Nach JEDER App-Codeänderung: `npx tsc --noEmit && npx jest`.
- **Kosten:** Nur Gratis-Infra (Vercel Free, bestehende Supabase-View/Anon-Key, OSS-Libs). Keine kostenpflichtigen Dienste aktivieren.
- **Designsystem** (App + Web): Farben nur aus `src/theme/colors.ts` — `background #F7F5F0`, `text #141414`, `accentBlue #4A90D9`, `dark #0A0A0A`, `card #FFFFFF`. Keine Hardcoded-Hex in der App. Font **Inter**. Abstände nur in 8px-Vielfachen.
- **Keine Emojis** (UI, Kommentare, Labels). Icons ausschließlich `@expo/vector-icons`.
- **Sprache:** UI-Texte Deutsch; Code-Kommentare Englisch; Umlaute immer als Ä/Ö/Ü/ä/ö/ü (nie Ae/Oe/Ue).
- **Styling App:** kein Inline-`style={{}}` — immer `StyleSheet.create` (Ausnahme: dynamische Werte wie berechnete Breite, wie im bestehenden Code).
- **Native Änderungen** brauchen einen Dev-/EAS-Build; bei nativen Änderungen `--no-build-cache`. Immer iOS UND Android bauen/testen.
- **Bundle/Package-ID (beide Plattformen):** `com.kombat.app`. Custom-Scheme: `sparr`.
- **DOMAIN-Platzhalter:** Es gibt noch keine Domain. Überall wird der Wert `sparr.app` als Platzhalter verwendet und ist an genau diesen Stellen zu ersetzen, sobald die echte Domain feststeht:
  1. `src/utils/sparringShare.ts` → `SHARE_BASE_URL`
  2. `app.config.js` → iOS `associatedDomains` + Android `intentFilters` host
  3. `web/.env` → `NEXT_PUBLIC_SITE_URL`
  4. `web/public/.well-known/*` (nur Fingerprints/AppID, kein Host)
- **Vault-Pflege:** Nach Umsetzung `Funktionen.md` + `API/Endpunkte.md` (View) + ggf. ADR ergänzen (append, vorher `_VAULT_SYSTEM.md` lesen).

## Ausführungsstrategie (Modell-/Kostendisziplin)

- **Umsetzung** der mechanischen Tasks (SQL-Migration, Story-Card-UI, Web-Scaffold, well-known-Dateien) von günstigeren Modellen (Fable/Sonnet-Subagenten). **Opus/starkes Modell** nur für Koordination und Review zwischen den Tasks. Kleine Änderungen (1–3 Dateien) inline ohne Subagent.

## File Structure

**App (`src/`)**
- `src/utils/sparringShare.ts` (Create) — pure Helfer: `SHARE_BASE_URL`, `buildSparringShareUrl(id)`, `sparringShareStatus(...)`. Keine RN-Imports → testbar.
- `src/utils/sparringShare.test.ts` (Create) — Unit-Tests dazu.
- `src/components/sparring/SparringStoryCard.tsx` (Create) — verstecktes 1080×1920 Branded-View für den Snapshot.
- `src/components/sparring/SparringDetailSheet.tsx` (Modify) — Teilen-Button + Story-Card-Ref + Share-Handler.
- `src/navigation/types.ts` (Modify) — `SparringMap`-Param um `focusSparringId?: string` erweitern.
- `src/screens/SparringMapScreen.tsx` (Modify) — `focusSparringId` → Sheet öffnen.
- `App.tsx` (Modify) — `linking`-Config an `NavigationContainer`.
- `app.config.js` (Modify) — iOS `associatedDomains`, Android `intentFilters`.
- `.easignore` (Modify) — `/web/` ausschließen.

**Supabase**
- `supabase/migrations/20260706120000_public_sparrings_view.sql` (Create) — View + Anon-Grant.

**Web (`web/` — eigenes Next.js-Projekt, eigenes Vercel-Deployment)**
- `web/package.json`, `web/next.config.js`, `web/tsconfig.json`, `web/.env.example` (Create)
- `web/lib/supabase.ts` (Create) — Anon-Client (nur `public_sparrings`).
- `web/lib/sparring.ts` (Create) — pure Display-Helfer (Status/Format).
- `web/lib/sparring.test.ts` (Create) — Tests.
- `web/app/s/[id]/page.tsx` (Create) — SSR-Schaufenster + OG-Metadaten + Status-Zustände.
- `web/app/s/[id]/OpenInApp.tsx` (Create) — Client-Komponente: Deep-Link-Versuch + Store-Fallback + QR (Desktop).
- `web/app/layout.tsx`, `web/app/page.tsx`, `web/app/not-found.tsx` (Create)
- `web/public/.well-known/apple-app-site-association` (Create)
- `web/public/.well-known/assetlinks.json` (Create)

---

### Task 1: Pure Share-Utils (App)

**Files:**
- Create: `src/utils/sparringShare.ts`
- Test: `src/utils/sparringShare.test.ts`

**Interfaces:**
- Produces:
  - `export const SHARE_BASE_URL: string` (`'https://sparr.app'`, Platzhalter)
  - `export function buildSparringShareUrl(id: string): string`
  - `export type SparringShareStatus = 'upcoming' | 'full' | 'expired'`
  - `export function sparringShareStatus(input: { scheduledAt: string; slotsLeft: number; now?: Date }): SparringShareStatus`
  - `export function coarseAreaLabel(input: { studioName: string | null; address: string }): string` — spiegelt die `area_label`-Logik der View clientseitig (Studioname sonst Stadt-Segment nach dem letzten Komma, sonst `'Ort in der App'`).

- [ ] **Step 1: Write the failing test**

Test-Datei — beachte: in Test-Dateien **kein `import type`** (Babel-Setup), stattdessen normale Imports.

```ts
import {
  buildSparringShareUrl,
  sparringShareStatus,
  coarseAreaLabel,
  SHARE_BASE_URL,
} from './sparringShare';

describe('buildSparringShareUrl', () => {
  it('builds a /s/<id> url on the share base', () => {
    expect(buildSparringShareUrl('abc-123')).toBe(`${SHARE_BASE_URL}/s/abc-123`);
  });
  it('encodes the id', () => {
    expect(buildSparringShareUrl('a b')).toBe(`${SHARE_BASE_URL}/s/a%20b`);
  });
});

describe('sparringShareStatus', () => {
  const now = new Date('2026-07-06T12:00:00Z');

  it('is expired when scheduledAt is in the past', () => {
    expect(sparringShareStatus({ scheduledAt: '2026-07-05T12:00:00Z', slotsLeft: 3, now }))
      .toBe('expired');
  });
  it('is full when no slots left and still upcoming', () => {
    expect(sparringShareStatus({ scheduledAt: '2026-07-07T12:00:00Z', slotsLeft: 0, now }))
      .toBe('full');
  });
  it('is upcoming when in the future with free slots', () => {
    expect(sparringShareStatus({ scheduledAt: '2026-07-07T12:00:00Z', slotsLeft: 2, now }))
      .toBe('upcoming');
  });
  it('treats negative slotsLeft as full', () => {
    expect(sparringShareStatus({ scheduledAt: '2026-07-07T12:00:00Z', slotsLeft: -1, now }))
      .toBe('full');
  });
  it('expired takes precedence over full', () => {
    expect(sparringShareStatus({ scheduledAt: '2026-07-05T12:00:00Z', slotsLeft: 0, now }))
      .toBe('expired');
  });
});

describe('coarseAreaLabel', () => {
  it('uses the studio name when present', () => {
    expect(coarseAreaLabel({ studioName: 'Boxwerk', address: 'Hauptstr. 1, 80331 München' }))
      .toBe('Boxwerk');
  });
  it('falls back to the city segment after the last comma', () => {
    expect(coarseAreaLabel({ studioName: null, address: 'Hauptstr. 1, 80331 München' }))
      .toBe('80331 München');
  });
  it('returns generic label when no studio and no comma', () => {
    expect(coarseAreaLabel({ studioName: null, address: 'irgendwo' }))
      .toBe('Ort in der App');
  });
  it('treats empty studio name as absent', () => {
    expect(coarseAreaLabel({ studioName: '', address: 'X, Berlin' })).toBe('Berlin');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/utils/sparringShare.test.ts`
Expected: FAIL — `Cannot find module './sparringShare'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// Pure helpers for sharing a single sparring. No React Native imports so this
// stays unit-testable and reusable.

// Placeholder domain — replace with the final domain once registered.
// See plan "Global Constraints > DOMAIN-Platzhalter".
export const SHARE_BASE_URL = 'https://sparr.app';

export function buildSparringShareUrl(id: string): string {
  return `${SHARE_BASE_URL}/s/${encodeURIComponent(id)}`;
}

export type SparringShareStatus = 'upcoming' | 'full' | 'expired';

export function sparringShareStatus(input: {
  scheduledAt: string;
  slotsLeft: number;
  now?: Date;
}): SparringShareStatus {
  const now = input.now ?? new Date();
  if (new Date(input.scheduledAt).getTime() < now.getTime()) return 'expired';
  if (input.slotsLeft <= 0) return 'full';
  return 'upcoming';
}

// Mirrors public_sparrings.area_label: studio name if present, otherwise the
// city segment after the last comma, otherwise a generic label. Never the
// exact street.
export function coarseAreaLabel(input: {
  studioName: string | null;
  address: string;
}): string {
  if (input.studioName && input.studioName.length > 0) return input.studioName;
  const parts = input.address.split(',');
  const city = parts[parts.length - 1]?.trim();
  return city && city.length > 0 ? city : 'Ort in der App';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/utils/sparringShare.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: tsc + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/utils/sparringShare.ts src/utils/sparringShare.test.ts
git commit -m "feat(sparring): pure share-url + status helpers"
```

---

### Task 2: Öffentliche View `public_sparrings` (Supabase)

**Files:**
- Create: `supabase/migrations/20260706120000_public_sparrings_view.sql`

**Interfaces:**
- Produces: DB-View `public.public_sparrings` mit Spalten `id, title, discipline, scheduled_at, duration_min, max_slots, slots_left, area_label, host_name, host_avatar_url`. Anon-`SELECT` erlaubt. Nur `is_active = true AND verified_only = false`.

**Kontext:** Migrationsstil folgt bestehenden Dateien (z.B. `20260614120000_sparring_verified_only.sql`): `SECURITY DEFINER`-Funktionen wo nötig, explizite `GRANT`/`REVOKE`. `profiles` hat die öffentlichen Felder `name` und (Avatar) — Feldnamen unten aus `PublicProfileScreen`/`profiles` verifizieren und ggf. anpassen (`avatar_url`).

- [ ] **Step 1: Migration schreiben**

```sql
-- Public read-only view for sharing a single sparring on the web.
-- Exposes ONLY non-sensitive fields, never the exact street address or lat/lng,
-- only active, non-verified_only sparrings.

CREATE OR REPLACE VIEW public.public_sparrings
WITH (security_invoker = false) AS
SELECT
  os.id,
  os.title,
  os.discipline,
  os.scheduled_at,
  os.duration_min,
  os.max_slots,
  GREATEST(
    0,
    os.max_slots - (
      SELECT count(*) FROM sparring_signups ss WHERE ss.sparring_id = os.id
    )
  )::int AS slots_left,
  -- Coarse location: studio name when at a studio, otherwise only the city part
  -- of the address (segment after the last comma), never the exact street.
  CASE
    WHEN os.is_at_studio AND st.name IS NOT NULL THEN st.name
    WHEN position(',' IN os.address) > 0
      THEN btrim(split_part(os.address, ',', -1))
    ELSE 'Ort in der App'
  END AS area_label,
  p.name          AS host_name,
  p.avatar_url    AS host_avatar_url
FROM open_sparrings os
LEFT JOIN studios  st ON st.id = os.studio_id
LEFT JOIN profiles p  ON p.id = os.created_by
WHERE os.is_active = true
  AND os.verified_only = false;

-- View runs with the definer's rights (postgres), so anon can read exactly the
-- exposed columns without direct access to the base tables.
GRANT SELECT ON public.public_sparrings TO anon, authenticated;
```

> Hinweis für Implementierer: Vor dem Anwenden `split_part(..., -1)` gegen die PG-Version prüfen — negativer Index wird ab PG14 unterstützt (Supabase ist neuer, ok). Avatar-Spaltenname (`avatar_url`) gegen `profiles` in `src/types/database.types.ts` verifizieren; falls abweichend, hier anpassen.

- [ ] **Step 2: Migration anwenden & prüfen**

Anwenden über den etablierten Supabase-Workflow (CLI `supabase db push` bzw. Supabase-MCP `apply_migration`). Danach als anon lesen:

```sql
SELECT id, title, discipline, slots_left, area_label, host_name
FROM public_sparrings LIMIT 3;
```
Expected: liefert Zeilen; `area_label` zeigt Studioname bzw. Stadt, nie die volle Straße; `verified_only`-Sparrs fehlen.

- [ ] **Step 3: Advisor-Check & commit**

Supabase Security-Advisor laufen lassen (MCP `get_advisors`), auf „security definer view"/RLS-Warnungen prüfen und dokumentieren, dass die View bewusst nur unkritische Spalten zeigt.

```bash
git add supabase/migrations/20260706120000_public_sparrings_view.sql
git commit -m "feat(sparring): public_sparrings view for web sharing"
```

---

### Task 3: Story-Card-Komponente (App)

**Files:**
- Create: `src/components/sparring/SparringStoryCard.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface SparringStoryCardProps {
    title: string;
    discipline: string;
    areaLabel: string;      // grober Ort (Studio/Stadt), NIE exakte Adresse
    dateTimeLabel: string;  // vorformatiert, z.B. "Samstag, 06. Juli, 18:00 Uhr"
    slotsLeftLabel: string; // z.B. "3 Plätze frei" / "Ausgebucht"
  }
  export const STORY_CARD_WIDTH = 1080;
  export const STORY_CARD_HEIGHT = 1920;
  export default function SparringStoryCard(props: SparringStoryCardProps): JSX.Element;
  ```

**Kontext:** Reine UI-Komponente (kein Unit-Test laut Projektregeln). Wird versteckt gerendert (off-screen) und per `react-native-view-shot` zu PNG aufgenommen. Feste 1080×1920, damit der Snapshot Story-Format hat. Nur `colors`-Tokens, Inter, `@expo/vector-icons`.

- [ ] **Step 1: Komponente schreiben**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export const STORY_CARD_WIDTH = 1080;
export const STORY_CARD_HEIGHT = 1920;

export interface SparringStoryCardProps {
  title: string;
  discipline: string;
  areaLabel: string;
  dateTimeLabel: string;
  slotsLeftLabel: string;
}

export default function SparringStoryCard({
  title, discipline, areaLabel, dateTimeLabel, slotsLeftLabel,
}: SparringStoryCardProps): JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>SPARRING</Text>
      <Text style={styles.discipline}>{discipline}</Text>
      <Text style={styles.title} numberOfLines={3}>{title}</Text>

      <View style={styles.metaBlock}>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={48} color={colors.card} />
          <Text style={styles.metaText}>{areaLabel}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={48} color={colors.card} />
          <Text style={styles.metaText}>{dateTimeLabel}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="people-outline" size={48} color={colors.card} />
          <Text style={styles.metaText}>{slotsLeftLabel}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerBrand}>Sparr</Text>
        <Text style={styles.footerHint}>Link antippen und mitmachen</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: STORY_CARD_WIDTH,
    height: STORY_CARD_HEIGHT,
    backgroundColor: colors.dark,
    paddingHorizontal: 96,
    paddingVertical: 160,
    justifyContent: 'space-between',
  },
  kicker: {
    fontFamily: 'Inter_700Bold',
    fontSize: 40,
    letterSpacing: 8,
    color: colors.accentBlue,
  },
  discipline: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 56,
    color: colors.card,
    marginTop: 24,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 96,
    lineHeight: 104,
    color: colors.card,
    marginTop: 32,
  },
  metaBlock: {
    gap: 40,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
  },
  metaText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 48,
    color: colors.card,
    flex: 1,
  },
  footer: {
    gap: 16,
  },
  footerBrand: {
    fontFamily: 'Inter_700Bold',
    fontSize: 72,
    color: colors.accentBlue,
  },
  footerHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 40,
    color: colors.textSecondary,
  },
});
```

- [ ] **Step 2: tsc + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/components/sparring/SparringStoryCard.tsx
git commit -m "feat(sparring): branded 1080x1920 story card component"
```

---

### Task 4: Teilen-Flow im SparringDetailSheet verdrahten (App)

**Files:**
- Modify: `package.json` (via `npx expo install`)
- Modify: `src/components/sparring/SparringDetailSheet.tsx`

**Interfaces:**
- Consumes: `SparringStoryCard` (Task 3), `buildSparringShareUrl` (Task 1), `SparringWithMeta` (`sparring.studio_name`, `.address`, `.discipline`, `.scheduled_at`, `.title`, `.max_slots`, `.signup_count`).

**Kontext:** `react-native-view-shot` + `react-native-share` sind native Module → nach Install ein neuer Dev-Build nötig. Die versteckte `SparringStoryCard` wird per `ViewShot`-Ref zu einer PNG-Datei aufgenommen und via `Share.open`/Instagram-Stories übergeben; der Link kommt als zweite Aktion über das OS-Share-Sheet. Für den „area_label" im Story-Bild nutzen wir clientseitig dieselbe Logik wie die View (Studioname wenn vorhanden, sonst Stadt aus Adresse).

- [ ] **Step 1: Native Libs installieren**

Run:
```bash
npx expo install react-native-view-shot react-native-share
npx expo-doctor
```
Expected: beide Pakete in `package.json`; `expo-doctor` „No issues detected" (sonst laut CLAUDE.md Release-Checkliste angleichen).

- [ ] **Step 2: Imports + Story-Card-Ref + Helper ergänzen**

In `src/components/sparring/SparringDetailSheet.tsx` oben ergänzen:

```tsx
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';
import SparringStoryCard from './SparringStoryCard';
import { buildSparringShareUrl, coarseAreaLabel } from '../../utils/sparringShare';
```

Innerhalb der Komponente (nach den anderen refs, z.B. nach `scrollRef`):

```tsx
const storyShotRef = useRef<ViewShot>(null);

async function handleShare(): Promise<void> {
  const url = buildSparringShareUrl(s.id);
  try {
    const uri = await storyShotRef.current?.capture?.();
    if (uri) {
      await Share.open({
        url: uri,
        message: `${s.title} – jetzt mitmachen: ${url}`,
        failOnCancel: false,
      });
      return;
    }
  } catch {
    // fall through to link-only sharing
  }
  await Share.open({ message: `${s.title} – jetzt mitmachen: ${url}`, failOnCancel: false });
}
```

> Story-zu-Instagram direkt: `react-native-share` bietet `Share.shareSingle({ social: Share.Social.INSTAGRAM_STORIES, backgroundImage: uri, appId })` (iOS braucht die Facebook-`appId`; ohne appId `Share.open` als generisches Sheet nutzen — für v1 ausreichend, IG erscheint als Ziel im Sheet). Implementierer: mit generischem `Share.open` starten; `shareSingle` nur ergänzen, wenn eine FB-appId vorliegt.

- [ ] **Step 3: Teilen-Button + versteckte Story-Card ins JSX einfügen**

Direkt nach dem Anmelden-`TouchableOpacity` (vor dem `isCreator`-Boost-Button) einen Teilen-Button ergänzen:

```tsx
<TouchableOpacity style={styles.shareBtn} onPress={() => { void handleShare(); }} activeOpacity={0.8}>
  <Ionicons name="share-outline" size={18} color={colors.accentBlue} />
  <Text style={styles.shareBtnText}>Teilen</Text>
</TouchableOpacity>
```

Versteckte Story-Card off-screen rendern — innerhalb des `container`-`View` (z.B. direkt nach dem `<Animated.View>`-Sheet, noch im `container`), damit sie im Baum ist aber nicht sichtbar:

```tsx
<View style={styles.storyCapture} pointerEvents="none">
  <ViewShot ref={storyShotRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
    <SparringStoryCard
      title={s.title}
      discipline={s.discipline}
      areaLabel={coarseAreaLabel({ studioName: s.studio_name, address: s.address })}
      dateTimeLabel={formatDateTime(s.scheduled_at)}
      slotsLeftLabel={isFull ? 'Ausgebucht' : `${slotsLeft} ${slotsLeft === 1 ? 'Platz' : 'Plätze'} frei`}
    />
  </ViewShot>
</View>
```

Styles ergänzen:

```tsx
shareBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  borderRadius: 14,
  height: 44,
  borderWidth: 1,
  borderColor: colors.accentBlue,
  backgroundColor: colors.accentBlueSoft,
},
shareBtnText: {
  fontSize: 15,
  fontWeight: '600',
  color: colors.accentBlue,
},
storyCapture: {
  position: 'absolute',
  left: -10000,   // off-screen, still rendered for capture
  top: 0,
  width: 1080,
  height: 1920,
},
```

- [ ] **Step 4: tsc + Build + manueller Test**

Run: `npx tsc --noEmit && npx jest`
Expected: grün.

Dev-Build (native Änderung):
```bash
npx expo run:ios
npx expo run:android
```
Manuell auf echtem iOS + Android: Sheet öffnen → „Teilen" → Share-Sheet zeigt ein Story-Bild (Titel/Ort/Zeit/Plätze) + Link; Instagram Stories als Ziel wählbar; „Abbrechen" wirft keinen Fehler.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/sparring/SparringDetailSheet.tsx
git commit -m "feat(sparring): share button with story image + link in detail sheet"
```

---

### Task 5: Deep-Linking-Konfiguration (App)

**Files:**
- Modify: `src/navigation/types.ts`
- Modify: `src/screens/SparringMapScreen.tsx`
- Modify: `App.tsx`
- Modify: `app.config.js`

**Interfaces:**
- Consumes: bestehendes `selected`-State + `SparringDetailSheet` in `SparringMapScreen`; `useOpenSparrings`-Daten.
- Produces: Route `SparringMap` akzeptiert `focusSparringId?: string`; Deep Links `https://sparr.app/s/:id` und `sparr://sparr/:id` öffnen das Detail-Sheet.

- [ ] **Step 1: Route-Param erweitern**

`src/navigation/types.ts` — `SparringMap`-Zeile ändern:

```ts
SparringMap: { openCreate?: boolean; focusSparringId?: string } | undefined;
```

- [ ] **Step 2: Map-Screen öffnet Sheet bei `focusSparringId`**

In `src/screens/SparringMapScreen.tsx` einen Effekt ergänzen, der bei gesetztem `focusSparringId` den passenden Sparr aus der geladenen Liste sucht und `setSelected` aufruft. Muster analog zum bestehenden `openCreate`-Effekt (nahe Zeile 171). Die Sparr-Liste kommt aus dem bestehenden `useOpenSparrings`-Hook des Screens (Variablennamen im Screen verifizieren, z.B. `sparrings`):

```tsx
// Open the detail sheet when arriving via a deep link (https://DOMAIN/s/<id>).
useEffect(() => {
  const id = route.params?.focusSparringId;
  if (id === undefined) return;
  const match = sparrings.find((sp) => sp.id === id);
  if (match) {
    setSelected(match);
    navigation.setParams({ focusSparringId: undefined });
  }
}, [route.params?.focusSparringId, sparrings, navigation]);
```

> Falls der Screen die Liste unter anderem Namen hält (nicht `sparrings`), Implementierer passt den Namen an. Wenn der Sparr per Deep Link noch nicht in der Liste ist (verified_only/inaktiv), passiert nichts — akzeptabel für v1 (die Web-Seite hat den Fallback).

- [ ] **Step 3: Linking-Config an NavigationContainer**

In `App.tsx` oben ergänzen:

```tsx
import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './src/navigation/types';
```

`expo-linking` installieren, falls nicht vorhanden:
```bash
npx expo install expo-linking
```

Vor `NavigationContainer` eine Konstante definieren und als `linking`-Prop übergeben:

```tsx
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'sparr://', 'https://sparr.app'],
  config: {
    screens: {
      // Nested navigators must mirror the real navigator tree; adjust the
      // Tabs/SparringMap nesting to match RootNavigator.
      SparringMap: 's/:focusSparringId',
    },
  },
};
```

`<NavigationContainer theme={NAV_THEME}>` → `<NavigationContainer theme={NAV_THEME} linking={linking}>`.

> Wichtig: Die `config.screens`-Struktur MUSS die echte Verschachtelung aus `src/navigation/RootNavigator.tsx` widerspiegeln (SparringMap liegt evtl. unter einem Tab/Stack). Implementierer öffnet `RootNavigator.tsx`, ermittelt den Pfad zu `SparringMap` und baut die verschachtelte `screens`-Map entsprechend. `s/:focusSparringId` mappt das URL-Segment auf den Route-Param aus Step 1.

- [ ] **Step 4: Universal/App Links in app.config.js**

`ios`-Block um `associatedDomains` ergänzen:

```js
ios: {
  supportsTablet: true,
  bundleIdentifier: "com.kombat.app",
  requireFullScreen: true,
  associatedDomains: ["applinks:sparr.app"],
  infoPlist: { /* unverändert */ },
  entitlements: { /* unverändert */ },
},
```

`android`-Block um `intentFilters` ergänzen:

```js
android: {
  package: "com.kombat.app",
  adaptiveIcon: { /* unverändert */ },
  predictiveBackGestureEnabled: false,
  intentFilters: [
    {
      action: "VIEW",
      autoVerify: true,
      data: [{ scheme: "https", host: "sparr.app", pathPrefix: "/s" }],
      category: ["BROWSABLE", "DEFAULT"],
    },
  ],
},
```

- [ ] **Step 5: tsc + Build + manueller Test**

Run: `npx tsc --noEmit`
Expected: no errors.

Nach Dev-Build (`npx expo run:ios` / `run:android`), Deep Link testen (echte App-Link-Verifikation braucht die live well-known-Dateien aus Task 7 unter der echten Domain — bis dahin über das Custom-Scheme testen):

- iOS Simulator: `xcrun simctl openurl booted "sparr://sparr/<echte-id>"`
- Android: `adb shell am start -a android.intent.action.VIEW -d "sparr://sparr/<echte-id>"`

Expected: App öffnet und das Detail-Sheet des Sparrs erscheint (Kaltstart & Warmstart je einmal prüfen).

- [ ] **Step 6: Commit**

```bash
git add src/navigation/types.ts src/screens/SparringMapScreen.tsx App.tsx app.config.js package.json
git commit -m "feat(sparring): deep-link sparr/s/<id> opens the detail sheet"
```

---

### Task 6: Next.js Web-App — Schaufenster-Seite

**Files:**
- Create: `web/package.json`, `web/next.config.js`, `web/tsconfig.json`, `web/.env.example`
- Create: `web/lib/supabase.ts`, `web/lib/sparring.ts`, `web/lib/sparring.test.ts`
- Create: `web/app/layout.tsx`, `web/app/page.tsx`, `web/app/not-found.tsx`
- Create: `web/app/s/[id]/page.tsx`, `web/app/s/[id]/OpenInApp.tsx`

**Interfaces:**
- Consumes: View `public_sparrings` (Task 2) via Anon-Key.
- Produces: öffentliche Route `https://DOMAIN/s/<id>`.

**Kontext:** Eigenständiges Next.js-Projekt (App Router) im Unterordner `web/`, eigenes `package.json`, eigenes Vercel-Deployment. Nutzt nur `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (kein Service-Key). Designsystem-Farben gespiegelt. Deutsch, Umlaute korrekt.

- [ ] **Step 1: Projekt scaffolden**

```bash
mkdir -p web && cd web
npx create-next-app@latest . --ts --app --no-tailwind --no-src-dir --no-eslint --use-npm --no-import-alias
```
(Falls interaktiv: TypeScript ja, App Router ja, Tailwind nein, `src/` nein.) Danach `cd ..`.

`web/.env.example` anlegen:
```
NEXT_PUBLIC_SITE_URL=https://sparr.app
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```
`@supabase/supabase-js` im `web/` installieren: `cd web && npm install @supabase/supabase-js && cd ..`.

- [ ] **Step 2: Pure Display-Helfer + Test (TDD)**

`web/lib/sparring.ts`:
```ts
export type WebSparringStatus = 'upcoming' | 'full' | 'expired';

export function webSparringStatus(input: {
  scheduledAt: string;
  slotsLeft: number;
  now?: Date;
}): WebSparringStatus {
  const now = input.now ?? new Date();
  if (new Date(input.scheduledAt).getTime() < now.getTime()) return 'expired';
  if (input.slotsLeft <= 0) return 'full';
  return 'upcoming';
}

export function formatDateTimeDE(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time} Uhr`;
}

export function slotsLeftLabel(slotsLeft: number): string {
  if (slotsLeft <= 0) return 'Ausgebucht';
  return `${slotsLeft} ${slotsLeft === 1 ? 'Platz' : 'Plätze'} frei`;
}
```

`web/lib/sparring.test.ts` (Test-Runner: node's `--test` oder vitest; hier `node:test`):
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webSparringStatus, slotsLeftLabel } from './sparring';

const now = new Date('2026-07-06T12:00:00Z');

test('expired when in the past', () => {
  assert.equal(webSparringStatus({ scheduledAt: '2026-07-05T12:00:00Z', slotsLeft: 3, now }), 'expired');
});
test('full when no slots and upcoming', () => {
  assert.equal(webSparringStatus({ scheduledAt: '2026-07-07T12:00:00Z', slotsLeft: 0, now }), 'full');
});
test('upcoming when future with slots', () => {
  assert.equal(webSparringStatus({ scheduledAt: '2026-07-07T12:00:00Z', slotsLeft: 2, now }), 'upcoming');
});
test('slotsLeftLabel singular/plural/full', () => {
  assert.equal(slotsLeftLabel(1), '1 Platz frei');
  assert.equal(slotsLeftLabel(3), '3 Plätze frei');
  assert.equal(slotsLeftLabel(0), 'Ausgebucht');
});
```

Run: `cd web && node --test --experimental-strip-types lib/sparring.test.ts && cd ..`
Expected: 4 tests pass. (Falls die TS-Strip-Flag-Variante zickt: `npx tsx --test lib/sparring.test.ts`.)

- [ ] **Step 3: Supabase-Client (nur View)**

`web/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) throw new Error('Missing Supabase env vars');

export const supabase = createClient(url, anon, {
  auth: { persistSession: false },
});

export interface PublicSparring {
  id: string;
  title: string;
  discipline: string;
  scheduled_at: string;
  duration_min: number;
  max_slots: number;
  slots_left: number;
  area_label: string;
  host_name: string | null;
  host_avatar_url: string | null;
}

export async function fetchPublicSparring(id: string): Promise<PublicSparring | null> {
  const { data, error } = await supabase
    .from('public_sparrings')
    .select('id,title,discipline,scheduled_at,duration_min,max_slots,slots_left,area_label,host_name,host_avatar_url')
    .eq('id', id)
    .maybeSingle();
  if (error) return null;
  return (data as PublicSparring) ?? null;
}
```

- [ ] **Step 4: `/s/[id]` SSR-Seite mit OG + Status-Zuständen**

`web/app/s/[id]/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { fetchPublicSparring } from '../../../lib/supabase';
import { webSparringStatus, formatDateTimeDE, slotsLeftLabel } from '../../../lib/sparring';
import OpenInApp from './OpenInApp';

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const s = await fetchPublicSparring(id);
  if (!s) return { title: 'Sparr' };
  const title = `Sparring: ${s.discipline} · ${s.area_label}`;
  const description = `${formatDateTimeDE(s.scheduled_at)} — ${slotsLeftLabel(s.slots_left)}`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function SparringPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const s = await fetchPublicSparring(id);

  if (!s) {
    return (
      <main style={wrap}>
        <h1 style={h1}>Dieser Sparr ist nicht mehr verfügbar</h1>
        <p style={p}>Finde andere Sparrings in der Sparr-App.</p>
        <OpenInApp sparringId={null} />
      </main>
    );
  }

  const status = webSparringStatus({ scheduledAt: s.scheduled_at, slotsLeft: s.slots_left });

  return (
    <main style={wrap}>
      <p style={kicker}>SPARRING · {s.discipline}</p>
      <h1 style={h1}>{s.title}</h1>
      <ul style={list}>
        <li>{s.area_label}</li>
        <li>{formatDateTimeDE(s.scheduled_at)}</li>
        <li>{s.duration_min} Minuten</li>
        <li>{status === 'expired' ? 'Dieser Sparr ist vorbei' : slotsLeftLabel(s.slots_left)}</li>
      </ul>
      {s.host_name ? <p style={p}>Host: {s.host_name}</p> : null}
      <OpenInApp sparringId={s.id} />
    </main>
  );
}

// Inline styles are acceptable here (Next.js server component, no StyleSheet).
const wrap = { maxWidth: 560, margin: '0 auto', padding: 24, fontFamily: 'Inter, system-ui, sans-serif', color: '#141414', background: '#F7F5F0', minHeight: '100vh' } as const;
const kicker = { color: '#4A90D9', letterSpacing: 2, fontWeight: 700, fontSize: 14 } as const;
const h1 = { fontSize: 28, lineHeight: 1.2, margin: '8px 0 16px' } as const;
const list = { listStyle: 'none', padding: 0, display: 'grid', gap: 8, fontSize: 16 } as const;
const p = { fontSize: 15, color: '#8A8A8A' } as const;
```

> `params` ist in Next 15 ein Promise (oben so behandelt). Falls das gescaffoldete Next älter ist, `params` synchron nutzen. Impressum/Datenschutz-Footer in `layout.tsx` ergänzen (Notion-Datenschutz-URL wie in `PaywallScreen.tsx`).

- [ ] **Step 5: „In App öffnen" Client-Komponente**

`web/app/s/[id]/OpenInApp.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';

const IOS_STORE = 'https://apps.apple.com/app/id0000000000';       // TODO: echte App-ID
const ANDROID_STORE = 'https://play.google.com/store/apps/details?id=com.kombat.app';

export default function OpenInApp({ sparringId }: { sparringId: string | null }) {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) setPlatform('ios');
    else if (/Android/i.test(ua)) setPlatform('android');
    else setPlatform('desktop');
  }, []);

  function openApp() {
    if (!sparringId) return;
    const deepLink = `sparr://sparr/${sparringId}`;
    const store = platform === 'ios' ? IOS_STORE : ANDROID_STORE;
    const t = setTimeout(() => { window.location.href = store; }, 1500);
    window.location.href = deepLink;
    // If the app opens, the page is backgrounded and the timeout is effectively cancelled by the OS.
    window.addEventListener('pagehide', () => clearTimeout(t), { once: true });
  }

  if (platform === 'desktop') {
    return (
      <div>
        <p>Öffne den Link auf deinem Handy oder lade die Sparr-App:</p>
        <a href={IOS_STORE}>App Store</a> · <a href={ANDROID_STORE}>Google Play</a>
      </div>
    );
  }

  return (
    <button onClick={openApp} style={btn}>
      {sparringId ? 'In der App öffnen' : 'Sparr-App holen'}
    </button>
  );
}

const btn = { background: '#4A90D9', color: '#fff', border: 0, borderRadius: 14, padding: '14px 20px', fontSize: 16, fontWeight: 700, cursor: 'pointer' } as const;
```

> Desktop-QR-Code ist optional (nice-to-have); für v1 reichen Store-Links. QR später über eine reine SVG-QR-Lib ohne externen Call nachrüstbar.

- [ ] **Step 6: Build + Test**

Run:
```bash
cd web && npm run build && node --test lib/sparring.test.ts && cd ..
```
Expected: Next-Build erfolgreich; Tests grün. Lokal `npm run dev` und `http://localhost:3000/s/<echte-id>` prüfen: Daten, „vorbei"/„ausgebucht"/„nicht verfügbar"-Zustände, „In der App öffnen"-Button.

- [ ] **Step 7: Commit**

```bash
git add web
git commit -m "feat(web): next.js sparring showcase page with OG + app fallback"
```

---

### Task 7: well-known-Dateien, .easignore, Vercel-Verdrahtung

**Files:**
- Create: `web/public/.well-known/apple-app-site-association`
- Create: `web/public/.well-known/assetlinks.json`
- Modify: `.easignore`

**Interfaces:**
- Consumes: Bundle-ID `com.kombat.app`, iOS Team-ID, Android SHA-256-Fingerprint (aus EAS-Credentials).

- [ ] **Step 1: App-IDs/Fingerprints sammeln**

- iOS `appID` = `<TEAM_ID>.com.kombat.app`. Team-ID aus dem Apple Developer Account bzw. `eas credentials` (iOS).
- Android SHA-256-Fingerprint des Upload-/App-Signing-Keys: `eas credentials` (Android) → SHA-256 kopieren. Bei Play App Signing zusätzlich den Google-Play-Signing-Fingerprint aufnehmen.

- [ ] **Step 2: AASA schreiben**

`web/public/.well-known/apple-app-site-association` (reines JSON, KEINE Dateiendung, wird als `application/json` ausgeliefert):
```json
{
  "applinks": {
    "apps": [],
    "details": [
      { "appID": "TEAMID.com.kombat.app", "paths": ["/s/*"] }
    ]
  }
}
```

- [ ] **Step 3: assetlinks schreiben**

`web/public/.well-known/assetlinks.json`:
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.kombat.app",
      "sha256_cert_fingerprints": ["<SHA256_FINGERPRINT>"]
    }
  }
]
```

> Next.js liefert Dateien unter `public/.well-known/` unverändert aus. Prüfen, dass die AASA-Datei ohne Endung als `application/json` und ohne Redirect erreichbar ist (`https://DOMAIN/.well-known/apple-app-site-association`). Ggf. in `next.config.js` einen `headers()`-Eintrag für den Content-Type ergänzen.

- [ ] **Step 4: `.easignore` — web/ ausschließen**

In `.easignore` ergänzen (Root-Only-Anchor mit führendem Slash, damit keine gleichnamigen native Ordner mitgerissen werden):
```
/web/
```
Danach die `.easignore`-Sanity aus CLAUDE.md laufen lassen und prüfen, dass **kein** benötigter `src/`/`assets/`/`widgets/`-Pfad fälschlich ausgeschlossen wird:
```bash
node -e "const f=require('fs'),cp=require('child_process'),ig=require('ignore')().add(f.readFileSync('.easignore','utf8'));const w=cp.execSync('git ls-files',{encoding:'utf8'}).split('\n').filter(Boolean).filter(p=>/^(src|assets|widgets)\//.test(p)&&ig.ignores(p));console.log(w.length?'WRONGLY IGNORED:\n'+w.join('\n'):'ok: 0 wrongly ignored')"
```
Expected: `ok: 0 wrongly ignored`.

- [ ] **Step 5: Verifikation (nach Deploy unter echter Domain)**

Nach Vercel-Deploy + gesetzter Domain:
- `https://DOMAIN/.well-known/apple-app-site-association` → JSON, `content-type: application/json`.
- `https://DOMAIN/.well-known/assetlinks.json` → JSON.
- Android App-Link-Verifikation: `adb shell pm verify-app-links --re-verify com.kombat.app` dann `adb shell pm get-app-links com.kombat.app` → `verified`.
- iOS: echten `https://DOMAIN/s/<id>`-Link (z.B. aus Notizen/iMessage) antippen → App öffnet direkt beim Sparr.

- [ ] **Step 6: Commit**

```bash
git add web/public/.well-known/apple-app-site-association web/public/.well-known/assetlinks.json .easignore
git commit -m "chore(web): app-site-association + assetlinks + easignore exclude web"
```

---

## Nach allen Tasks

- **Release-Checkliste (CLAUDE.md)** vor jedem Store-Build: `npx tsc --noEmit && npx jest`, `npx expo-doctor` (19/19), Versionsbump in `app.config.js`, `.easignore`-Sanity, Sentry-Token/`SENTRY_DISABLE_AUTO_UPLOAD`. Die neuen nativen Libs (`react-native-view-shot`, `react-native-share`) → Release-Build auf echtem Gerät prüfen (R8/Minify).
- **Domain-Ersetzung:** Sobald die echte Domain feststeht, die 4 Stellen aus „Global Constraints > DOMAIN-Platzhalter" ersetzen + Vercel-Domain + Apple-`associatedDomains`-Verifikation.
- **Vault:** `Funktionen.md` (Feature), `API/Endpunkte.md` (`public_sparrings`-View), ggf. `Architektur/ADR-NNN-web-landingpage.md` (Entscheidung Next.js/Vercel). Vorher `_VAULT_SYSTEM.md` lesen, append.
```
