# Spec: Sparring nachträglich bearbeiten

Stand: 2026-09-27 · Scope: nur `open_sparrings` (keine Events, keine Chat-Systemnachricht,
kein Rate-Limit). Baut auf `sparring-verbindlichkeit.md` auf (Statusmodell, Fristen,
Lock-Reihenfolge, Fallstricke Abschnitt 16).

## 1. Ziel

Der Organisator korrigiert ein geplantes Sparring, statt es abzusagen und neu anzulegen.
Teilnehmer erfahren **wesentliche** Änderungen sofort und bestätigen den neuen Stand neu.
Niemand verliert durch eine Änderung seinen Platz oder seine Zuverlässigkeit.

## 2. Ist-Zustand (relevant)

- Anlegen: direkter Client-`INSERT` (`useSparringActions.createSparring`), Geocoding im Client.
- Absagen: RPC `deactivate_sparring` (Fan-out an pending/confirmed/waitlisted).
- UPDATE-Policy `creator update sparrings`: `USING created_by = auth.uid() WITH CHECK is_featured = false`.
  Folge: Der Ersteller kann jede Spalte direkt ändern (auch `scheduled_at`, `is_active`
  zurück auf `true`, `max_slots` unter die Zusagen), geboostete Sparrings gar nicht.
- Aktuelle App: **kein** direkter UPDATE mehr (nur `deactivate_sparring`). Store-Builds bis
  ca. 1.0.5 (Code vor 2026-05-08) sagten per `update({ is_active: false })` ab.
- Trigger, die mitlaufen: `trg_open_sparring_rescheduled` (setzt bei neuer Zeit die
  7d/24h/3h-Flags aktiver Zusagen zurück), `trg_open_sparring_capacity_raised` (Warteliste
  rückt bei höherem `max_slots` nach), `trg_clean_open_sparring` (Wortfilter auf title/notes).
- Cron Schritt C lässt einen `pending`-Platz nur verfallen, wenn die 24h-Anfrage
  mindestens `sparring_reaction_time()` (2h) vor der Bestätigungsfrist (6h vor Start) kam
  und es kein Last-Minute-Platz ist. Der Cron ist derzeit pausiert (Legacy-Kompatibilität).
- Benachrichtigungs-Tap (Push + Feed) routet generisch über `data.sparring_id` →
  `SparringMap { focusSparringId }`. Ein neuer Typ braucht kein neues Routing.

## 3. Datenmodell (additiv)

```sql
ALTER TABLE open_sparrings
  ADD COLUMN IF NOT EXISTS edited_at           timestamptz,  -- jede Bearbeitung (Anzeige "Bearbeitet")
  ADD COLUMN IF NOT EXISTS material_changed_at timestamptz;  -- letzte wesentliche Änderung
```

**Warum Spalten am Sparring und nicht pro Zusage:** Eine wesentliche Änderung betrifft alle
Zusagen gleichzeitig. Ob jemand „seit der Änderung noch nicht neu bestätigt“ hat, folgt
eindeutig aus vorhandenen Feldern:

> `status = 'pending' AND COALESCE(slot_granted_at, signed_up_at) <= material_changed_at`

Wer danach bestätigt, ist `confirmed`. Wer erst danach beigetreten ist, hat einen späteren
`slot_granted_at` und kannte den neuen Stand. So braucht es keine weitere Spalte pro Zeile,
kein Backfill und keinen zweiten Wahrheitswert, der driften kann.

**Warum nicht `updated_at`:** Ein generischer Update-Zeitstempel würde auch durch
Absagen, Cron-Flags (`attendance_reminder_sent_at`) oder Boosts springen. `edited_at` setzt
nur `update_sparring`.

## 4. Produktregeln → Server-Logik

**Bearbeitbar:** title, notes, discipline, address/lat/lng, scheduled_at, duration_min,
max_slots, verified_only.

- **Wesentlich:** scheduled_at, Ort (address oder lat/lng), duration_min, discipline.
- **Klein:** title, notes, verified_only, max_slots.

**Studio-Sparrings** (`studio_id IS NOT NULL`): Der Ort ist das Studio, `sparringLocationLines`
zeigt den Studionamen. Ortsänderung wird dort abgelehnt („Der Ort eines Studio-Sparrings ist
das Studio.“). Alle anderen Felder bleiben bearbeitbar. *(Entscheidung, siehe 10.)*

### 4.1 RPC `update_sparring`

```
update_sparring(
  p_id uuid, p_title text, p_notes text, p_discipline text,
  p_address text, p_lat double precision, p_lng double precision,
  p_scheduled_at timestamptz, p_duration_min int, p_max_slots int, p_verified_only boolean
) RETURNS jsonb   -- { material: bool, changed_fields: text[], notified: int }
```

`SECURITY DEFINER`, `SET search_path = public`, `REVOKE … FROM PUBLIC, anon`,
`GRANT … TO authenticated`. Vollständiger Satz statt Patch: Der Client schickt immer alle
Felder. Die RPC erkennt Änderungen per `IS DISTINCT FROM`.

Ablauf in einer Transaktion, Lock-Reihenfolge wie überall (Sparring, dann Signups):

1. `auth.uid()` gesetzt, sonst „Nicht eingeloggt.“
2. `SELECT … FROM open_sparrings WHERE id = p_id FOR UPDATE`. Nicht gefunden oder nicht
   `created_by` → „Sparring nicht gefunden oder keine Berechtigung“.
3. `is_active` und `scheduled_at > now()`, sonst „Abgesagte oder begonnene Sparrings können
   nicht mehr bearbeitet werden.“
4. Validierung: `p_scheduled_at > now()`, `p_duration_min` zwischen 15 und 600,
   `p_max_slots >= 1`, Titel/Adresse nicht leer, lat/lng beide gesetzt oder beide NULL,
   Studio-Sparring ohne Ortsänderung.
5. `v_taken` = Anzahl `pending`/`confirmed` (ohne Row-Lock, das Sparring-Lock serialisiert
   Joins/Cancels). `p_max_slots < v_taken` → „Es haben bereits N Personen zugesagt. Die
   Plätze können nicht unter N sinken.“
6. Diff bilden → `changed_fields` (z. B. `{scheduled_at, address}`) und `v_material`.
   Keine Änderung → sofort `{material:false, changed_fields:{}, notified:0}` (kein
   `edited_at`).
7. **Empfänger vor dem Update festhalten** (alle `pending`/`confirmed`/`waitlisted`
   außer dem Organisator), damit Nachrücker dieses Speicherns dabei sind.
8. `UPDATE open_sparrings SET …, edited_at = now(), material_changed_at = CASE WHEN
   v_material THEN now() ELSE material_changed_at END`. Dabei laufen die Trigger
   (Wortfilter, Reschedule-Flags, Kapazität → Warteliste rückt nach).
9. Nur bei `v_material`:
   - Zusagen `pending`/`confirmed` (≠ Organisator) → `status = 'pending'`,
     `confirmed_at = NULL`, `reminder_7d_sent_at = now()` (die Änderung ersetzt die
     7-Tage-Nachfrage), `reminder_24h_sent_at = CASE WHEN now() >= scheduled_at −
     sparring_confirm_window() THEN now() ELSE NULL END` (gleiches Muster wie
     `promote_sparring_waitlist`). `slot_granted_at` bleibt unverändert: Der Platz gehört
     der Person weiterhin.
   - Pro Empfänger genau **ein** `notify_user(uid, 'sparring_updated', 'Sparring geändert',
     body, {sparring_id, changed_fields})`. Aufruf über `sparring_notify_safe`, damit ein
     Push-Fehler die Transaktion nie abbricht (`send_push_notification` fängt ohnehin ab,
     zusätzlich schützt das gegen Fehler beim Feed-Insert).
10. Rückgabe `{material, changed_fields, notified}`.

### 4.2 Nachrichtentext

Titel „Sparring geändert“. Text: `„<Titel>“ wurde geändert.` + eine Zeile pro wesentlicher
Änderung + Handlungsaufforderung je nach Status des Empfängers:

- Zeit: `Neue Zeit: Sa 12.10., 14:00 (vorher Fr 11.10., 18:00)`. Europe/Berlin, Wochentag
  über ein festes deutsches Array, nicht über `to_char('Dy')` (hängt an `lc_time`).
- Ort: `Neuer Ort: <address>` (bei Studio-Sparrings nie der Fall)
- Dauer: `Neue Dauer: 120 Min. (vorher 90 Min.)`
- Disziplin: `Neue Disziplin: MMA (vorher Boxen)`
- `pending` nach Reset: `Bitte bestätige den neuen Termin in der App.` Greift der Verfall
  (siehe 4.3), zusätzlich: `… sonst wird dein Platz am TT.MM. um HH:MM Uhr freigegeben.`
- `waitlisted`: `Du stehst weiterhin auf der Warteliste.`

Die Zeilen werden mit Zeilenumbruch verbunden (Push und Feed zeigen mehrzeilig). Formatierung
in einer internen Funktion `sparring_format_berlin(timestamptz)`, `REVOKE` von allen.

### 4.3 Verfall (Cron Schritt C) nach einer Änderung

Schritt C verlangt `reminder_24h_sent_at < scheduled_at − confirm_deadline − reaction_time`.
Nach einer wesentlichen Änderung gibt es nur zwei Fälle:

- Änderung **vor** dem 24h-Fenster: `reminder_24h_sent_at = NULL` → Schritt B fragt
  regulär 24h vorher, der Verfall folgt den normalen Regeln.
- Änderung **im** 24h-Fenster: Die Änderungsnachricht ist die Anfrage
  (`reminder_24h_sent_at = now()`). Verfallen kann der Platz nur, wenn danach noch
  mindestens 2h bis zur Bestätigungsfrist bleiben. Andernfalls verfällt er nie
  (Beispiel: Änderung 2h vor Start → kein Verfall, straffreie Absage möglich).

Damit wirkt keine Anfrage, die **vor** der Änderung verschickt wurde, auf den Verfall:
Jedes alte Flag wird überschrieben. Das gilt auch, wenn sich nur Ort, Dauer oder Disziplin
ändern (dort feuert der Reschedule-Trigger nicht). Der Cron selbst bleibt unverändert.

### 4.4 Straffreie Absage

`cancel_sparring_signup` bekommt einen zusätzlichen Zweig vor `cancelled_late`:

```sql
ELSIF v_row.status = 'pending'
  AND v_sp.material_changed_at IS NOT NULL
  AND COALESCE(v_row.slot_granted_at, v_row.signed_up_at) <= v_sp.material_changed_at THEN
  v_new := 'cancelled';   -- terms changed, not re-confirmed yet: no broken commitment
```

`<=` schließt Personen ein, die im selben Speichern von der Warteliste nachgerückt sind
(`now()` ist pro Transaktion gleich). Sie hatten unter alten Bedingungen zugesagt. Legacy-
DELETEs alter Builds haben ohnehin keine Konsequenz.

### 4.5 max_slots

- Senken unter `v_taken` → Fehler (siehe 4.1 Schritt 5). Senken auf ≥ `v_taken` ist erlaubt,
  die Warteliste bleibt stehen.
- Erhöhen → bestehender Trigger `trg_open_sparring_capacity_raised` →
  `promote_sparring_waitlist` (Benachrichtigung `sparring_waitlist_promoted` wie bisher).
  Fällt das mit einer wesentlichen Änderung zusammen, bekommt der Nachrücker **zwei**
  Nachrichten verschiedenen Typs (Nachrücken + Änderung). Pro Typ bleibt es bei genau
  einer. *(Entscheidung, siehe 10.)*

### 4.6 verified_only nachträglich an

Bestehende Zusagen bleiben (kleine Änderung, keine Benachrichtigung). Die Regel gilt nur für
neue Beitritte. Gleiches Verhalten wie heute beim direkten Umschalten.

## 5. Direkte Client-UPDATEs absichern

```sql
DROP POLICY IF EXISTS "creator update sparrings" ON open_sparrings;
REVOKE UPDATE ON open_sparrings FROM anon, authenticated;
```

- Aktuelle App: nutzt nur RPCs (`update_sparring`, `deactivate_sparring`), unberührt.
- **Kein Legacy-Pfad betroffen** (beim Testen festgestellt): Auch das direkte
  `update({ is_active: false })` der frühesten Builds scheiterte schon immer an der
  SELECT-Policy `read active sparrings`. Postgres prüft bei UPDATE mit WHERE auch die
  neue Zeile gegen die SELECT-Policy, und genau deshalb gibt es `deactivate_sparring`
  (Kommentar in `20260507130000`). Ein Spalten-Grant für `is_active` wäre wirkungslos.
- RPCs, Trigger und Cron laufen als `SECURITY DEFINER` (Eigentümer), der Boost-Webhook über
  `service_role`, und die Website schreibt `open_sparrings` nicht. Keiner ist betroffen.
- Geboostete Sparrings lassen sich jetzt über die RPCs bearbeiten und absagen.

## 6. Client

- **`src/utils/sparringEdit.ts`** (neu, pure, mit Test): Diff Formular ↔ Sparring,
  `isMaterialChange`, Liste der geänderten Felder. Damit wählt die UI den passenden Dialog.
  Die Wahrheit bleibt die RPC.
- **`useSparringActions.updateSparring(id, input)`** → RPC. Geocoding nur bei geänderter
  Adresse ohne Kartenkoordinaten. Unveränderte Adresse sendet die gespeicherten lat/lng,
  sonst wäre jedes Speichern eine „Ortsänderung“. Fehler-Mapping inkl.
  `CONTENT_FILTER_BLOCKED` wie beim Anlegen.
- **`CreateSparringSheet`**: optionaler Prop `editing: SparringWithMeta`. Vorbefüllt, Titel
  „Sparring bearbeiten“, Button „Änderungen speichern“. Im Nutzer-Modus kommt ein Dauer-Stepper
  dazu (15er-Schritte, heute fest 90). Ort bei Studio-Sparrings gesperrt mit Hinweis.
  Bei wesentlicher Änderung und ≥ 1 betroffener Person:
  `Alert` „X Teilnehmer werden benachrichtigt und müssen neu bestätigen.“
  [Abbrechen] [Speichern]. X kommt aus einer Count-Abfrage auf `sparring_signups`
  (`pending`/`confirmed`/`waitlisted`, ohne Organisator, SELECT-Policy erlaubt das).
- **`SparringDetailSheet`**: Button „Bearbeiten“ neben „Karten-Boost“ / „Sparring absagen“.
  Nur für den Ersteller, nur aktiv und nicht begonnen. „Bearbeitet“ als kleine Zeile im Kopf,
  wenn `edited_at` gesetzt ist.
- **`SparringMapScreen`**: „Bearbeiten“ schließt das Detail-Sheet (Modal-Regel: keine zwei
  Modals nebeneinander) und öffnet das Bearbeiten-Sheet verzögert, wie beim Boost-Sheet.
  Nach dem Speichern: Refetch und Detail wieder öffnen.
- **`useOpenSparrings`**: `edited_at` mitladen (`SparringWithMeta.edited_at`).
- **Routing**: nichts Neues. `sparring_updated` trägt `sparring_id`, Push-Tap und Feed-Tap
  öffnen das Detail wie bei `sparring_cancelled`/`sparring_signup`. Kommentar im
  Push-Handler um den Typ ergänzen.
- **`database.types.ts`**: `open_sparrings.edited_at`, `material_changed_at`;
  `Functions.update_sparring`.

## 7. Legacy-Kompatibilität (Builds ≤ 1.2.6)

- Nur additive Spalten. Alte Builds selektieren explizite Spalten.
- Alte Builds kennen `sparring_updated` nicht. Der Feed zeigt Titel/Text generisch, der
  Push-Tap öffnet über `sparring_id` (Handler ist typ-unabhängig).
- `confirmed → pending` bei alten Builds: Sie zeigen nur „angemeldet“ und können nicht
  bestätigen. Da der Cron bis 1.2.7 pausiert ist, verfällt nichts. Nach dem Release gilt 4.3.
- Direkte UPDATEs alter Builds gab es praktisch nicht (Abschnitt 5).

## 8. Tests

Lokal gibt es weder Docker noch psql. Vorschlag: `brew install postgresql@17`, dazu eine
Wegwerf-DB mit Stubs (`auth.uid()` aus einer GUC, `net.http_post` schreibt in eine
Log-Tabelle, `is_user_verified`, `is_text_clean`). Geladen werden die relevanten Tabellen
(profiles-Minimum, open_sparrings, sparring_signups, notifications), die Funktionen aus
0911xx/0924 und die neue Migration. Szenarien als Skript `supabase/tests/sparring_edit.sql`
mit `ASSERT`s:

1. Zeit ändern mit confirmed-Teilnehmern → alle `pending`, `confirmed_at` NULL, je 1
   `sparring_updated`, Text mit „Neue Zeit … (vorher …)“ in Berliner Zeit.
2. Änderung 2h vor Start → kein Verfall durch `process_sparring_lifecycle()`, Absage =
   `cancelled`.
3. max_slots unter Zusagen → Fehler, nichts geändert.
4. max_slots erhöhen mit Warteliste → Nachrücker `pending`, Promotion-Nachricht.
5. Fremder User ruft RPC → Fehler. Anon → keine Ausführungsrechte.
6. Inaktives / vergangenes Sparring → Fehler. Neue Zeit in der Vergangenheit → Fehler.
7. Nur Titel ändern → `edited_at` gesetzt, `material_changed_at` unverändert, 0 Pushes,
   Status unverändert.
8. Mehrere wesentliche Felder → genau 1 Notification pro Person, alle Zeilen im Text.
9. Straffreie Absage nach Änderung innerhalb der Absagefrist → `cancelled`. Nach erneuter
   Bestätigung → normale Regel (`cancelled_late`).
10. Direkter UPDATE als authenticated: jede Spalte verweigert. RPCs funktionieren, auch
    für geboostete Sparrings.
11. Cron-Verfall: Änderung im 24h-Fenster mit ≥ 2h Reaktionszeit → Verfall erst an der Frist.

Danach `npx tsc --noEmit && npx jest`. Prod-Deploy (MCP `apply_migration`) nur nach
Freigabe.

## 9. Dateien

- `supabase/migrations/20260927120000_sparring_edit.sql` (neu: Spalten, Formatter,
  `update_sparring`, `cancel_sparring_signup` erweitert, UPDATE-Absicherung)
- `supabase/tests/` (neu): `base.sql` (Stubs + Prod-Spalten), `extract_functions.py`
  (Funktionen aus den Migrationen), `sparring_edit.sql` (Szenarien),
  `run_sparring_edit.sh` (Wegwerf-Postgres). Mit `PRINT_HASHES=1` werden normalisierte
  Hashes der geladenen Funktionen ausgegeben, zum Abgleich mit Prod.
- `src/utils/sparringEdit.ts` + `.test.ts` (neu)
- `src/hooks/useSparringActions.ts`, `src/hooks/useOpenSparrings.ts`
- `src/components/sparring/CreateSparringSheet.tsx`, `SparringDetailSheet.tsx`
  (+ ggf. `SparringDetailHeader.tsx` für „Bearbeitet“)
- `src/screens/SparringMapScreen.tsx`
- `src/types/database.types.ts`
- Vault: Funktionen, Dev-Log, `Supabase-Contract (Shared).md` (Spalten, RPC, Policy)

## 10. Offene Entscheidungen (Default in Klammern)

1. Ort bei Studio-Sparrings sperren? (ja)
2. Nachrücker bei gleichzeitiger Kapazitätserhöhung und wesentlicher Änderung:
   zwei Nachrichten verschiedenen Typs ok? (ja)
3. Testweg: lokale Postgres via Homebrew mit Stubs (ja), alternativ Tests auf Prod in einer
   Transaktion, die am Ende per Exception zurückgerollt wird.
4. `duration_min` Obergrenze 600 Min.? (ja)
