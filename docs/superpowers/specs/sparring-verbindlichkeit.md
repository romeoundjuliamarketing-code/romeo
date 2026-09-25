# Spec: Verbindlichkeit bei Sparring-Treffen

Status: Entwurf zur Umsetzung. Diese Datei ist die Übergabe an Claude Code.
Sprache im Code: Kommentare Englisch, UI-Texte Deutsch, Umlaute immer Ä/Ö/Ü.
Bitte vor Umsetzung die Planungspflicht aus `CLAUDE.md` beachten (> 2 Dateien / neue
Feature-Struktur → kurzer Plan im Chat, auf Freigabe warten).

---

## 0. Arbeitsweise fuer die Umsetzung (zuerst lesen)

Diese Spec wird **phasenweise** abgearbeitet (Reihenfolge in Abschnitt 11) — nie alles
auf einmal. Fuer jede Phase gilt derselbe Takt:

1. **Kurzer Plan im Chat** (Planungspflicht aus `CLAUDE.md`), auf Freigabe warten.
2. **Umsetzen**, dann `npx tsc --noEmit` (+ `npx jest`, wenn eine Util betroffen ist).
   Muss gruen sein, bevor die naechste Phase beginnt.
3. **DB-Logik (Migration 2 und 3) gegen die Testszenarien in Abschnitt 12 durchspielen**,
   bevor der Client sie nutzt. SQL erst beweisen, dann verdrahten.
4. Erst weiter, wenn die **Definition of Done** der Phase (Abschnitt 17) erfuellt ist.

**Modell-Empfehlung:** Migration 2 (RPCs) und Migration 3 (pg_cron) mit dem staerksten
verfuegbaren Modell umsetzen — dort steckt die subtile Logik (Statusuebergaenge,
Idempotenz, Zaehlweise der Quote). Schema-Migration und die gesamte Client-Verkabelung
sind unkritisch.

**Pflicht-Review:** Vor Abschluss die beiden DB-Logik-Migrationen in einem **separaten
Review-Durchgang** (frischer Kontext / Subagent) explizit gegen **Abschnitt 16
(Fallstricke)** gegenpruefen. Abschnitt 16 vor Migration 2/3 zwingend lesen.

**Nicht abweichen von:** den Statusmengen fuer Kapazitaet und Zuverlaessigkeit
(Abschnitt 4 + 6.7) und der Migrationsreihenfolge (Abschnitt 11). Alles andere darf
pragmatisch geloest werden, solange die Testszenarien halten.

---

## 1. Ziel

Beim nächsten Launch soll das Sparring-System möglichst viel **Verbindlichkeit**
erzeugen, ohne normale Nutzer mit hohen Hürden, Geldstrafen oder aggressiven
Sanktionen abzuschrecken. Die entscheidende Kennzahl ist nicht "wie viele melden
sich an", sondern **"wie viele verbindlich zugesagte Personen erscheinen tatsächlich"**.

**Leitprinzip (wichtigster Satz):** Wir wollen No-Shows nicht primär bestrafen.
Wir wollen das System so bauen, dass aus einer alten, vergessenen Zusage gar nicht
erst ein No-Show wird. Konsequenzen/Kaution/Sperren kommen erst, wenn echte
Nutzungsdaten zeigen, dass trotz dieses Systems zu viele Menschen nach ihrer
finalen 24h-Bestätigung nicht erscheinen.

---

## 2. Ist-Zustand (was heute schon existiert)

Damit nichts doppelt gebaut wird — der aktuelle Stand im Repo:

- **Tabelle `open_sparrings`** — das Treffen selbst (`scheduled_at`, `duration_min`,
  `max_slots`, `is_active`, `created_by`, `verified_only`, `is_at_studio`, Geo).
  Migration `20260507100000_add_open_sparrings.sql` ff.
- **Tabelle `sparring_signups`** — die Zusage. Aktuell **binär**: Zeile existiert =
  angemeldet, gelöscht = abgemeldet. Hat seit `20260910120000_sparring_rules_consent.sql`
  `rules_version` + `rules_accepted_at` (NOT NULL, Consent-Pflicht). `UNIQUE(sparring_id, user_id)`.
- **Beitritt/Absage heute:** `src/hooks/useSparringActions.ts` → `signUp()` macht einen
  direkten `INSERT` in `sparring_signups`, `cancelSignup()` ein direktes `DELETE`.
  Kein Status, keine Bestätigung, kein Warteliste-Konzept.
- **Absage durch Organisator:** RPC `deactivate_sparring(p_id)` (setzt `is_active=false`,
  benachrichtigt alle Signups). Migration `20260617120000_add_sparring_notifications.sql`.
- **Notification-Subsystem:** Tabelle `notifications`, Helfer `notify_user(...)` (Feed-Row +
  Expo-Push via `send_push_notification` über `pg_net` → `exp.host`), App-Icon-Badge =
  ungelesene Feed-Rows. Alle bestehenden Sparring-Notifications sind **event-getriggert**
  (DB-Trigger): `sparring_signup` (an Organisator), `sparring_cancelled` (an Teilnehmer),
  Chat-Push. **Es gibt keinen Cron / keine zeitgesteuerten Notifications.**
- **Bewertung:** Tabelle `sparring_ratings` (1–5 Sterne + Kommentar, `useSparringRatings.ts`) —
  subjektiv, existiert bereits.
- **Chat:** `sparring_group_messages` + `sparring_chat_settings` + `sparring_chat_reads`.
- **Read-Hook:** `src/hooks/useOpenSparrings.ts` liest `open_sparrings` + zählt
  `sparring_signups` clientseitig (`signup_count`, `is_signed_up`).
- **UI:** `SparringDetailSheet.tsx`, `SparringParticipantsList.tsx`,
  `CreateSparringSheet.tsx`, `SparringRulesConsentSheet.tsx`, `SparringMapScreen.tsx`,
  `SparringSessionScreen.tsx`.

**Fazit:** Meeting + Beitritt + Notifications + Chat sind da. Es fehlt die komplette
**Bestätigungs-, Warteliste-, Anwesenheits- und Zuverlässigkeitslogik**.

---

## 3. Grundsatzentscheidungen (bereits getroffen)

1. **Sterne-Bewertung (`sparring_ratings`) vorerst verstecken.** Der Code bleibt liegen,
   wird aber im UI hinter einem Flag ausgeblendet. Im Profil wird künftig nur die
   **Zuverlässigkeitsquote** angezeigt. Reversibel — keine Daten löschen, kein Drop.
2. **Zeitsteuerung über `pg_cron`** (kostenlos, läuft in der DB) — keine kostenpflichtige
   Edge Function. Ein Job ruft alle ~15 Min eine `SECURITY DEFINER`-Funktion auf, die
   Erinnerungen sendet, Plätze verfallen lässt und die Warteliste nachrücken lässt.
3. **Ablage dieser Spec:** Repo unter `docs/superpowers/specs/` (diese Datei).

**Architektur-Leitplanke:** Business-Logik gehört in `SECURITY DEFINER`-RPCs, nicht in
den Client (siehe `CLAUDE.md`). Beitritt/Bestätigung/Absage/Anwesenheit werden deshalb
von direkten Client-Inserts/Deletes auf **RPCs** umgestellt.

---

## 4. Statusmodell der Zusage (`sparring_signups.status`)

Neue Spalte `status text NOT NULL DEFAULT 'pending'`. Lebenszyklus:

| Status          | Bedeutung                                                            | Zählt für Kapazität? | Zählt für Zuverlässigkeit? |
|-----------------|----------------------------------------------------------------------|:---:|:---|
| `pending`       | Verbindlich zugesagt, 24h-Pflichtbestätigung steht noch aus          | Ja  | Nein (noch offen) |
| `waitlisted`    | Zugesagt, aber Treffen war voll → Warteliste                         | Nein | Nein |
| `confirmed`     | 24h-Pflichtbestätigung erfolgt ("Ja, ich bin dabei")                 | Ja  | Nein (noch offen, bis Event vorbei) |
| `attended`      | Organisator hat Anwesenheit bestätigt                                | –   | **Ja, Zähler + erschienen** |
| `no_show`       | War `confirmed`, aber nicht erschienen                               | –   | **Ja, Nenner (nicht erschienen)** |
| `cancelled`     | Rechtzeitig abgesagt (vor Frist) — **keine Konsequenz**              | Nein | Nein |
| `cancelled_late`| Nach Absagefrist abgesagt                                           | Nein | **Ja, Nenner (nicht erschienen)** |
| `expired`       | 24h-Bestätigung versäumt → Platz verfallen (nie final zugesagt)     | Nein | **Nein** (Platz sauber freigegeben, kein No-Show) |

Wichtige Abgrenzung: **`expired` ist kein No-Show.** Wer nie final bestätigt hat,
verliert nur seinen Platz — das ist kein Vertrauensbruch, weil er den Platz vor dem
Treffen freigegeben hat. Ein No-Show ist nur, wer am Vortag **aktiv bestätigt** hat
und dann nicht kam.

`UNIQUE(sparring_id, user_id)` bleibt: Absagen setzt künftig den Status (Zeile bleibt
für die Historie erhalten), statt die Zeile zu löschen. Erneutes Beitreten flippt den
Status zurück auf `pending`/`waitlisted`.

---

## 5. Migration 1 — Schema

Datei: `supabase/migrations/<ts>_sparring_commitment_schema.sql`

**5.1 `sparring_signups` erweitern**

```sql
ALTER TABLE sparring_signups
  ADD COLUMN IF NOT EXISTS status               text        NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS confirmed_at         timestamptz,          -- 24h-Bestätigung
  ADD COLUMN IF NOT EXISTS cancelled_at         timestamptz,
  ADD COLUMN IF NOT EXISTS checked_in_at        timestamptz,          -- Anwesenheit erfasst
  ADD COLUMN IF NOT EXISTS reminder_7d_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz;

ALTER TABLE sparring_signups
  ADD CONSTRAINT sparring_signups_status_check
  CHECK (status IN ('pending','waitlisted','confirmed','attended',
                    'no_show','cancelled','cancelled_late','expired'));

-- Bestandszeilen: bisher galt "Zeile existiert = zugesagt". Auf 'pending' setzen.
UPDATE sparring_signups SET status = 'pending' WHERE status IS NULL;

-- Indizes für Cron + Kapazitäts-Queries
CREATE INDEX IF NOT EXISTS sparring_signups_status_idx    ON sparring_signups (sparring_id, status);
CREATE INDEX IF NOT EXISTS sparring_signups_user_status_idx ON sparring_signups (user_id, status);
```

**5.2 Warteliste-Reihenfolge:** über `signed_up_at` (existiert). Kein separates
Tabellen-Feld nötig; ältester `waitlisted` rückt zuerst nach.

**5.3 RLS umstellen (Beitritt/Absage laufen künftig über RPC):**

```sql
-- Direkte Client-Mutationen entfernen — alles über SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "insert own signup" ON sparring_signups;
DROP POLICY IF EXISTS "delete own signup" ON sparring_signups;
-- SELECT-Policies ("read sparring signups") bleiben, damit Teilnehmerliste/Counts lesbar sind.
-- Kein UPDATE-Policy für den Client: Statuswechsel nur via RPC.
```

**5.4 Zuverlässigkeit:** wird **aggregiert berechnet** (kein denormalisierter Zähler,
kein Drift). Siehe RPC `get_reliability` in Migration 2. (Optionale Denormalisierung
auf `profiles` erst, falls die Profilanzeige messbar langsam wird — dann als Folge-ADR.)

---

## 6. Migration 2 — RPCs (Server-Logik)

Datei: `supabase/migrations/<ts>_sparring_commitment_rpcs.sql`

Alle RPCs `SECURITY DEFINER`, `SET search_path = public`, `GRANT EXECUTE ... TO authenticated`.
Interne Helfer (Warteliste-Promotion) bleiben ungegrantet.

**6.1 `join_sparring(p_sparring_id uuid, p_rules_version smallint) → text`**
Ersetzt den direkten Insert in `useSparringActions.signUp`.
- Prüft: eingeloggt, `rules_version >= 1`, `verified_only`-Regel (wie bisherige Policy),
  Treffen aktiv und in der Zukunft.
- Zählt aktive Platzhalter (`status IN ('pending','confirmed')`).
- `< max_slots` → Insert/Update auf `status='pending'`. Sonst `status='waitlisted'`.
- Idempotent bei bestehender Zeile (Re-Join nach Absage flippt Status zurück; UPSERT auf `(sparring_id,user_id)`).
- Rückgabe: der vergebene Status (`'pending'` oder `'waitlisted'`), damit die UI direkt
  "Du bist dabei" vs. "Auf der Warteliste" zeigen kann.
- Behält den bestehenden `notify_sparring_signup`-Effekt (Organisator informieren). Da der
  Trigger heute auf `AFTER INSERT` hängt: entweder Trigger belassen (feuert beim Insert der
  Zeile) oder in die RPC verlagern. **Empfehlung:** Benachrichtigung in die RPC ziehen und
  den `AFTER INSERT`-Trigger entfernen, damit Warteliste-Beitritte nicht fälschlich als
  "hat sich angemeldet" gemeldet werden (nur echte `pending`-Zusagen melden).

**6.2 `confirm_sparring(p_sparring_id uuid) → void`** — die 24h-Pflichtbestätigung.
- Nur eigener Signup, nur `status='pending'` → `status='confirmed'`, `confirmed_at=now()`.
- Erlaubt jederzeit vor Beginn (auch früher als 24h vorher — frühzeitig bestätigen ist ok).

**6.3 `cancel_sparring_signup(p_sparring_id uuid) → text`** — die "Kann doch nicht
teilnehmen"-Aktion. Ersetzt den direkten Delete.
- Eigener Signup mit `status IN ('pending','confirmed','waitlisted')`.
- `waitlisted` → `cancelled` (nie ein Platz gehabt, keine Konsequenz).
- `pending`/`confirmed`:
  - `now() <= scheduled_at - v_cancel_deadline` → `cancelled` (rechtzeitig, **keine** Konsequenz).
  - sonst → `cancelled_late`.
- `cancelled_at = now()`, `status` gesetzt.
- Ruft internen Helfer `promote_sparring_waitlist(p_sparring_id)` (freien Platz nachbesetzen).
- Benachrichtigt den Organisator ("Teilnehmer abgemeldet").
- Rückgabe: gesetzter Status (für UI-Copy: "Danke fürs rechtzeitige Absagen" vs. neutral).

**6.4 Interner Helfer `promote_sparring_waitlist(p_sparring_id uuid) → void`**
- Solange aktive Platzhalter `< max_slots` und es `waitlisted` gibt: ältesten `waitlisted`
  (nach `signed_up_at`) → `status='pending'`, Notification `sparring_waitlist_promoted`
  an den Nutzer ("Ein Platz ist frei geworden — du bist dabei. Bitte bis 24h vorher bestätigen.").
- `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` (nur intern aufgerufen).

**6.5 `mark_sparring_attendance(p_sparring_id uuid, p_user_id uuid, p_present boolean) → void`**
- Nur `created_by` des Treffens **oder** Studio-Coach (analog `is_studio_staff`).
- Nur Teilnehmer mit `status='confirmed'`: `p_present=true` → `attended`, sonst → `no_show`.
  `checked_in_at=now()`.
- Erst ab Beginn des Treffens erlaubt (`now() >= scheduled_at`).

**6.6 `get_sparring_participants(p_sparring_id uuid)`** — für Detail-Sheet, Social Proof
und die Anwesenheits-UI. Gibt pro Teilnehmer `user_id`, Name, Avatar, `status`,
`is_confirmed` zurück (Warteliste getrennt ausweisbar). Respektiert Privacy-Spalten.

**6.7 `get_reliability(p_user_id uuid)`** — objektive Quote statt Sterne.
```
attended  = count(status = 'attended')
committed = count(status IN ('attended','no_show','cancelled_late'))
```
Rückgabe: `{ attended, committed }`. Anzeige: **"X von Y bestätigten Treffen wahrgenommen"**.
Bei `committed = 0` → "Noch keine Historie" (neue Nutzer nicht abstrafen).
`expired` und rechtzeitig `cancelled` fließen bewusst **nicht** in den Nenner.

---

## 7. Migration 3 — Zeitsteuerung (pg_cron)

Datei: `supabase/migrations/<ts>_sparring_lifecycle_cron.sql`

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

Eine Funktion `process_sparring_lifecycle()` (`SECURITY DEFINER`), alle 15 Min per
`cron.schedule('sparring-lifecycle', '*/15 * * * *', 'SELECT process_sparring_lifecycle()')`.
Idempotent durch `*_sent_at`-Flags und Status-Guards (verpasst nie ein Fenster, sendet nie doppelt).

**Tunable Konstanten oben in der Funktion** (Absagefrist ist laut Konzept noch nicht final,
z. B. 4/6/12h — hier zentral änderbar):
```sql
v_cancel_deadline  interval := interval '6 hours';   -- Absagefrist ohne Konsequenz
v_confirm_deadline interval := interval '6 hours';   -- ab hier verfällt unbestätigter Platz
v_reminder_7d      boolean  := true;
```

**Schritt A — 7-Tage-Zwischenbestätigung** (nur wenn früh genug gebucht):
Für aktive Treffen, Signups mit `status='pending'`, `reminder_7d_sent_at IS NULL`,
`now() >= scheduled_at - interval '7 days'`, `now() < scheduled_at - interval '24 hours'`
und `signed_up_at <= scheduled_at - interval '7 days'` (späte Anmeldungen überspringen
diese Stufe): `notify_user(..., 'sparring_confirm_7d', ...)` "Bist du weiterhin dabei?",
`reminder_7d_sent_at = now()`. **Kein** harter Statuswechsel — dient nur der Aktualisierung
der Liste; wer nicht reagiert, bleibt `pending` und bekommt die 24h-Stufe.

**Schritt B — 24h-Pflichterinnerung:**
`status='pending'`, `reminder_24h_sent_at IS NULL`, `now() >= scheduled_at - interval '24 hours'`,
`scheduled_at > now()` → `notify_user(..., 'sparring_confirm_24h', ...)`
"Bitte bestätige bis morgen: Bist du dabei?" mit Deep-Link-Daten, `reminder_24h_sent_at=now()`.

**Schritt C — Verfall unbestätigter Plätze:**
`status='pending'`, `now() >= scheduled_at - v_confirm_deadline`, `scheduled_at > now()`
→ `status='expired'`, Notification `sparring_slot_expired` an den Nutzer
("Dein Platz ist verfallen, weil du nicht bestätigt hast"), dann
`promote_sparring_waitlist(...)` (Platz an Warteliste).

**Schritt E — 3h-Schlusserinnerung** (nachträglich ergänzt, 2026-09-24):
`status IN ('pending','confirmed')`, `reminder_3h_sent_at IS NULL`, `now() >= scheduled_at - 3h`,
`scheduled_at > now()` und Platz schon ≥ 3h vor Start gehalten (`COALESCE(slot_granted_at, signed_up_at)`)
→ `notify_user(..., 'sparring_reminder_3h', ...)` "Gleich geht's los", `reminder_3h_sent_at = now()`.
Verschieben setzt das Flag zurück. Kein Statuswechsel.

**Schritt D — Anwesenheit / Auto-Close:** rein organisatorgetrieben (Schritt 6.5). Der Cron
markiert **niemanden automatisch als No-Show**. Optional (Default: aus): X Stunden nach
Event-Ende ein Reminder an den Organisator "Bitte Anwesenheit erfassen". Unmarkierte
`confirmed`-Zusagen fließen **nicht** in die Zuverlässigkeit ein (weder +/–), um falsche
No-Shows zu vermeiden. Siehe offene Entscheidung 14.2.

---

## 8. Client-Änderungen (React Native / Expo)

**8.1 `src/hooks/useSparringActions.ts`**
- `signUp` → RPC `join_sparring`, gibt Status zurück (`pending`/`waitlisted`).
- `cancelSignup` → RPC `cancel_sparring_signup`, gibt Status zurück.
- **Neu** `confirmSparring(sparringId)` → RPC `confirm_sparring`.
- **Neu** `markAttendance(sparringId, userId, present)` → RPC `mark_sparring_attendance`.
- Fehler-Mapping (RLS/Guards → deutsche Meldungen) wie bisher.

**8.2 `src/hooks/useOpenSparrings.ts`**
- Count- und `is_signed_up`-Queries auf **aktive** Zusagen filtern:
  `.in('status', ['pending','confirmed'])`. Cancelled/expired/waitlisted dürfen den
  `signup_count` nicht aufblähen. Optional zusätzlich `confirmed_count` für Social Proof.
- Eigenen Signup-Status mitführen (`my_status`), damit die UI die richtige CTA zeigt.

**8.3 `src/components/sparring/SparringDetailSheet.tsx`** — statusabhängige CTA:
- Nicht angemeldet → **"Verbindlich zusagen"** (mit Consent-Sheet wie bisher). Microcopy
  direkt darunter: *"Du sagst verbindlich zu. Der Organisator und die anderen Teilnehmer
  rechnen mit dir."*
- `pending` und Event < 24h → prominenter Button **"Ja, ich bin dabei"** (`confirm_sparring`).
- `pending`/`confirmed` → gut sichtbarer, leicht erreichbarer Button **"Kann doch nicht
  teilnehmen"** (kein verschachteltes Menü, keine Rechtfertigung). Vor der Frist Hinweis:
  *"Rechtzeitige Absage zählt nicht negativ."*
- `waitlisted` → "Du stehst auf der Warteliste (Platz N)".
- `expired`/`cancelled*` → neutraler Zustand + Möglichkeit, erneut zuzusagen (falls Platz frei).
- **Social Proof:** Zeile "N Teilnehmer haben bereits bestätigt" + Teilnehmer sichtbar
  (siehe `SparringParticipantsList`). Psychologie: "Diese Gruppe rechnet mit mir", nicht
  "irgendwo auf Teilnehmen gedrückt".
- **Organisator nach Event-Beginn:** Anwesenheits-Erfassung (pro `confirmed`-Teilnehmer
  Toggle erschienen / nicht erschienen → `mark_attendance`).

**8.4 `src/components/sparring/SparringParticipantsList.tsx`**
- Status-Badges (bestätigt / zugesagt / Warteliste). Für den Organisator im Event-/Nachlauf
  die Anwesenheits-Toggles.

**8.5 Zuverlässigkeit im Profil**
- Profil zeigt **"X von Y bestätigten Treffen wahrgenommen"** (`get_reliability`).
  Neue Nutzer: "Noch keine Historie". Keine Sternebewertung mehr sichtbar.
- **Sterne verstecken:** dort, wo heute der `sparring_ratings`-Schnitt gerendert wird
  (`useSparringRatings.ts` / Profil-Komponente), hinter Flag `SHOW_SPARRING_STARS = false`
  (z. B. in `src/data/` oder Theme-Config) ausblenden. Code + Tabelle bleiben unverändert.

**8.6 Notification-Routing**
- Neue Typen (`sparring_confirm_7d`, `sparring_confirm_24h`, `sparring_slot_expired`,
  `sparring_waitlist_promoted`) im Notification-Feed rendern und beim Antippen das
  jeweilige `SparringDetailSheet` öffnen (dort, wo heute `sparring_signup` /
  `sparring_cancelled` behandelt werden — `data.sparring_id`).
- Die 24h-Push soll direkt zur Bestätigung führen (Tap → Detail-Sheet mit prominentem
  "Ja, ich bin dabei"). Actionable-Push-Buttons sind optional/Phase 2.

**8.7 Typen:** `src/types/database.types.ts` manuell erweitern (neue Spalten +
RPC-Signaturen) — kein Codegen (siehe `CLAUDE.md`).

**8.8 Design/Regeln:** keine Emojis, Icons nur `@expo/vector-icons`, Farben nur aus
`src/theme/colors.ts`, `StyleSheet.create`, 8px-Raster, Screens > 150 Zeilen aufteilen,
`SafeAreaView`/Insets, Android-Hardware-Back in Sheets abfangen. Nach jeder Änderung
`npx tsc --noEmit`. Neue reine Util-Logik (z. B. Zuverlässigkeits-/Fristberechnung als
pures TS für die UI) bekommt einen Unit-Test daneben (`Name.test.ts`).

---

## 9. Was wir bewusst NICHT bauen (Phase 1)

- Keine zeitbasierten Sperren ("nach 2 No-Shows 7 Tage gesperrt") — passt nicht zum
  Nutzungsmuster (Sparring nur alle paar Wochen).
- Keine "für die nächsten 2 verfügbaren Treffen gesperrt"-Logik (geografisch/zeitlich
  nicht sauber definierbar).
- Keine 1-€-Anmeldegebühr / Kaution / Geldstrafe. Erhöht die Beitrittshürde; erst testen,
  falls das Bestätigungssystem allein nicht reicht.

Diese kommen frühestens als **Phase 2**, wenn Daten zeigen, dass zu viele nach der
24h-Bestätigung nicht erscheinen.

---

## 10. Kern-Flow (Zielbild)

Treffen finden → **verbindlich zusagen** (`pending`) → ggf. 7-Tage-Nachfrage → 24h vorher
**Pflichtbestätigung** (`confirmed`) → jederzeit **leicht absagen** (rechtzeitig = ohne
Konsequenz) → Warteliste rückt nach → Treffen → **Anwesenheit erfassen**
(`attended`/`no_show`) → **Zuverlässigkeit** aktualisiert sich.

---

## 11. Umsetzungsreihenfolge für Claude Code

1. **Plan im Chat** (Planungspflicht), Freigabe abwarten.
2. **Migration 1 (Schema)** + `database.types.ts` anpassen. `npx tsc --noEmit` grün.
3. **Migration 2 (RPCs)**: join/confirm/cancel/promote/mark_attendance/get_participants/
   get_reliability. Lokal gegen die Statusübergänge testen (SQL).
4. **Client umstellen** auf die RPCs (`useSparringActions`, `useOpenSparrings`), Detail-Sheet
   + Teilnehmerliste statusabhängig, Zuverlässigkeit im Profil, Sterne verstecken.
5. **Migration 3 (pg_cron)**: Lifecycle-Funktion + Schedule. Fenster/Idempotenz prüfen.
6. **Notifications** (neue Typen + Routing + Deep-Link).
7. **Tests**: Util-Unit-Tests (Frist-/Quotenlogik), manuelle Flows.
8. **Android + iOS** bauen und durchspielen (Pflicht laut `CLAUDE.md`), inkl. echtes Gerät.
9. **Vault-Update:** neue Feature-Note `02 Projekte/Sparr/Features/Sparring-Verbindlichkeit.md`
   + Zeile im Funktionen-Index + Dev-Log-Eintrag. `Supabase-Contract (Shared).md` um die
   neuen Tabellen-Spalten/RPCs ergänzen (Website teilt sich das Backend!).

---

## 12. Testszenarien (Abnahme)

- Zusage bei freiem Platz → `pending`; bei vollem Treffen → `waitlisted`.
- 24h-Erinnerung kommt genau einmal; Bestätigen → `confirmed`.
- Nicht bestätigt bis `confirm_deadline` → `expired`, Platz frei, Warteliste rückt nach,
  promovierter Nutzer wird benachrichtigt. **`expired` senkt die Zuverlässigkeit nicht.**
- Rechtzeitig abgesagt → `cancelled`, keine Konsequenz, Warteliste rückt nach.
- Nach Frist abgesagt → `cancelled_late`, zählt in den Nenner.
- Bestätigt + erschienen → `attended` (+ Quote steigt). Bestätigt + nicht erschienen →
  `no_show` (Nenner).
- Spät erstelltes Treffen (< 7 Tage) → keine 7-Tage-Stufe, direkt 24h-Stufe.
- Cron ist idempotent: mehrfacher Lauf sendet keine Doppel-Notifications.
- Quote-Anzeige "X von Y"; neuer Nutzer ohne Historie sauber ("Noch keine Historie").
- Social-Proof-Zeile zählt nur aktive/bestätigte Teilnehmer.

---

## 13. Neue/geänderte Dateien (Überblick)

**DB:**
- `supabase/migrations/<ts>_sparring_commitment_schema.sql` (neu)
- `supabase/migrations/<ts>_sparring_commitment_rpcs.sql` (neu)
- `supabase/migrations/<ts>_sparring_lifecycle_cron.sql` (neu)

**Client:**
- `src/hooks/useSparringActions.ts` (Umbau auf RPCs + confirm/markAttendance)
- `src/hooks/useOpenSparrings.ts` (Status-Filter, confirmed_count, my_status)
- `src/hooks/useSparringReliability.ts` (neu, ruft `get_reliability`)
- `src/components/sparring/SparringDetailSheet.tsx` (statusabhängige CTAs, Social Proof, Absage-Button, Anwesenheit)
- `src/components/sparring/SparringParticipantsList.tsx` (Status-Badges, Anwesenheits-Toggle)
- Profil-Komponente (Zuverlässigkeit anzeigen, Sterne hinter Flag verstecken) + `useSparringRatings.ts`-Anzeige gaten
- Notification-Feed/Routing-Komponente (neue Typen)
- `src/types/database.types.ts` (neue Spalten + RPC-Signaturen)
- ggf. `src/data/sparringConfig.ts` (neu: `SHOW_SPARRING_STARS` Flag, UI-Fristanzeige)

---

## 14. Offene Entscheidungen (mit empfohlenem Default)

1. **Absage-/Bestätigungsfrist:** Default **6 Stunden** vor Beginn für beides
   (`v_cancel_deadline` = `v_confirm_deadline` = 6h). Noch nicht final (4/6/12h denkbar) —
   zentral in Migration 3 änderbar. → *Bitte final festlegen.*
2. **Unmarkierte Anwesenheit:** Default = **nicht werten** (kein Auto-No-Show). Alternative:
   nach Grace-Frist automatisch `attended` (optimistisch) oder `no_show` (streng). → *Bestätigen.*
3. **Warteliste-Promotion nahe am Event:** Promotion in Schritt C passiert bei `T - 6h`.
   Der Nachrücker hat dann wenig Zeit zum Bestätigen. Für MVP ok; evtl. Promotion bereits
   bei jeder Absage (RPC) + weiterhin über Cron. (In 6.4 bereits so vorgesehen.)
4. **7-Tage-Stufe** nur bei Buchung ≥ 7 Tage vorher (so vorgesehen) — ok?
5. **Sterne endgültig entfernen** statt nur verstecken: später separat entscheiden, sobald
   die Zuverlässigkeitsquote sich im Feld bewährt hat.

---

## 15. Contract-Hinweis

Die Website `sparrapp.com` teilt sich dasselbe Supabase-Backend. Neue Tabellen-Spalten,
RPCs und Policies **müssen** in der Vault-Note `02 Projekte/Sparr/Supabase-Contract (Shared).md`
nachgezogen und gegen die Website abgeglichen werden (siehe `CLAUDE.md`).


---

## 16. Fallstricke bei der Umsetzung (kritisch — vor Migration 2/3 lesen)

Jeder Punkt hat in aehnlichen Systemen schon zu Bugs gefuehrt. Format: **Falle** -> **Richtig**.

**16.1 `expired` ist KEIN No-Show.**
Falle: unbestaetigte Plaetze in die Zuverlaessigkeit einrechnen und ehrliche Leute abstrafen.
Richtig: die Statusmengen aus 6.7 sind die *einzige* Wahrheit. Nenner (`committed`) =
`('attended','no_show','cancelled_late')`. Zaehler (`attended`) = `('attended')`.
`expired` und rechtzeitig `cancelled` fliessen **nirgends** ein. Diese Mengen an genau
einer Stelle definieren (im `get_reliability`-RPC), nicht mehrfach im Client nachbauen.

**16.2 Kapazitaets-Race beim Zusagen.**
Falle: zwei Nutzer sagen gleichzeitig zu, beide lesen "1 Platz frei", beide werden `pending`
-> Ueberbuchung.
Richtig: die Kapazitaetspruefung und der Insert/Update passieren **atomar in `join_sparring`**.
Das Treffen vorher mit `SELECT ... FROM open_sparrings WHERE id = p_sparring_id FOR UPDATE`
sperren, dann aktive Plaetze zaehlen, dann Status vergeben. Kein Count im Client als
Entscheidungsgrundlage.

**16.3 Cron-Idempotenz — nie doppelt, nie verpasst.**
Falle: Fenster-Logik `scheduled_at BETWEEN now()+X AND now()+Y` verpasst Treffen, wenn der
Cron mal aussetzt, oder sendet doppelt.
Richtig: Schwellen-Logik `now() >= scheduled_at - interval 'X' AND <flag> IS NULL AND
status = 'pending'`, danach `<flag> = now()` setzen. So feuert jede Erinnerung genau einmal,
egal wie oft/spaet der Job laeuft. Alle drei Schritte (7d/24h/Verfall) idempotent halten.

**16.4 Re-Join nach Absage reaktiviert alte Flags.**
Falle: `UNIQUE(sparring_id,user_id)` -> beim erneuten Zusagen bleibt die alte Zeile mit
gesetztem `reminder_24h_sent_at`/`cancelled_at` stehen, die 24h-Erinnerung kommt nie.
Richtig: `join_sparring` als `UPSERT ... ON CONFLICT (sparring_id,user_id) DO UPDATE`, das
beim Re-Join **alle Lifecycle-Felder zuruecksetzt** (`cancelled_at=NULL, confirmed_at=NULL,
reminder_7d_sent_at=NULL, reminder_24h_sent_at=NULL, checked_in_at=NULL`, `signed_up_at=now()`).

**16.5 Doppelte Organisator-Benachrichtigung.**
Falle: der bestehende `AFTER INSERT`-Trigger `trg_notify_sparring_signup` bleibt aktiv UND
die neue RPC benachrichtigt -> Organisator bekommt zwei Pushes; ausserdem melden
`waitlisted`-Beitritte faelschlich "hat sich angemeldet".
Richtig: Benachrichtigung in `join_sparring` ziehen, `trg_notify_sparring_signup` **droppen**,
und nur bei `pending` (echter Platz) benachrichtigen — nicht bei `waitlisted`.

**16.6 `SECURITY DEFINER`-Hygiene.**
Falle: fehlendes `SET search_path` (Injection/Fehlaufloesung), interne Helfer bleiben fuer
`authenticated` aufrufbar, RPC vertraut Client-Parametern.
Richtig: jede Funktion `SECURITY DEFINER SET search_path = public`. `promote_sparring_waitlist`
und alle `notify_*`-Helfer `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated`. In jeder
RPC die Berechtigung serverseitig pruefen (`auth.uid()` = Eigentuemer des Signups;
`mark_sparring_attendance` nur Organisator/Coach). Rekursive RLS ueber DEFINER-Subfunktion
vermeiden (Muster `get_my_studio_id()` aus `CLAUDE.md`).

**16.7 Consent- und verified_only-Check gehen beim Umbau verloren.**
Falle: der Insert wandert von der Client-Policy in die RPC, dabei fallen `rules_version >= 1`
und die `verified_only`-Pruefung weg.
Richtig: beide Checks 1:1 in `join_sparring` uebernehmen (siehe alte Policy in
`20260910120000_sparring_rules_consent.sql`). Bei Verstoss saubere deutsche Fehlermeldung.

**16.8 Waitlist-Promotion — Terminierung und Grenze.**
Falle: Endlosschleife oder Ueberbuchung beim Nachruecken.
Richtig: `promote_sparring_waitlist` rueckt nur so viele `waitlisted` (aeltester
`signed_up_at` zuerst) nach, bis aktive Plaetze = `max_slots`. Schleife klar begrenzen.
An zwei Stellen aufrufen: in `cancel_sparring_signup` (sofort) und im Cron-Verfall (Schritt C).

**16.9 Client-Counts zaehlen tote Zusagen mit.**
Falle: `useOpenSparrings` zaehlt weiter alle `sparring_signups`-Zeilen -> `cancelled`/`expired`
blaehen `signup_count` auf, "voll" obwohl frei.
Richtig: Count- und `is_signed_up`-Query auf `status IN ('pending','confirmed')` filtern.
Fuer Social Proof zusaetzlich `confirmed_count`. Eigenen `my_status` mitfuehren (CTA-Steuerung).

**16.10 pg_cron auf Supabase korrekt aufsetzen.**
Falle: `CREATE EXTENSION pg_cron` schlaegt fehl oder der Job feuert nie / mit falschen Rechten.
Richtig: Extension einmalig aktivieren, `cron.schedule('sparring-lifecycle','*/15 * * * *',
$$SELECT process_sparring_lifecycle()$$)`. Die Funktion `SECURITY DEFINER`, Eigentuemer mit
Rechten auf die Tabellen. Nach Deploy **verifizieren**, dass ein Lauf tatsaechlich Zeilen
aendert (in `cron.job` / `cron.job_run_details` pruefen). Idempotenz (16.3) macht wiederholte
Laeufe unschaedlich.

**16.11 Kein handgerolltes Push — `notify_user` wiederverwenden.**
Falle: eigener `net.http_post` an Expo, Badge/Feed-Row driftet.
Richtig: fuer alle neuen Benachrichtigungen `notify_user(...)` aufrufen (Feed-Row + Push +
App-Icon-Badge sind dort schon korrekt verdrahtet, siehe `20260617120000`). Push-Fehler
duerfen die Transaktion nie abbrechen (`EXCEPTION WHEN OTHERS THEN NULL`-Muster beibehalten).

**16.12 Shared Backend — nichts brechen.**
Falle: eine geaenderte Policy/Spalte bricht `sparrapp.com` (teilt sich das Supabase-Backend).
Richtig: nur additive Schema-Aenderungen; bestehende SELECT-Policies, auf die App **und**
Website bauen, nicht entfernen. Neue Spalten/RPCs in `Supabase-Contract (Shared).md`
nachziehen (Abschnitt 15).

**16.13 Zeitzonen.**
`scheduled_at` ist `timestamptz`. Alle Intervall-Rechnungen in `timestamptz`/UTC halten, nie
mit lokaler Zeit mischen. Fristanzeige im Client aus dem echten Delta rechnen, nicht clientseitig
neue Deadlines erfinden.

---

## 17. Definition of Done je Phase

Eine Phase ist erst fertig, wenn **alle** Punkte erfuellt sind. Sonst nicht weiter.

**Phase 2 — Schema (Migration 1):**
- Spalten + CHECK-Constraint + Indizes angelegt, Bestandszeilen auf `pending` migriert.
- Client-Insert/Delete-Policies gedroppt, SELECT-Policies intakt.
- `database.types.ts` erweitert. `npx tsc --noEmit` gruen.

**Phase 3 — RPCs (Migration 2):**
- `join_sparring` (Kapazitaet atomar/`FOR UPDATE`, Consent+verified_only, UPSERT mit
  Flag-Reset), `confirm_sparring`, `cancel_sparring_signup` (Frist -> `cancelled` vs.
  `cancelled_late`, Promotion), `promote_sparring_waitlist` (revoked),
  `mark_sparring_attendance` (nur Organisator/Coach), `get_sparring_participants`,
  `get_reliability` existieren.
- Alter `trg_notify_sparring_signup` gedroppt, Benachrichtigung in RPC, nur bei `pending`.
- **Testszenarien 12 als SQL durchgespielt und bestanden**, besonders: kein Doppel-Insert
  bei Race (16.2), `expired` senkt Quote nicht (16.1), Re-Join reaktiviert Erinnerungen (16.4).

**Phase 4 — Client:**
- `useSparringActions` nutzt RPCs + `confirm`/`markAttendance`; `useOpenSparrings` filtert
  Status + fuehrt `my_status`; `useSparringReliability` liest `get_reliability`.
- Detail-Sheet: statusabhaengige CTA, verbindliche Microcopy, leicht erreichbarer
  "Kann doch nicht teilnehmen"-Button, Social-Proof-Zeile, Anwesenheits-UI fuer Organisator.
- Teilnehmerliste mit Status-Badges. Profil zeigt "X von Y", Sterne hinter `SHOW_SPARRING_STARS`
  ausgeblendet.
- Design-Regeln (keine Emojis, `@expo/vector-icons`, `colors.ts`, 8px, `StyleSheet.create`,
  SafeArea, Android-Back in Sheets). `npx tsc --noEmit` gruen.

**Phase 5 — pg_cron (Migration 3):**
- Extension aktiv, Job geplant, `process_sparring_lifecycle` mit 7d/24h/Verfall, alle Schritte
  idempotent (16.3), Verfall ruft Promotion.
- Nach Deploy verifiziert, dass ein Lauf real Zeilen aendert und nicht doppelt sendet.

**Phase 6 — Notifications:**
- Neue Typen im Feed gerendert + Deep-Link ins Detail-Sheet; 24h-Push fuehrt direkt zur
  Bestaetigung.

**Phase 7/8 — Tests + Plattformen:**
- Util-Unit-Tests (Frist-/Quotenlogik) gruen; manuelle Flows aus Abschnitt 12 auf **iOS und
  Android** (inkl. echtem Geraet) durchgespielt.

**Phase 9 — Doku:**
- Vault-Feature-Note + Funktionen-Index + Dev-Log; `Supabase-Contract (Shared).md` um neue
  Spalten/RPCs ergaenzt und gegen die Website abgeglichen.

**Finales Abnahme-Gate:** alle Punkte aus Abschnitt 12 erfuellt, `npx tsc --noEmit && npx jest`
gruen, Release-Checkliste aus `CLAUDE.md` fuer den naechsten Store-Build beachtet.


---

## Legacy-Kompatibilitaet (Prod-Deploy 2026-09-24)

Die Migrationen 0906/0910/0911 laufen seit 2026-09-24 auf Prod, **vor** dem Release von 1.2.7.
Damit Store-Builds <= 1.2.6 weiter funktionieren, gilt voruebergehend
`20260924120000_sparring_legacy_client_compat.sql`:

- Direkter INSERT (alte App) wird per Trigger zu `pending`, `rules_version = 0`; Organisator wird benachrichtigt.
- Direkter DELETE der eigenen Zeile ist erlaubt (Warteliste rueckt nach, Chat-Systemnachricht wie gehabt).
- Der Cron `sparring-lifecycle` ist **pausiert** (alte App kann nicht bestaetigen, Plaetze wuerden verfallen).

**Aufraeumen, sobald 1.2.7+ die Mindestversion ist** (als neue Migration):

```sql
DROP POLICY  IF EXISTS "legacy insert own signup" ON sparring_signups;
DROP POLICY  IF EXISTS "legacy delete own signup" ON sparring_signups;
DROP TRIGGER IF EXISTS trg_sparring_signup_legacy_insert ON sparring_signups;
DROP TRIGGER IF EXISTS trg_sparring_signup_legacy_notify ON sparring_signups;
DROP FUNCTION IF EXISTS trg_sparring_signup_legacy_insert();
DROP FUNCTION IF EXISTS trg_sparring_signup_legacy_notify();
SELECT cron.schedule('sparring-lifecycle', '*/15 * * * *', $$SELECT public.process_sparring_lifecycle()$$);
```

Danach `cron.job_run_details` pruefen. Bestehende `rules_version = 0`-Zeilen bleiben gueltig.
