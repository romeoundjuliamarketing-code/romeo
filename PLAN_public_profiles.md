# Feature: Öffentliche Kämpferprofile, Bewertung & Meldung

## Ziel
Nutzer können beim Sparring das Profil anderer Teilnehmer aufrufen, sie nach dem Sparring bewerten (Verhalten, nicht Skill) und bei Fehlverhalten melden.

---

## DB-Migrationen (zuerst ausführen)

### Migration 1: `sparring_ratings`
```sql
CREATE TABLE sparring_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rated_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sparring_id uuid NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text NOT NULL CHECK (char_length(comment) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rater_id, rated_user_id, sparring_id)
);

-- RLS
ALTER TABLE sparring_ratings ENABLE ROW LEVEL SECURITY;

-- Jeder eingeloggte Nutzer kann seine eigenen Bewertungen einsehen
CREATE POLICY "Own ratings readable" ON sparring_ratings
  FOR SELECT USING (auth.uid() = rater_id);

-- Durchschnitt für ein Profil ist für alle sichtbar (via Aggregat-Funktion)
-- Einfügen nur wenn man selbst angemeldet war und das Sparring nicht mehr als 7 Tage zurückliegt
CREATE POLICY "Insert own rating" ON sparring_ratings
  FOR INSERT WITH CHECK (
    auth.uid() = rater_id
    AND auth.uid() <> rated_user_id
    AND EXISTS (
      SELECT 1 FROM sparring_signups
      WHERE sparring_id = sparring_ratings.sparring_id
        AND user_id = auth.uid()
    )
  );
```

### Migration 2: `user_reports`
```sql
CREATE TABLE user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sparring_id uuid NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('unsportliches_verhalten', 'gefaehrliches_verhalten', 'beleidigung')),
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insert own report" ON user_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id AND auth.uid() <> reported_user_id);
```

### Migration 3: Privacy-Felder in `profiles`
```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_fight_record boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_stats boolean NOT NULL DEFAULT true;
```

---

## Neue Dateien

### 1. `src/hooks/useSparringRatings.ts`

```typescript
// Lädt Durchschnittsbewertung für einen Nutzer und ermöglicht neue Bewertungen
// Exports:
//   - averageStars: number | null
//   - ratingCount: number
//   - existingRating: { stars: number; comment: string } | null  (eigene Bewertung für dieses Sparring)
//   - submitRating(sparringId: string, ratedUserId: string, stars: number, comment: string): Promise<{ error: string | null }>
//   - canRate(sparringScheduledAt: string): boolean  → true wenn scheduledAt <= jetzt && jetzt <= scheduledAt + 7 Tage
```

Implementiere den Hook vollständig mit Supabase. `canRate` prüft ob `now` zwischen `scheduledAt` und `scheduledAt + 7 * 24 * 60 * 60 * 1000` liegt.

### 2. `src/hooks/useUserReport.ts`

```typescript
// Exports:
//   - submitReport(reportedUserId: string, sparringId: string, reason: string, details?: string): Promise<{ error: string | null }>
// Nach erfolgreichem INSERT in user_reports: Supabase Edge Function "notify-report" aufrufen
// (die Edge Function wird separat angelegt – siehe unten)
```

### 3. `src/screens/PublicProfileScreen.tsx`

Route-Parameter: `{ userId: string; sparringId: string; sparringScheduledAt: string }`

**Aufbau:**
- SafeAreaView + ScrollView
- Header: Zurück-Button links, Melde-Button (Ionicons `flag-outline`) rechts oben
- Avatar (Bild aus `profiles.avatar_url` oder Initialen-Fallback, gleiche Logik wie ProfilScreen)
- Name (immer sichtbar), Alter + Gewicht in einer Zeile (immer sichtbar)
- Durchschnittsbewertung: Sterne-Reihe (gefüllt/leer) + „(X Bewertungen)" — immer sichtbar
- Disziplinen-Badges (nur wenn `show_stats = true`)
- Kampfrekord-Karte (nur wenn `show_fight_record = true`) — nutze `FightRecordCard` Komponente wieder
- „Jetzt bewerten" Button (nur wenn `canRate(sparringScheduledAt)` true und noch keine eigene Bewertung für dieses Sparring)

**Rating-Modal (inline, kein separater Screen):**
- 5 Sterne zum Antippen
- Stern-Labels: 1=„Nicht empfehlenswert", 2=„War okay", 3=„Guter Sparringspartner", 4=„Sehr empfehlenswert", 5=„Immer wieder gerne"
- Subtext unter den Sternen: „Bewerte das Verhalten – nicht den Skill"
- TextInput für Kommentar (Pflicht, max. 200 Zeichen, Placeholder: „Kurzer Kommentar...")
- Speichern-Button (disabled solange kein Stern gewählt oder Kommentar leer)

**Report-Modal (inline):**
- 3 Optionen als auswählbare Zeilen: „Unsportliches Verhalten" / „Gefährliches Verhalten" / „Beleidigung / Harassment"
- Optionales Freitextfeld
- Absenden-Button
- Nach Absenden: kurze Bestätigungsmeldung „Meldung wurde übermittelt"

Styling: Designsystem einhalten (colors.ts, Inter, 8px-Raster, StyleSheet.create, keine Hardcoded-Hex).

### 4. `src/components/sparring/SparringParticipantsList.tsx`

```typescript
// Props: { sparringId: string; currentUserId: string | null; sparringScheduledAt: string; onPressProfile: (userId: string) => void }
// Lädt alle Signups für sparringId aus sparring_signups + JOIN auf profiles (name, avatar_url)
// Zeigt: Avatar/Initialen + Name, antippbar → onPressProfile(userId)
// Zeigt NICHT den eigenen Eintrag (currentUserId herausfiltern)
```

---

## Geänderte Dateien

### `src/components/sparring/SparringDetailSheet.tsx`
- `SparringParticipantsList` einbinden (unterhalb der Info-Zeilen, oberhalb des Anmelde-Buttons)
- Beim Tippen auf einen Teilnehmer: Navigation zu `PublicProfile` mit `{ userId, sparringId: sparring.id, sparringScheduledAt: sparring.scheduled_at }`

### `src/navigation/types.ts`
```typescript
PublicProfile: {
  userId: string;
  sparringId: string;
  sparringScheduledAt: string;
};
```

### `src/navigation/RootNavigator.tsx`
- `PublicProfileScreen` im AppStack registrieren

### `src/types/database.types.ts`
- `sparring_ratings` und `user_reports` Tabellen-Typen ergänzen
- `profiles.show_fight_record` und `profiles.show_stats` ergänzen

---

## Supabase Edge Function: `notify-report`

Datei: `supabase/functions/notify-report/index.ts`

```typescript
// Empfängt: { reportedUserId, reporterUserId, sparringId, reason, details }
// Sendet E-Mail an romeoundjuliamarketing@gmail.com via Resend API
// E-Mail-Inhalt: Gemeldeter User ID, Melder User ID, Sparring ID, Grund, Details, Zeitstempel
// Resend API Key via Supabase Secret: RESEND_API_KEY
// KEIN Resend-Account nötig für den Plan – Romeo muss sich auf resend.com registrieren (kostenlos, 3.000 Mails/Monat)
```

---

## Reihenfolge

1. DB-Migrationen ausführen (`supabase db push` oder via Supabase Dashboard)
2. `database.types.ts` aktualisieren
3. `useSparringRatings.ts` + `useUserReport.ts` schreiben
4. `SparringParticipantsList.tsx` schreiben
5. `PublicProfileScreen.tsx` schreiben
6. `SparringDetailSheet.tsx` anpassen
7. Navigation updaten (`types.ts` + `RootNavigator.tsx`)
8. Edge Function anlegen
9. `npx tsc --noEmit` — alle Fehler beheben bevor fertig

---

## Projektregeln (Pflicht)
- Keine Emojis in der UI
- Icons nur via `@expo/vector-icons`
- Farben nur aus `src/theme/colors.ts`
- Kein Inline-Styling — immer `StyleSheet.create`
- Abstände in Vielfachen von 8px
- TypeScript strict — kein `any`
- UI-Texte auf Deutsch, Kommentare auf Englisch
- Nach jeder Änderung: `npx tsc --noEmit`
