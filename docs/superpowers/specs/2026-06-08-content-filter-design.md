# Design: Wortfilter für User-Freitext (Content Filter)

Datum: 2026-06-08
Status: Zur Freigabe

## Ziel

Verhindern, dass Nutzer unangemessenen Freitext in die App schreiben — auf der
Map (Sparring-Erstellung), im Sparring-Gruppenchat und in Profilfeldern.
App-Store-Compliance (Apple Guideline 1.2 — Moderation von User-Generated-Content)
und Schutz der Nutzer, die sich über die Map physisch treffen.

Harte Anforderung: **komplett kostenlos** — kein externer Dienst, keine KI-API.
Regelbasierter Wortlisten-Filter, lokal + in Postgres.

## Zu filternde Kategorien

| Kategorie    | Beispiele                                  |
|--------------|--------------------------------------------|
| `profanity`  | Beleidigungen, Schimpfwörter               |
| `hate`       | Rassismus, Homophobie, Antisemitismus etc. |
| `violence`   | Echte Gewaltandrohung/-verherrlichung      |
| `sexual`     | Sexuelle Belästigung, anzügliche Inhalte   |
| `spam`       | Werbung, fremde Studios, URLs              |
| `contact`    | Telefonnummern, fremde Handles ("schreib mir auf WhatsApp") |

Kampfsport-Vokabular ("k.o. schlagen", "Sparring", "hart rangehen") ist **erlaubt** —
`violence` zielt nur auf echte Drohungen ("ich bring dich um"), nicht auf
Sport-Sprache. Die Wortliste wird entsprechend konservativ gepflegt.

## Architektur: Eine Wortliste, beide Seiten

Single Source of Truth = **DB-Tabelle `banned_words(word, category)`**.

- **Server** liest direkt aus der Tabelle → echte, nicht umgehbare Barriere.
- **Client** lädt die Liste einmal beim App-Start, cached in AsyncStorage →
  sofortiges UX-Feedback, offline-fähig.
- Filter erweitern = eine Zeile in der Tabelle. Kein App-Update, kein Deploy.
- Alles in bestehender Supabase-Instanz → 0 € laufende Kosten.

Nur die kleine, stabile Normalisierungs-Logik liegt zweimal (TypeScript +
plpgsql). Die wachsende Wortliste ist single-source.

### Reaktion bei Treffer
Überall **hart blocken**: Speichern/Senden wird verhindert, deutsche
Fehlermeldung je nach Kategorie. Kein Maskieren.

## Komponenten

### 1. `src/utils/contentFilter.ts` (pure TS, kein React)

```ts
type FilterCategory = 'profanity' | 'hate' | 'violence' | 'sexual' | 'spam' | 'contact';
type FilterResult = { ok: true } | { ok: false; category: FilterCategory };

// Normalisierung gegen Umgehung
function normalize(text: string): string
// - lowercase
// - Leetspeak zurück: 3->e, 1->i, 0->o, @->a, $->s, 4->a, 7->t
// - ß->ss, Akzente/Diakritika entfernen
// - Sonderzeichen/Leerzeichen zwischen einzelnen Buchstaben strippen
//   (fängt "s c h e i ß e" und "s-c-h-e-i-s-s-e")

// Wortgrenzen-Matching gegen False Positives (Scunthorpe-Problem)
// "Arsch" -> Treffer; "Marschieren" -> kein Treffer
function checkText(
  text: string,
  bannedWords: BannedWord[],
  opts?: { allowContactInfo?: boolean }
): FilterResult

// Deutsche Fehlermeldung pro Kategorie
function filterErrorMessage(category: FilterCategory): string
```

- `allowContactInfo: true` deaktiviert nur die `contact`-Kategorie (für Bio).
- Wortliste wird per Hook geladen, nicht im Util hardcodiert (Util bleibt pure,
  testbar mit injizierter Liste).
- **Unit-Tests** `contentFilter.test.ts`: Normalisierung, Wortgrenzen,
  Leetspeak-Umgehung, False-Positive-Schutz, `allowContactInfo`.

### 2. `src/hooks/useBannedWords.ts`

- Lädt `banned_words` einmal, cached in AsyncStorage (`banned_words_cache`).
- Fallback auf Cache wenn offline; Fallback auf leere Liste wenn beides fehlt
  (Server bleibt dann letzte Barriere).
- Gibt `bannedWords: BannedWord[]` zurück.

### 3. Client-Einbindung (sofortiges Feedback)

| Stelle                        | Felder                    | allowContactInfo |
|-------------------------------|---------------------------|------------------|
| `CreateSparringSheet`         | Titel, Notizen, Adresse   | nein             |
| Sparring-Gruppenchat (`sendText` Pfad) | Nachricht        | nein             |
| `ProfileDetailsForm` / Bio    | Bio                       | **ja**           |
| Team-Name (Erstellung)        | Name                      | nein             |

Bei Treffer: Submit/Send abbrechen, `filterErrorMessage(category)` anzeigen.
Das `instagram`-Feld im Profil wird **gar nicht** geprüft.

### 4. Server-Einbindung (echte Barriere)

Migration `2026xxxx_add_content_filter.sql`:

- Tabelle `banned_words(id, word text, category text, created_at)` +
  RLS: SELECT für `authenticated`, keine Writes (nur Service-Role/Migration).
- Seed der initialen Liste (~150–250 Begriffe DE + gängige EN), nach Kategorie.
- Funktion `normalize_text(text) -> text` (plpgsql, spiegelt TS-Normalisierung).
- Funktion `is_text_clean(text, allow_contact boolean default false) -> boolean`,
  `SECURITY DEFINER`, liest aus `banned_words`.
- BEFORE-INSERT/UPDATE-Trigger auf:
  - `sparring_group_messages` (content)
  - Sparrings-Tabelle (title, notes)
  - `profiles` (bio — mit `allow_contact := true`)
  - Team-/Studio-Erstellung (name) sofern über Insert/RPC läuft
- Trigger wirft bei Treffer eine Exception mit klarer Meldung; Client fängt sie
  ab und zeigt die deutsche Fehlermeldung.

## Datenfluss

1. User tippt Text → Client normalisiert + prüft gegen gecachte Liste → bei
   Treffer sofort blockieren (kein Netzwerk nötig).
2. Kommt Text trotzdem zum Server (umgangener Client / direkter API-Zugriff) →
   Trigger ruft `is_text_clean()` → Exception bei Treffer → Insert/Update
   schlägt fehl.

## Nicht im Scope (YAGNI)

- Keine KI-/ML-Moderation, kein externer Dienst.
- Kein Admin-UI zum Pflegen der Liste (Pflege via SQL/Supabase-Dashboard reicht).
- Keine Report-/Melde-Funktion für User (separates Feature).
- Keine Bild-Moderation.

## Testing

- `contentFilter.test.ts`: Normalisierung, Matching, Umgehungsfälle,
  False Positives, `allowContactInfo`.
- `tsc --noEmit` nach jeder Änderung.
- Manueller Smoke-Test: verbotenes Wort in Sparring-Titel + Chat → blockiert;
  IG-Handle im Profil → erlaubt; "Massage" in Notizen → erlaubt.

## Offene Punkte

- Genaue initiale Wortliste pro Kategorie wird beim Implementieren erstellt und
  ist bewusst konservativ (lieber wenige False Positives als Übersperrung).
