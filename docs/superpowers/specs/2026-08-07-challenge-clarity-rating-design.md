# Challenge-Bewertung „Wie verständlich war die Aufgabe?" — Design

Datum: 2026-08-07
Status: freigegeben, Implementierung offen

## Ziel

Nach dem Abschluss einer Sparrings-Challenge fragt die App einmalig, wie verständlich die
Aufgabe formuliert war. Zweck ist Redaktionsfeedback: Romeo soll sehen, welche der 100
Karten unklar geschrieben sind, ohne die Nutzer zu befragen.

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| Speicherort | Supabase, neue Tabelle `challenge_ratings` |
| Zeitpunkt | Nur nach „Geschafft", nicht beim Weiterziehen |
| Darstellung | Icon-Satz aus `@expo/vector-icons`, später gegen Pinguin-Bilder tauschbar |
| Häufigkeit | Einmal pro Nutzer und Karte, erneutes Bewerten überschreibt |

Echte Emojis sind bewusst nicht verwendet — die Projektregel in CLAUDE.md schliesst sie aus.
Der Emoticon-Satz von MaterialCommunityIcons (`emoticon-confused-outline`,
`emoticon-neutral-outline`, `emoticon-happy-outline`) ist im Projekt verifiziert vorhanden.

## Datenmodell

Neue Migration `supabase/migrations/<ts>_add_challenge_ratings.sql`:

```sql
CREATE TABLE challenge_ratings (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id text        NOT NULL CHECK (char_length(challenge_id) <= 40),
  clarity      smallint    NOT NULL CHECK (clarity BETWEEN 1 AND 3),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_id)
);
```

`challenge_id` ist eine ID aus den statischen App-Daten (`src/data/sparringChallenges.ts`,
z. B. `kick-02`), keine Datenbankzeile — deshalb bewusst **kein** Fremdschlüssel. Die
Längenprüfung verhindert Missbrauch als Freitextfeld.

`clarity`: 1 = unklar, 2 = geht so, 3 = klar.

### RLS

Nach dem Muster von `studio_ratings`, mit einem bewussten Unterschied: **SELECT nur auf
eigene Zeilen.** Bei Studios ist die Lesepolicy `true`, weil die App Schnitt und Anzahl
anzeigt. Hier braucht das niemand — die Auswertung läuft über das Supabase-Dashboard.

```sql
ALTER TABLE challenge_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own challenge ratings" ON challenge_ratings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Insert own challenge rating" ON challenge_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own challenge rating" ON challenge_ratings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX ON challenge_ratings (challenge_id);
```

Der Index auf `challenge_id` dient der Auswertung „welche Karte ist unverständlich".

Kein Edge Function, kein externer Call, keine kostenpflichtige Erweiterung.

## Client

### Hook `src/hooks/useChallengeRating.ts`

Muster wie die vorhandenen Rating-Hooks (`useSparringRatings`), inklusive `queryCache` und
`reportNetworkError`/`reportNetworkSuccess`.

```ts
interface UseChallengeRatingResult {
  ratedIds: Set<string>;                                  // eigene, bereits bewertete Karten
  submit:   (challengeId: string, clarity: 1 | 2 | 3) => void;
  loading:  boolean;
}
```

- Beim Mount einmalig `select challenge_id from challenge_ratings where user_id = me`.
  Ergebnis im `queryCache`, damit ein erneutes Öffnen des Screens nicht neu lädt.
- `submit` schreibt per Upsert auf `(user_id, challenge_id)` und ergänzt die ID optimistisch
  in `ratedIds`, damit die Frage sofort verschwindet.
- Schlägt das Schreiben fehl (kein Netz), wird die ID wieder entfernt und der Fehler still
  über `reportNetworkError` gemeldet: die Karte wird beim nächsten Mal erneut gefragt. Eine
  sichtbare Fehlermeldung wäre lauter als der Nutzen.

### Komponente `src/components/challenge/ChallengeClarityRating.tsx`

Eine Zeile: Frage links, drei Icon-Knöpfe rechts. Alle drei Stufen sind an genau einer
Stelle als Array definiert (`{ value, icon, label }`), damit der spätere Tausch auf
Pinguin-Bilder nur diese Datei berührt.

- Touchflächen mindestens 44 × 44 pt.
- Farben aus `colors.ts`, inaktiv `headerTextSecondary`, gewählt `accentBlue`.
- Nach der Wahl kurz „Danke" (rund 1,5 s), dann blendet die Zeile aus.
- `accessibilityLabel` je Stufe aus dem Label, damit VoiceOver die Stufen benennt.

### Einbindung in `SparringChallengeScreen`

Die Zeile ersetzt die Statuszeile, solange sie sichtbar ist — dadurch verschiebt sich das
Layout nicht und nichts wird auf kleinen Geräten abgeschnitten.

Sichtbar genau dann, wenn:
- eine Karte gezogen ist, **und**
- sie als „geschafft" markiert ist, **und**
- ihre ID nicht in `ratedIds` steht.

Wird „Geschafft" wieder abgewählt, verschwindet die Zeile. Im Kartenbrowser erscheint sie
nicht — dort ist „Geschafft" ein Verwaltungshäkchen, kein Missionsabschluss.

## Typen

`src/types/database.types.ts` wird manuell gepflegt (kein Codegen) und bekommt `Row`,
`Insert` und `Update` für `challenge_ratings`.

## Fehlerfälle

| Fall | Verhalten |
|---|---|
| Kein Netz beim Bewerten | Optimistische Anzeige zurückgenommen, Karte wird später erneut gefragt |
| Laden der bewerteten IDs scheitert | Leere Menge, es wird gefragt — schlimmstenfalls doppelt |
| Nutzer nicht angemeldet | Zeile erscheint nicht (der Screen ist ohnehin hinter dem Login) |
| Karte existiert nicht mehr | Unkritisch, `challenge_id` ist ein freier Text ohne Fremdschlüssel |

## Tests

Der Hook enthält keine reine Logik, die sich sinnvoll isoliert testen liesse (Supabase-IO).
Nach Projektregel gibt es keine Tests für reine UI. Verifiziert wird über `tsc --noEmit`,
die bestehende Suite und einen Gerätecheck.

## Website-Abgleich

Die Tabelle ist reines App-Feature; die Website `sparrapp.com` liest sie nicht. Nach der
Migration wird die Contract-Note im Vault (`Supabase-Contract (Shared).md`) um einen
Eintrag ergänzt, wie es CLAUDE.md verlangt.

## Bewusst nicht enthalten

- Anzeige von Durchschnittswerten in der App
- Freitextkommentar
- Bewertung anderer Aspekte als Verständlichkeit
- Auswertungsansicht im Client — die läuft über das Supabase-Dashboard
