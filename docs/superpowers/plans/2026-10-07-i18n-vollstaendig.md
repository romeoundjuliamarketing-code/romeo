# i18n vollständig – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deutsch bleibt komplett deutsch, Englisch komplett englisch – App-UI, Inhalte, Chat-Systemnachrichten, Benachrichtigungen und Push; Sprachwahl schon auf Welcome/Login.

**Architecture:** Client: restliche Literale auf `t()`, Anzeige-Helfer für gespeicherte deutsche Werte (Disziplinen, Standard-Sparringtitel, Chat-Systemnachrichten), zweisprachige Inhaltsdaten, statische EN-Ländernamen, ein AST-Wächter-Test. Server: i18n-Varianten der Notify-Helfer, jede Aufrufstelle baut DE+EN, Auswahl pro Empfänger über `profiles.language`.

**Tech Stack:** React Native/Expo SDK 55, i18next/react-i18next, TypeScript strict, Jest (babel), Supabase Postgres (plpgsql, SECURITY DEFINER), Supabase MCP (`apply_migration`, `execute_sql`).

**Spec:** `docs/superpowers/specs/2026-10-07-i18n-vollstaendig-design.md` (inkl. Revision Abschnitt 2)

## Global Constraints

- Nach jeder Codeänderung `npx tsc --noEmit`; vor jedem Commit zusätzlich `npx jest`.
- Neue UI-Texte nur über `t('...')`; Datum nur über `formatDate`; DE-Quelle `src/i18n/locales/de/<bereich>.ts`, EN gleiche Struktur in `en/<bereich>.ts` (Paritäts-Test muss grün bleiben).
- Umlaute immer als ä/ö/ü/Ä/Ö/Ü/ß; Code-Kommentare Englisch; keine Emojis/Unicode-Symbole als Icons.
- Kein `any`; kein Inline-`style={{}}`; Abstände in 8er-Vielfachen; Farben nur aus `src/theme/colors.ts`.
- In Test-Dateien kein `import type` (Babel) – `as const` verwenden.
- Gespeicherte DB-Werte (Disziplinen, Titel, Chat-Inhalte) werden NICHT umgeschrieben; nur die Anzeige übersetzt.
- Nutzerinhalte (Namen, eigene Titel, Bios, Nachrichten, Studio-/Planname) nie übersetzen.
- Server: alle neuen Funktionen `SECURITY DEFINER`, `SET search_path = public`, `REVOKE ALL ... FROM public, anon, authenticated`. Bestehende Funktionen 1:1 aus Prod (`pg_get_functiondef`) übernehmen, nur Notify-Aufrufe ändern. Alte App-Versionen müssen unverändert funktionieren. Keine kostenpflichtigen Dienste.
- Migrationen zusätzlich als Datei unter `supabase/migrations/2026100712xxxx_<name>.sql` einchecken.
- Scope: nur das hier Genannte ändern, kein Refactoring nebenbei.
- Codex arbeitet parallel: bei „changed on disk" anhalten und fragen.

## Review Focus

1. Name mit „ hat sich angemeldet" im Namen selbst (z. B. Nutzer heißt „Max hat") → Systemnachricht-Regex muss am Ende verankert sein und den Rest als Namen nehmen; Test in Task 4.
2. Englischer Nutzer meldet sich mit altem Account an, dessen `profiles.language = 'de'` → Wahl vom Login-Screen muss gewinnen (Pending-Flag); manueller Test in Task 13, Unit-Test der Entscheidung existiert (`decideProfileSync`), zusätzlicher Test in Task 11.
3. Studio-Team mit gemischten Sprachen → jeder Staff bekommt eigene Sprache; SQL-Prüfung in Task 2.
4. Benutzerdefinierter Sparringtitel, der zufällig auf „ – Sparring" endet, aber keine bekannte Disziplin hat („Hamburg – Sparring") → bleibt unverändert; Tests in Task 4 (Client) und Task 1 (SQL).
5. EN-Text wird durch NULL-Konkatenation NULL (z. B. fehlender Name) → Fallback-Werte je Sprache, nie leerer Push; `notify_user_i18n` nimmt dann Titel+Body komplett auf DE; SQL-Prüfung in Task 1.

---

### Task 0: Codex-Stand sichern (Vorbedingung)

**Files:** keine Änderung – nur Git.

- [ ] **Step 1:** `git status` und `git diff --stat` ansehen. Erwartet: uncommittete Tab-Bar-Arbeit von Codex (`TabNavigator.tsx`, `src/components/navigation/`, `TabBarSpacer` in Home/Profil/Map/Cards, `colors.ts`, `socialAuth.ts`, `CardsIntro.tsx`).
- [ ] **Step 2:** Romeo fragen, ob Codex fertig ist und ob dieser Stand als eigener Commit gesichert werden darf. Ohne Ja nicht weitermachen.
- [ ] **Step 3:** Bei Ja: `npx tsc --noEmit && npx jest`, dann
```bash
git add src/navigation/TabNavigator.tsx src/components/navigation/ src/screens/HomeScreen.tsx src/screens/ProfilScreen.tsx src/screens/SparringMapScreen.tsx src/screens/CardsScreen.tsx src/components/challenge/CardsIntro.tsx src/theme/colors.ts src/lib/socialAuth.ts
git commit -m "feat(nav): eigene Tab-Bar (Codex-Stand)"
```

---

### Task 1: Server-Helfer für sprachabhängige Benachrichtigungen

**Files:**
- Create: `supabase/migrations/20261007120000_notification_i18n_helpers.sql`

**Interfaces:**
- Produces (SQL): `notification_lang(uuid) → text`, `notify_user_i18n(uuid,text,text,text,text,text,jsonb)`, `notify_studio_staff_i18n(uuid,text,text,text,text,text,jsonb,uuid)`, `sparring_notify_safe_i18n(uuid,text,text,text,text,text,jsonb)`, `push_i18n(uuid,text,text,text,text,jsonb)`, `discipline_label(text,text) → text`, `sparring_title_for(text,text) → text`, `notif_time(timestamptz,text,boolean) → text`.

- [ ] **Step 1: Bestehende Definitionen lesen** (`execute_sql`):
```sql
select pg_get_functiondef('public.sparring_notify_safe(uuid,text,text,text,jsonb)'::regprocedure);
select pg_get_functiondef(p.oid) from pg_proc p where p.proname = 'sparring_format_berlin';
```
`sparring_notify_safe_i18n` muss denselben Exception-Block haben wie `sparring_notify_safe`.

- [ ] **Step 2: Migration schreiben**
```sql
-- Language-aware notification helpers. Callers build title/body in both
-- languages; the recipient's profiles.language (NULL = German) picks one.
-- Existing notify_user / notify_studio_staff / sparring_notify_safe stay as-is.

CREATE OR REPLACE FUNCTION public.notification_lang(p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT language FROM profiles WHERE id = p_user_id), 'de');
$$;

CREATE OR REPLACE FUNCTION public.notify_user_i18n(
  p_user_id uuid, p_type text,
  p_title_de text, p_body_de text, p_title_en text, p_body_en text, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  -- Both English parts must exist, otherwise German for both (never mixed).
  v_en boolean := notification_lang(p_user_id) = 'en'
                  AND NULLIF(p_title_en, '') IS NOT NULL AND NULLIF(p_body_en, '') IS NOT NULL;
BEGIN
  PERFORM notify_user(
    p_user_id, p_type,
    CASE WHEN v_en THEN p_title_en ELSE p_title_de END,
    CASE WHEN v_en THEN p_body_en ELSE p_body_de END,
    p_data);
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_studio_staff_i18n(
  p_studio_id uuid, p_type text,
  p_title_de text, p_body_de text, p_title_en text, p_body_en text,
  p_data jsonb, p_exclude_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_recipient uuid;
BEGIN
  FOR v_recipient IN
    SELECT DISTINCT recipient
    FROM (
      SELECT owner_user_id AS recipient FROM studios
      WHERE id = p_studio_id AND owner_user_id IS NOT NULL
      UNION
      SELECT id AS recipient FROM profiles
      WHERE studio_id = p_studio_id AND is_coach = true
    ) AS staff
    WHERE recipient IS DISTINCT FROM p_exclude_user
  LOOP
    PERFORM notify_user_i18n(v_recipient, p_type, p_title_de, p_body_de, p_title_en, p_body_en, p_data);
  END LOOP;
END;
$$;

-- Same swallow-errors contract as sparring_notify_safe (copy its EXCEPTION block from Step 1).
CREATE OR REPLACE FUNCTION public.sparring_notify_safe_i18n(
  p_user_id uuid, p_type text,
  p_title_de text, p_body_de text, p_title_en text, p_body_en text, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM notify_user_i18n(p_user_id, p_type, p_title_de, p_body_de, p_title_en, p_body_en, p_data);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sparring_notify_safe_i18n failed: %', SQLERRM;
END;
$$;

-- Chat pushes have no notifications row.
CREATE OR REPLACE FUNCTION public.push_i18n(
  p_user_id uuid, p_title_de text, p_body_de text, p_title_en text, p_body_en text, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_en boolean := notification_lang(p_user_id) = 'en'
                  AND NULLIF(p_title_en, '') IS NOT NULL AND NULLIF(p_body_en, '') IS NOT NULL;
BEGIN
  PERFORM send_push_notification(
    p_user_id,
    CASE WHEN v_en THEN p_title_en ELSE p_title_de END,
    CASE WHEN v_en THEN p_body_en ELSE p_body_de END,
    p_data);
END;
$$;

-- Stored discipline values are German. Mirror of src/utils/disciplineLabel.ts.
CREATE OR REPLACE FUNCTION public.discipline_label(p_value text, p_lang text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_lang <> 'en' OR p_value IS NULL THEN p_value
    ELSE COALESCE((
      SELECT en FROM (VALUES
        ('Boxen', 'Boxing'), ('Kickboxen', 'Kickboxing'), ('K1 / Kickboxen', 'K1 / Kickboxing'),
        ('Ringen', 'Wrestling'), ('Sonstiges', 'Other')
      ) AS m(de, en) WHERE m.de = p_value), p_value)
  END;
$$;

-- Default titles are "<discipline> – Sparring". Mirror of src/utils/sparringDisplayTitle.ts.
CREATE OR REPLACE FUNCTION public.sparring_title_for(p_title text, p_lang text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_disc text;
BEGIN
  IF p_lang <> 'en' OR p_title IS NULL OR p_title !~ ' – Sparring$' THEN
    RETURN p_title;
  END IF;
  v_disc := regexp_replace(p_title, ' – Sparring$', '');
  IF v_disc = 'Sonstiges' THEN RETURN 'Sparring'; END IF;
  IF v_disc IN ('Boxen','Kickboxen','K1 / Kickboxen','Ringen','BJJ','MMA','Muay Thai','Wrestling') THEN
    RETURN discipline_label(v_disc, p_lang) || ' – Sparring';
  END IF;
  RETURN p_title;
END;
$$;

CREATE OR REPLACE FUNCTION public.notif_time(p_ts timestamptz, p_lang text, p_with_date boolean)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_lang = 'en' AND p_with_date THEN to_char(p_ts AT TIME ZONE 'Europe/Berlin', 'DD/MM "at" HH24:MI')
    WHEN p_lang = 'en'                 THEN to_char(p_ts AT TIME ZONE 'Europe/Berlin', 'HH24:MI')
    WHEN p_with_date                   THEN to_char(p_ts AT TIME ZONE 'Europe/Berlin', 'DD.MM. "um" HH24:MI') || ' Uhr'
    ELSE                                    to_char(p_ts AT TIME ZONE 'Europe/Berlin', 'HH24:MI') || ' Uhr'
  END;
$$;

REVOKE ALL ON FUNCTION public.notification_lang(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_user_i18n(uuid,text,text,text,text,text,jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_studio_staff_i18n(uuid,text,text,text,text,text,jsonb,uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.sparring_notify_safe_i18n(uuid,text,text,text,text,text,jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.push_i18n(uuid,text,text,text,text,jsonb) FROM public, anon, authenticated;
```
Hinweis: Die DE-Zeitformate in den Aufrufstellen bleiben exakt wie heute (`to_char(... 'DD.MM. "um" HH24:MI') || ' Uhr'`). `notif_time` liefert die identische DE-Ausgabe und darf dort verwendet werden.

- [ ] **Step 3:** Datei speichern, dann per `apply_migration` (Name `notification_i18n_helpers`) auf Prod anwenden.
- [ ] **Step 4: Prüfen** (`execute_sql`, nur lesend):
```sql
select sparring_title_for('Boxen – Sparring','en') a,      -- Boxing – Sparring
       sparring_title_for('Sonstiges – Sparring','en') b,  -- Sparring
       sparring_title_for('Hamburg – Sparring','en') c,    -- Hamburg – Sparring
       sparring_title_for('Boxen – Sparring','de') d,      -- Boxen – Sparring
       discipline_label('Ringen','en') e,                  -- Wrestling
       notif_time('2026-10-07 16:00+00','de',true) f,      -- 07.10. um 18:00 Uhr
       notif_time('2026-10-07 16:00+00','en',true) g,      -- 07/10 at 18:00
       notification_lang('00000000-0000-0000-0000-000000000000') h; -- de
```
Erwartet: Werte wie kommentiert. NULL-Fallback: in `begin; ... rollback;` `select notify_user_i18n('<en-profil-id>','x','DE-T','DE-B','EN-T',NULL,'{}');` → neue Zeile hat Titel `DE-T`, Body `DE-B` (nie leer, nie gemischt). Prüfen, dass `has_function_privilege('authenticated','public.notify_user_i18n(uuid,text,text,text,text,text,jsonb)','execute')` = false.
- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/20261007120000_notification_i18n_helpers.sql
git commit -m "feat(i18n): sprachabhängige Notify-Helfer auf dem Server"
```

---

### Task 2: Aufrufstellen auf DE+EN umstellen

**Files:**
- Create: `supabase/migrations/20261007120100_notification_i18n_callsites.sql`

**Interfaces:**
- Consumes: alle Helfer aus Task 1.

Vorgehen je Funktion: `select pg_get_functiondef('public.<name>(<args>)'::regprocedure);` → in die Migrationsdatei kopieren → nur den Notify-Aufruf ersetzen: `notify_user(` → `notify_user_i18n(`, `notify_studio_staff(` → `notify_studio_staff_i18n(`, `sparring_notify_safe(` → `sparring_notify_safe_i18n(`, `send_push_notification(` → `push_i18n(`; Titel/Body DE bleiben exakt wie heute, EN-Varianten direkt danach einfügen. Für die Empfängersprache in Titeln: `sparring_title_for(<titel>, notification_lang(<empfänger>))` nur im EN-Text verwenden (also `sparring_title_for(x,'en')`); DE-Text unverändert.

Funktionen: `join_sparring`, `trg_sparring_signup_legacy_notify`, `cancel_sparring_signup`, `deactivate_sparring`, `promote_sparring_waitlist`, `update_sparring`, `process_sparring_lifecycle`, `deactivate_event`, `notify_event_signup`, `notify_event_message`, `notify_sparring_group_message`, `sign_membership`, `respond_membership_request`, `request_membership_cancellation`, `confirm_membership_end`, `request_studio_join`, `respond_studio_join`.

**EN-Texte (verbindlich; `{x}` = derselbe Ausdruck wie im DE-Text, Titel über `sparring_title_for(...,'en')`):**

| type | EN title | EN body |
|---|---|---|
| sparring_signup | New sparring sign-up | `COALESCE(v_name,'Someone') \|\| ' signed up for “' \|\| COALESCE(sparring_title_for(v_sp.title,'en'),'your sparring') \|\| '”.'` |
| sparring_signup_cancelled | Participant withdrew | `COALESCE(v_name,'Someone') \|\| ' withdrew from “' \|\| COALESCE(sparring_title_for(v_sp.title,'en'),'your sparring') \|\| '”.'` |
| sparring_cancelled | Sparring cancelled | `'“' \|\| COALESCE(sparring_title_for(v_title,'en'),'A sparring') \|\| '” was cancelled by the organiser.'` |
| sparring_waitlist_promoted | A spot opened up | `'You''re now in “' \|\| COALESCE(sparring_title_for(v_sp.title,'en'),'the sparring') \|\| '”. '` + last-minute: `'Please quickly confirm in the app that you''re coming.'` sonst `'Please confirm your attendance in the app by ' \|\| notif_time(v_sp.scheduled_at - sparring_confirm_deadline(),'en',true) \|\| ', otherwise the spot will be released.'` |
| sparring_updated | Sparring changed | Intro `'“' \|\| sparring_title_for(<titel>,'en') \|\| '” was changed.'`; Zeilen `'New time: ' \|\| notif_time(p_scheduled_at,'en',true) \|\| ' (before ' \|\| notif_time(v_sp.scheduled_at,'en',true) \|\| ')'`, `'New location: ' \|\| v_address`, `'New duration: ' \|\| p_duration_min \|\| ' min (before ' \|\| v_sp.duration_min \|\| ' min)'`, `'New discipline: ' \|\| discipline_label(v_discipline,'en') \|\| ' (before ' \|\| discipline_label(v_sp.discipline,'en') \|\| ')'`; Schluss `'You are still on the waiting list.'` bzw. `'Please confirm the new date in the app'` + `', otherwise your spot will be released on ' \|\| notif_time(p_scheduled_at - sparring_confirm_deadline(),'en',true) \|\| '.'` bzw. `'.'`. Dafür parallel `v_lines_en`, `v_intro_en`, `v_body_en` deklarieren. |
| sparring_slot_expired | Your spot was released | `'You didn''t confirm your attendance at “' \|\| COALESCE(sparring_title_for(r.title,'en'),'the sparring') \|\| '”, so your spot was released. This doesn''t count against you. If a spot is still free, you can sign up again.'` |
| sparring_confirm_7d | Are you still in? | `'“' \|\| COALESCE(sparring_title_for(r.title,'en'),'Your sparring') \|\| '” is on ' \|\| notif_time(r.scheduled_at,'en',true) \|\| '. If you can''t make it any more, please cancel now so someone else can move up.'` |
| sparring_confirm_24h | Are you in? | `'Please confirm your attendance at “' \|\| COALESCE(sparring_title_for(r.title,'en'),'your sparring') \|\| '” on ' \|\| notif_time(r.scheduled_at,'en',true) \|\| '.'` + optional `' Without confirmation your spot will be released at ' \|\| notif_time(r.scheduled_at - v_confirm,'en',false) \|\| '.'` |
| sparring_reminder_3h | Starting soon | `'“' \|\| COALESCE(sparring_title_for(r.title,'en'),'Your sparring') \|\| '” starts today at ' \|\| notif_time(r.scheduled_at,'en',false) \|\| '.'` + `' Please quickly confirm that you''re coming.'` bzw. `' If you can''t make it after all, please cancel – the others are counting on you.'` |
| sparring_attendance_reminder | Who was there? | `'Please record attendance for “' \|\| COALESCE(sparring_title_for(r.title,'en'),'your sparring') \|\| '”. This keeps everyone''s reliability fair.'` |
| event_cancelled | Event cancelled | `'"' \|\| COALESCE(v_title,'An event') \|\| '" was cancelled by the organiser.'` |
| event_signup | New event sign-up | `v_name \|\| ' signed up for "' \|\| COALESCE(v_title,'your event') \|\| '".'` |
| membership_requested | New membership request | `v_name \|\| ' would like a membership (' \|\| v_plan.name \|\| ').'` |
| membership_confirmed | Membership confirmed | `'Your membership at ' \|\| COALESCE(v_studio_name,'the studio') \|\| ' is active.'` |
| membership_declined | Membership request declined | `'Unfortunately your membership request at ' \|\| COALESCE(v_studio_name,'the studio') \|\| ' was declined.'` |
| cancellation_requested | Cancellation received | `v_name \|\| ' cancelled the membership.'` |
| membership_ended | Membership ended | `'Your membership at ' \|\| COALESCE(v_studio_name,'the studio') \|\| ' has ended.'` |
| studio_join_request | New join request | `v_requester \|\| ' would like to join your team.'` |
| studio_join_response | approve: Join confirmed / reject: Join declined | approve `'You are now a member of ' \|\| v_studio_nm \|\| '.'`, reject `'Your join request at ' \|\| v_studio_nm \|\| ' was declined.'` |
| Sparring-Chat-Push | Titel `COALESCE(sparring_title_for(v_title,'en'),'Sparring chat')` | System: `regexp_replace(regexp_replace(left(NEW.content,120), '^(.+) hat sich angemeldet$', '\1 signed up'), '^(.+) hat abgesagt$', '\1 cancelled')`; Text: `COALESCE(v_sender,'Someone') \|\| ': ' \|\| left(NEW.content,120)`; Bild: `COALESCE(v_sender,'Someone') \|\| ' sent a photo.'` (v_sender ohne DE-Fallback „Jemand" laden; DE behält `COALESCE(v_sender,'Jemand')`) |
| Event-Chat-Push | Titel `COALESCE(v_title,'Event chat')` | `COALESCE(v_sender_raw,'Someone') \|\| ': ' \|\| left(NEW.body,120)` |

- [ ] **Step 1:** Alle 17 Definitionen lesen und in die Datei übernehmen; Aufrufe wie oben umbauen. Dabei nur Notify-Aufrufe und die dafür nötigen `v_*_en`-Variablen ändern.
- [ ] **Step 2:** Diff-Kontrolle: Pro Funktion Prod-Definition und neue Definition mit `diff` vergleichen (beide in Scratchpad speichern); nur Notify-Zeilen und neue Variablen dürfen abweichen.
- [ ] **Step 3:** `apply_migration` (Name `notification_i18n_callsites`).
- [ ] **Step 4: Prüfen** in einer Transaktion mit ROLLBACK (`execute_sql`):
```sql
begin;
-- pick any existing test sparring of Romeo's account and a second profile; set it to 'en'
update profiles set language = 'en' where id = '<testprofil-id>';
select notify_user_i18n('<testprofil-id>','sparring_signup','Neue Sparring-Anmeldung','X','New sparring sign-up','Y','{}');
select title, body from notifications where user_id = '<testprofil-id>' order by created_at desc limit 1; -- New sparring sign-up / Y
select notify_studio_staff_i18n('<studio-id>','studio_join_request','DE','de-body','EN','en-body','{}', null);
select n.user_id, p.language, n.title from notifications n join profiles p on p.id = n.user_id
  where n.created_at > now() - interval '1 minute';  -- each staff member in own language
rollback;
```
Hinweis: `send_push_notification` feuert auch in der Transaktion (pg_net läuft nach Commit – bei ROLLBACK geht nichts raus). Vorher prüfen: `select pg_get_functiondef('public.send_push_notification(uuid,text,text,jsonb)'::regprocedure)` – wenn pg_net verwendet wird, ist ROLLBACK sicher.
- [ ] **Step 5:** Smoke-Test echt: Mit Romeos EN-Testaccount über die App bei einem Test-Sparring anmelden → Push + Liste englisch; mit DE-Account → deutsch, Wortlaut wie vorher.
- [ ] **Step 6: Commit**
```bash
git add supabase/migrations/20261007120100_notification_i18n_callsites.sql
git commit -m "feat(i18n): Benachrichtigungen und Push in Empfängersprache"
```

---

### Task 3: Backfill alter Benachrichtigungen (EN-Empfänger)

**Files:**
- Create: `supabase/migrations/20261007120200_notification_i18n_backfill.sql`

- [ ] **Step 1: Migration**
```sql
-- One-off: notifications of recipients who chose English. Titles map by type;
-- bodies of the simple types are rebuilt by pattern, everything else stays.
WITH en AS (SELECT id FROM profiles WHERE language = 'en')
UPDATE notifications n SET
  title = CASE n.type
    WHEN 'sparring_signup'           THEN 'New sparring sign-up'
    WHEN 'sparring_signup_cancelled' THEN 'Participant withdrew'
    WHEN 'sparring_cancelled'        THEN 'Sparring cancelled'
    WHEN 'event_signup'              THEN 'New event sign-up'
    WHEN 'event_cancelled'           THEN 'Event cancelled'
    WHEN 'studio_join_request'       THEN 'New join request'
    WHEN 'membership_requested'      THEN 'New membership request'
    WHEN 'membership_confirmed'      THEN 'Membership confirmed'
    WHEN 'membership_declined'       THEN 'Membership request declined'
    WHEN 'membership_ended'          THEN 'Membership ended'
    WHEN 'cancellation_requested'    THEN 'Cancellation received'
    WHEN 'sparring_waitlist_promoted' THEN 'A spot opened up'
    WHEN 'sparring_slot_expired'     THEN 'Your spot was released'
    WHEN 'sparring_confirm_7d'       THEN 'Are you still in?'
    WHEN 'sparring_confirm_24h'      THEN 'Are you in?'
    WHEN 'sparring_reminder_3h'      THEN 'Starting soon'
    WHEN 'sparring_attendance_reminder' THEN 'Who was there?'
    WHEN 'sparring_updated'          THEN 'Sparring changed'
    WHEN 'studio_join_response'      THEN CASE WHEN (n.data->>'approved')::boolean THEN 'Join confirmed' ELSE 'Join declined' END
    ELSE n.title END,
  body = CASE
    WHEN n.type = 'sparring_signup' AND n.body ~ '^(.+) hat sich für „(.+)“ angemeldet\.$'
      THEN regexp_replace(n.body, '^(.+) hat sich für „(.+)“ angemeldet\.$', '\1 signed up for “\2”.')
    WHEN n.type = 'sparring_signup_cancelled' AND n.body ~ '^(.+) hat sich von „(.+)“ abgemeldet\.$'
      THEN regexp_replace(n.body, '^(.+) hat sich von „(.+)“ abgemeldet\.$', '\1 withdrew from “\2”.')
    WHEN n.type = 'sparring_cancelled' AND n.body ~ '^"(.+)" wurde vom Organisator abgesagt\.$'
      THEN regexp_replace(n.body, '^"(.+)" wurde vom Organisator abgesagt\.$', '“\1” was cancelled by the organiser.')
    WHEN n.type = 'event_signup' AND n.body ~ '^(.+) hat sich für "(.+)" angemeldet\.$'
      THEN regexp_replace(n.body, '^(.+) hat sich für "(.+)" angemeldet\.$', '\1 signed up for "\2".')
    WHEN n.type = 'studio_join_request' AND n.body ~ '^(.+) möchte deinem Team beitreten\.$'
      THEN regexp_replace(n.body, '^(.+) möchte deinem Team beitreten\.$', '\1 would like to join your team.')
    WHEN n.type = 'membership_confirmed' AND n.body ~ '^Deine Mitgliedschaft bei (.+) ist aktiv\.$'
      THEN regexp_replace(n.body, '^Deine Mitgliedschaft bei (.+) ist aktiv\.$', 'Your membership at \1 is active.')
    WHEN n.type = 'membership_ended' AND n.body ~ '^Deine Mitgliedschaft bei (.+) wurde beendet\.$'
      THEN regexp_replace(n.body, '^Deine Mitgliedschaft bei (.+) wurde beendet\.$', 'Your membership at \1 has ended.')
    WHEN n.type = 'cancellation_requested' AND n.body ~ '^(.+) hat die Mitgliedschaft gekündigt\.$'
      THEN regexp_replace(n.body, '^(.+) hat die Mitgliedschaft gekündigt\.$', '\1 cancelled the membership.')
    ELSE n.body END
FROM en WHERE n.user_id = en.id;
```
- [ ] **Step 2:** Vorher `select type,title,body from notifications n join profiles p on p.id=n.user_id where p.language='en'` notieren, `apply_migration` (Name `notification_i18n_backfill`), danach erneut abfragen; erwartet: Titel EN, einfache Bodies EN, Rest unverändert.
- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/20261007120200_notification_i18n_backfill.sql
git commit -m "chore(i18n): alte Benachrichtigungen englischer Nutzer übersetzt"
```

---

### Task 4: Anzeige-Helfer für gespeicherte deutsche Werte

**Files:**
- Create: `src/utils/disciplineLabel.ts`, `src/utils/disciplineLabel.test.ts`
- Create: `src/utils/sparringDisplayTitle.ts`, `src/utils/sparringDisplayTitle.test.ts`
- Create: `src/utils/systemMessageText.ts`, `src/utils/systemMessageText.test.ts`
- Modify: `src/utils/homeAgenda.ts:96-101` (`displaySparringTitle` delegiert), `src/i18n/locales/de/chat.ts`, `src/i18n/locales/en/chat.ts`

**Interfaces:**
- Produces: `disciplineLabel(value: string, language: AppLanguage): string`; `sparringDisplayTitle(title: string, language: AppLanguage): string`; `systemMessageText(content: string, t: (key: 'chat.system.joined' | 'chat.system.cancelled', opts: { name: string }) => string): string`.

- [ ] **Step 1: Failing tests**
```ts
// src/utils/disciplineLabel.test.ts
import { disciplineLabel } from './disciplineLabel';

describe('disciplineLabel', () => {
  it('translates stored German values to English', () => {
    expect(disciplineLabel('Boxen', 'en' as const)).toBe('Boxing');
    expect(disciplineLabel('K1 / Kickboxen', 'en' as const)).toBe('K1 / Kickboxing');
    expect(disciplineLabel('Ringen', 'en' as const)).toBe('Wrestling');
    expect(disciplineLabel('Sonstiges', 'en' as const)).toBe('Other');
  });
  it('keeps German and unknown values as stored', () => {
    expect(disciplineLabel('Boxen', 'de' as const)).toBe('Boxen');
    expect(disciplineLabel('Capoeira', 'en' as const)).toBe('Capoeira');
    expect(disciplineLabel('MMA', 'en' as const)).toBe('MMA');
  });
});
```
```ts
// src/utils/sparringDisplayTitle.test.ts
import { sparringDisplayTitle } from './sparringDisplayTitle';

describe('sparringDisplayTitle', () => {
  it('translates default titles', () => {
    expect(sparringDisplayTitle('Boxen – Sparring', 'en' as const)).toBe('Boxing – Sparring');
    expect(sparringDisplayTitle('K1 / Kickboxen – Sparring', 'en' as const)).toBe('K1 / Kickboxing – Sparring');
  });
  it('shows the catch-all discipline as plain Sparring in both languages', () => {
    expect(sparringDisplayTitle('Sonstiges – Sparring', 'en' as const)).toBe('Sparring');
    expect(sparringDisplayTitle('Sonstiges – Sparring', 'de' as const)).toBe('Sparring');
  });
  it('keeps own titles, including ones that end like a default', () => {
    expect(sparringDisplayTitle('Hamburg – Sparring', 'en' as const)).toBe('Hamburg – Sparring');
    expect(sparringDisplayTitle('  Lockeres Box sparring ', 'en' as const)).toBe('Lockeres Box sparring');
    expect(sparringDisplayTitle('Boxen – Sparring', 'de' as const)).toBe('Boxen – Sparring');
  });
});
```
```ts
// src/utils/systemMessageText.test.ts
import { systemMessageText } from './systemMessageText';

const fakeT = (key: 'chat.system.joined' | 'chat.system.cancelled', opts: { name: string }): string =>
  `${key}:${opts.name}`;

describe('systemMessageText', () => {
  it('maps the stored German join/cancel messages', () => {
    expect(systemMessageText('Yves hat sich angemeldet', fakeT)).toBe('chat.system.joined:Yves');
    expect(systemMessageText('Leon Maier hat abgesagt', fakeT)).toBe('chat.system.cancelled:Leon Maier');
  });
  it('anchors at the end so names may contain the phrase start', () => {
    expect(systemMessageText('Max hat hat sich angemeldet', fakeT)).toBe('chat.system.joined:Max hat');
  });
  it('returns unknown system text unchanged', () => {
    expect(systemMessageText('Etwas anderes', fakeT)).toBe('Etwas anderes');
  });
});
```
- [ ] **Step 2:** `npx jest src/utils/disciplineLabel.test.ts src/utils/sparringDisplayTitle.test.ts src/utils/systemMessageText.test.ts` → FAIL (Module fehlen).
- [ ] **Step 3: Implementierung**
```ts
// src/utils/disciplineLabel.ts
// Discipline values are stored in German (sparrings, profiles, gyms). Only the
// display is translated; mirror of public.discipline_label on the server.
import type { AppLanguage } from './language';

const EN: Record<string, string> = {
  'Boxen':          'Boxing',
  'Kickboxen':      'Kickboxing',
  'K1 / Kickboxen': 'K1 / Kickboxing',
  'Ringen':         'Wrestling',
  'Sonstiges':      'Other',
};

export const KNOWN_DISCIPLINES: readonly string[] = [
  'Boxen', 'Kickboxen', 'K1 / Kickboxen', 'Ringen', 'Sonstiges', 'BJJ', 'MMA', 'Muay Thai', 'Wrestling',
];

export function disciplineLabel(value: string, language: AppLanguage): string {
  if (language === 'de') return value;
  return EN[value] ?? value;
}
```
```ts
// src/utils/sparringDisplayTitle.ts
// Default sparring titles are stored as "<German discipline> – Sparring"
// (open_sparrings.title is NOT NULL). Mirror of public.sparring_title_for.
import type { AppLanguage } from './language';
import { disciplineLabel, KNOWN_DISCIPLINES } from './disciplineLabel';

const SUFFIX = ' – Sparring';

export function sparringDisplayTitle(title: string, language: AppLanguage): string {
  const trimmed = title.trim();
  if (!trimmed.endsWith(SUFFIX)) return trimmed;
  const discipline = trimmed.slice(0, -SUFFIX.length);
  if (discipline === 'Sonstiges') return 'Sparring';
  if (!KNOWN_DISCIPLINES.includes(discipline)) return trimmed;
  return `${disciplineLabel(discipline, language)}${SUFFIX}`;
}
```
```ts
// src/utils/systemMessageText.ts
// Sparring chat system messages are stored as German text by the server
// ("<name> hat sich angemeldet" / "<name> hat abgesagt"); render them in the
// active language. Unknown system text is shown as stored.
type SystemKey = 'chat.system.joined' | 'chat.system.cancelled';

const PATTERNS: readonly { re: RegExp; key: SystemKey }[] = [
  { re: /^(.+) hat sich angemeldet$/, key: 'chat.system.joined' },
  { re: /^(.+) hat abgesagt$/,        key: 'chat.system.cancelled' },
];

export function systemMessageText(
  content: string,
  t: (key: SystemKey, opts: { name: string }) => string,
): string {
  for (const { re, key } of PATTERNS) {
    const m = content.match(re);
    if (m) return t(key, { name: m[1] });
  }
  return content;
}
```
`homeAgenda.ts`: `displaySparringTitle(title)` → `return sparringDisplayTitle(title, parseLanguage(i18n.language) ?? 'de');` (Imports ergänzen; bestehende Tests in `homeAgenda.test.ts` müssen grün bleiben).
Locales: in `de/chat.ts` `system: { joined: '{{name}} hat sich angemeldet', cancelled: '{{name}} hat abgesagt' }`, in `en/chat.ts` `system: { joined: '{{name}} signed up', cancelled: '{{name}} cancelled' }` (an passender Stelle im bestehenden Objekt).
- [ ] **Step 4:** `npx jest` → PASS (inkl. `homeAgenda.test.ts`, `locales.test.ts`); `npx tsc --noEmit` → ok.
- [ ] **Step 5: Commit**
```bash
git add src/utils/disciplineLabel* src/utils/sparringDisplayTitle* src/utils/systemMessageText* src/utils/homeAgenda.ts src/i18n/locales/de/chat.ts src/i18n/locales/en/chat.ts
git commit -m "feat(i18n): Anzeige-Helfer für Disziplinen, Sparringtitel, Chat-Systemnachrichten"
```

---

### Task 5: Helfer an allen Anzeigestellen einsetzen

**Files (Modify):** `src/components/profil/DisciplineBadges.tsx:19`, `src/components/sparring/SparringMapPreview.tsx:63`, `src/components/sparring/SparringListView.tsx:130`, `src/components/sparring/SparringDetailHeader.tsx:43`, `src/components/sparring/SparringStoryCard.tsx:46`, `src/components/gym/GymHero.tsx:99`, `src/components/gym/GymSparringList.tsx:81`, `src/screens/GymFightersScreen.tsx:41`, `src/components/sparring/create/StepWhat.tsx` (`DisciplineTile`-Name), `src/components/profil/edit/SportSelectors.tsx` (Anzeige der Optionen), `src/utils/sparringMarkerLabel.ts` (`shortDiscipline`: `'Sonstiges'` bleibt „Sparring", sonst `disciplineLabel` vor dem Kürzen), `src/components/chat/GroupMessageBubble.tsx:32`, Chat-Listen-Vorschau mit `lastIsSystem` (`src/hooks/useSparringChatList.ts:90` bzw. die rendernde Komponente).
Plus jede Stelle, die `sparring.title`/`s.title`/`selected.title` eines Sparrings rendert (Fundstellen: `grep -rn "\.title" src --include='*.tsx' | grep -i sparring`) → `sparringDisplayTitle(x, language)`. Event-Titel nicht.

**Interfaces:** Consumes Task 4. `language` via `const { language } = useLanguage();` (`src/i18n/language.ts`); in Nicht-React-Utils `parseLanguage(i18n.language) ?? 'de'`.

- [ ] **Step 1:** Je Datei: Anzeige-Ausdruck ersetzen, z. B. `{d}` → `{disciplineLabel(d, language)}`, `{message.content}` (System) → `{systemMessageText(message.content ?? '', t)}`. `key`/gespeicherte Werte/Vergleiche (`discipline === d`) bleiben auf dem Rohwert.
- [ ] **Step 2:** Bestehende Tests für `sparringMarkerLabel` anpassen/ergänzen: `shortDiscipline('Boxen')` bleibt in DE `Boxen`; in EN (i18n auf 'en' setzen) `Boxing`.
- [ ] **Step 3:** `npx tsc --noEmit && npx jest` → grün.
- [ ] **Step 4: Commit** `git commit -am "feat(i18n): Disziplinen, Sparringtitel und Systemnachrichten in aktiver Sprache"` (nur die genannten Dateien stagen).

---

### Task 6: Zweisprachige Inhaltsdaten

**Files:**
- Create: `src/utils/localized.ts`, `src/utils/localized.test.ts`, `src/data/contentCompleteness.test.ts`
- Modify: `src/data/sparringChallenges.ts`, `src/data/sparringRules.ts`, `src/data/disciplines.ts` (`SUPERCATEGORIES.label`), `src/data/cardFrames.ts` (`label`), alle Konsumenten dieser Felder (`grep -rn "SPARRING_CHALLENGES\|CHALLENGE_AREAS\|SPARRING_RULES\|SUPERCATEGORIES\|CARD_FRAMES\|\.instruction\|\.successCriteria" src --include='*.tsx' --include='*.ts'`)

**Interfaces:**
- Produces: `type LocalizedText = { readonly de: string; readonly en: string }`; `localized(text: LocalizedText, language: AppLanguage): string`; `useLocalized(): (text: LocalizedText) => string`.

- [ ] **Step 1: Failing tests**
```ts
// src/utils/localized.test.ts
import { localized } from './localized';

describe('localized', () => {
  const text = { de: 'Hallo', en: 'Hello' } as const;
  it('picks the active language', () => {
    expect(localized(text, 'de' as const)).toBe('Hallo');
    expect(localized(text, 'en' as const)).toBe('Hello');
  });
  it('falls back to German when English is empty', () => {
    expect(localized({ de: 'Hallo', en: '' }, 'en' as const)).toBe('Hallo');
  });
});
```
```ts
// src/data/contentCompleteness.test.ts
import { SPARRING_CHALLENGES, CHALLENGE_AREAS } from './sparringChallenges';
import { SPARRING_RULES, SPARRING_RULES_INTRO, SPARRING_RULES_PREAMBLE } from './sparringRules';
import { SUPERCATEGORIES } from './disciplines';

const filled = (t: { de: string; en: string }): boolean => t.de.trim().length > 0 && t.en.trim().length > 0;

describe('bilingual content', () => {
  it('every challenge card has de + en', () => {
    for (const c of SPARRING_CHALLENGES) {
      expect([c.id, filled(c.title), filled(c.instruction), filled(c.focus)]).toEqual([c.id, true, true, true]);
      if (c.successCriteria) expect([c.id, filled(c.successCriteria)]).toEqual([c.id, true]);
    }
    for (const a of CHALLENGE_AREAS) expect(filled(a.label)).toBe(true);
  });
  it('rules have de + en', () => {
    expect(filled(SPARRING_RULES_PREAMBLE)).toBe(true);
    expect(filled(SPARRING_RULES_INTRO.title)).toBe(true);
    SPARRING_RULES_INTRO.paragraphs.forEach((p) => expect(filled(p)).toBe(true));
    SPARRING_RULES.forEach((r) => expect([r.number, filled(r.title), filled(r.body)]).toEqual([r.number, true, true]));
  });
  it('supercategories have de + en', () => {
    SUPERCATEGORIES.forEach((s) => expect(filled(s.label)).toBe(true));
  });
});
```
- [ ] **Step 2:** `npx jest src/utils/localized.test.ts src/data/contentCompleteness.test.ts` → FAIL.
- [ ] **Step 3: Implementierung**
```ts
// src/utils/localized.ts
// Bilingual content fields (challenge cards, rules, ...) that live in src/data/.
import type { AppLanguage } from './language';

export interface LocalizedText {
  readonly de: string;
  readonly en: string;
}

export function localized(text: LocalizedText, language: AppLanguage): string {
  return language === 'en' && text.en.trim().length > 0 ? text.en : text.de;
}
```
Hook in `src/i18n/language.ts` ergänzen:
```ts
export function useLocalized(): (text: LocalizedText) => string {
  const { language } = useLanguage();
  return useCallback((text: LocalizedText) => localized(text, language), [language]);
}
```
Datenumbau: In `SparringChallenge` `title/instruction/focus/successCriteria` → `LocalizedText`; `ChallengeAreaMeta.label` → `LocalizedText` (`{ de: 'Boxen', en: 'Boxing' }`, `{ de: 'Kickboxen', en: 'Kickboxing' }`, Muay Thai/MMA gleich). Platzhalterkarten: `title: { de: 'Platzhalter Boxen 1', en: 'Placeholder Boxing 1' }`, `instruction: { de: 'Challenge-Text folgt.', en: 'Challenge text coming soon.' }`, `focus: { de: 'Platzhalter', en: 'Placeholder' }` (per Skript, nicht von Hand: Node-Skript im Scratchpad, das die Datei liest und die drei Felder umschreibt; danach Datei prüfen). Regeln: alle Texte `{ de, en }` mit sorgfältiger EN-Übersetzung (verbindlicher Rechtstext – sinngetreu, nicht frei); `SPARRING_RULES_VERSION` NICHT erhöhen (Inhalt unverändert, nur Übersetzung). `SUPERCATEGORIES.label`: Striking/Endurance/Strength/Mobility/Grappling. `cardFrames.label`: Classic/Blue/Night etc.
Konsumenten auf `useLocalized()` bzw. `localized(x, language)` umstellen.
- [ ] **Step 4:** `npx tsc --noEmit && npx jest` → grün.
- [ ] **Step 5: Commit** `git commit -m "feat(i18n): Challenge-Karten, Regeln, Kategorien und Kartenrahmen zweisprachig"` (betroffene Dateien stagen).

---

### Task 7: Ländernamen Englisch

**Files:**
- Modify: `src/utils/countries.ts`, `src/utils/countries.test.ts`, `src/components/profil/CountryPickerSheet.tsx`, `src/components/profil/ProfileHeader.tsx`, `src/screens/EditProfileScreen.tsx`

**Interfaces:**
- Produces: `interface Country { code: string; name: string; nameEn: string }`; `countryName(c: Country, language: AppLanguage): string`; `searchCountries(query: string, language: AppLanguage): Country[]` (sortiert nach Name der aktiven Sprache).

- [ ] **Step 1: Failing tests** in `countries.test.ts` ergänzen:
```ts
it('has an English name for every country', () => {
  COUNTRIES.forEach((c) => expect([c.code, c.nameEn.length > 0]).toEqual([c.code, true]));
});
it('names and searches in the active language', () => {
  const de = countryByCode('DE');
  expect(de && countryName(de, 'en' as const)).toBe('Germany');
  expect(de && countryName(de, 'de' as const)).toBe('Deutschland');
  expect(searchCountries('germ', 'en' as const).map((c) => c.code)).toContain('DE');
  expect(searchCountries('äg', 'de' as const).map((c) => c.code)).toContain('EG');
});
```
- [ ] **Step 2:** `npx jest src/utils/countries.test.ts` → FAIL.
- [ ] **Step 3:** `nameEn` per Node einmalig erzeugen (Scratchpad-Skript, liest `countries.ts`, ergänzt `nameEn: new Intl.DisplayNames(['en'],{type:'region'}).of(code)`; Sonderfälle von Hand: `GB-ENG` England, `GB-SCT` Scotland, `GB-WLS` Wales, `GB-NIR` Northern Ireland, `XK` Kosovo). `countryName` + Sprachparameter in `searchCountries` (Normalisierung bleibt), Sortierung `localeCompare(…, localeFor(language))`. Kommentar oben anpassen (englisch). Konsumenten mit `useLanguage()` aufrufen.
- [ ] **Step 4:** `npx tsc --noEmit && npx jest` → grün.
- [ ] **Step 5: Commit** `git commit -m "feat(i18n): Ländernamen auf Englisch"`.

---

### Task 8: Wächter-Test gegen hartcodierte deutsche Texte

**Files:**
- Create: `src/i18n/noGermanLiterals.test.ts`

- [ ] **Step 1: Test schreiben** (nutzt `typescript` aus devDependencies):
```ts
// Fails when German UI text is hardcoded outside the locale files. Walks the
// TypeScript AST so comments and regex literals are ignored.
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = [path.join(ROOT, 'i18n', 'locales'), path.join(ROOT, 'data')];
const SKIP_FILES = new Set([path.join(ROOT, 'utils', 'countries.ts')]);
const GERMAN = /[äöüÄÖÜß]|\b(und|nicht|wird|wurde|deine?n?|kein(e|en)?|bitte|jetzt|wählen|zurück|speichern|abbrechen|löschen|Fehler|Einstellungen|Anmelden|möchtest|wirklich)\b/;
// Stored server values / brand names that must stay as they are.
const ALLOWED = new Set(['Sparr', 'Boxen', 'Kickboxen', 'K1 / Kickboxen', 'Ringen', 'Sonstiges',
  ' – Sparring', ' hat sich angemeldet', ' hat abgesagt', 'Sonstiges – Sparring']);

function files(dir: string): string[] {
  if (SKIP_DIRS.some((d) => dir.startsWith(d))) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return files(p);
    if (!/\.tsx?$/.test(e.name) || /\.test\.tsx?$/.test(e.name) || /\.d\.ts$/.test(e.name)) return [];
    return SKIP_FILES.has(p) ? [] : [p];
  });
}

function isLoggingCall(node: ts.Node): boolean {
  let cur: ts.Node | undefined = node.parent;
  while (cur) {
    if (ts.isCallExpression(cur) && /^console\.|^Sentry\./.test(cur.expression.getText())) return true;
    cur = cur.parent;
  }
  return false;
}

function hits(file: string): string[] {
  const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const out: string[] = [];
  const check = (node: ts.Node, text: string): void => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || ALLOWED.has(text) || ALLOWED.has(trimmed)) return;
    if (GERMAN.test(trimmed) && !isLoggingCall(node)) {
      const { line } = src.getLineAndCharacterOfPosition(node.getStart());
      out.push(`${path.relative(ROOT, file)}:${line + 1}  ${trimmed.slice(0, 60)}`);
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) check(node, node.text);
    else if (ts.isTemplateExpression(node)) {
      check(node, node.head.text);
      node.templateSpans.forEach((s) => check(s, s.literal.text));
    } else if (ts.isJsxText(node)) check(node, node.text);
    ts.forEachChild(node, visit);
  };
  visit(src);
  return out;
}

describe('no hardcoded German UI text', () => {
  it('finds none outside src/i18n/locales and src/data', () => {
    expect(files(ROOT).flatMap(hits)).toEqual([]);
  });
});
```
- [ ] **Step 2:** `npx jest src/i18n/noGermanLiterals.test.ts` → FAIL mit Trefferliste (das ist die Arbeitsliste für Task 9). Treffer, die gespeicherte Server-Werte oder Vergleiche sind (z. B. `=== 'Sonstiges'`, Regex-Strings für deutsche Adressen), in `ALLOWED` aufnehmen bzw. Datei in `SKIP_FILES` – jeweils mit Begründungskommentar. Ist `GERMAN` zu breit (englische Treffer), Wortliste kürzen.
- [ ] **Step 3:** Liste für Task 9 im Scratchpad sichern. Test bleibt vorerst rot; Commit erst in Task 9.

---

### Task 9: Restliche Screens und Einzelstellen auf `t()`

**Files (Modify, laut Wächter-Liste, mindestens):** `src/screens/HomeScreen.tsx`, `src/screens/ProfilScreen.tsx` (136, 196, 340), `src/screens/SparringMapScreen.tsx` (354, 526, 600, 612, 619, 652, 684, 805, 819, 928, 935 + weitere ohne Umlaut), `src/screens/CardsScreen.tsx` (75, 77, 87, 119), `src/components/challenge/CardsIntro.tsx` (23, 28, 72, 87, 95), `src/navigation/TabNavigator.tsx`, `src/components/navigation/SparrTabBar.tsx`, `src/hooks/useAnnouncement.ts:33`, `src/components/gym/GymSparringList.tsx:15` (Monatsnamen → `formatDate`), sowie alle weiteren Wächter-Treffer. Locale-Dateien der passenden Bereiche (`home`, `profile`, `map`, `challenge`, `common`, `team`).

- [ ] **Step 1:** Je Datei: Literal → `t('<bereich>.<key>')`; Key in `de/<bereich>.ts` mit exakt dem bisherigen deutschen Text, gleicher Key in `en/<bereich>.ts` mit englischer Übersetzung. Interpolation mit `{{name}}`. Datum über `formatDate`. Sparringtitel in Texten über `sparringDisplayTitle`.
- [ ] **Step 2:** Nach jeder Datei `npx tsc --noEmit`.
- [ ] **Step 3:** `npx jest` → alles grün inkl. Wächter und Paritäts-Test.
- [ ] **Step 4: Commit**
```bash
git add src/screens src/components src/navigation src/hooks src/i18n
git commit -m "feat(i18n): restliche Screens auf Englisch, Wächter gegen deutsche Literale"
```

---

### Task 10: Datenschutz-/AGB-Links sprachabhängig

**Files:** Modify `src/screens/SettingsScreen.tsx:321-328`, ggf. weitere Stellen mit `sparrapp.com/datenschutz`/`agb` (`grep -rn "sparrapp.com/" src`).

- [ ] **Step 1:** Prüfen, ob `https://sparrapp.com/en/datenschutz.html` o. ä. existiert (`curl -sI`). Wenn nein: Links unverändert lassen und offenen Punkt im Vault anlegen (Task 13). Wenn ja: URL nach `language` wählen.
- [ ] **Step 2:** `npx tsc --noEmit`; Commit nur bei Änderung.

---

### Task 11: Sprachwahl auf Welcome und Login

**Files:**
- Create: `src/components/common/LanguageToggle.tsx`
- Modify: `src/screens/auth/WelcomeScreen.tsx:73-81`, `src/screens/auth/LoginScreen.tsx` (oben, über dem Formular), `src/i18n/locales/de/common.ts`, `src/i18n/locales/en/common.ts`, `src/utils/language.test.ts`

**Interfaces:** Consumes `useLanguage()`; Produces `<LanguageToggle onDark?: boolean />`.

- [ ] **Step 1: Test für die Login-Situation** in `src/utils/language.test.ts` ergänzen:
```ts
it('a choice made before login beats an older profile value', () => {
  expect(decideProfileSync('de', 'en' as const, true)).toEqual({ apply: null, upload: 'en' });
});
```
`npx jest src/utils/language.test.ts` → PASS (Verhalten existiert, Test sichert es ab).
- [ ] **Step 2: Komponente**
```tsx
// Compact DE | EN switch for screens without access to Settings (welcome, login).
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/language';
import { APP_LANGUAGES, type AppLanguage } from '../../utils/language';

const LABEL: Record<AppLanguage, string> = { de: 'DE', en: 'EN' };

export default function LanguageToggle(): React.ReactElement {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('common.language')}>
      {APP_LANGUAGES.map((lang) => {
        const selected = lang === language;
        return (
          <TouchableOpacity
            key={lang}
            style={[styles.segment, selected && styles.segmentSelected]}
            onPress={() => { if (!selected) void setLanguage(lang); }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={t(lang === 'de' ? 'common.languageGerman' : 'common.languageEnglish')}
            hitSlop={8}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{LABEL[lang]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row:             { flexDirection: 'row', borderRadius: 16, borderWidth: 1, borderColor: colors.text, overflow: 'hidden' },
  segment:         { paddingHorizontal: 8, paddingVertical: 8, minWidth: 40, alignItems: 'center' },
  segmentSelected: { backgroundColor: colors.text },
  label:           { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.text },
  labelSelected:   { color: colors.background },
});
```
(Font-Familienname aus vorhandenen Styles übernehmen, falls abweichend. `accessibilityState={{ selected }}` ist ein Prop-Objekt, kein Inline-Style.) Locales: `common.language` „Sprache"/„Language", `common.languageGerman` „Deutsch"/„German", `common.languageEnglish` „Englisch"/„English" – falls schon vorhanden (z. B. in `settings`), diese Keys verwenden statt neue anzulegen.
- [ ] **Step 3:** Einbau: `WelcomeScreen` in `styles.topBar` zwischen Brand und „Überspringen" (`<View style={styles.topActions}>` mit Toggle + Skip, `gap: 16`); `LoginScreen` oben rechts im vorhandenen Header-/Top-Bereich. Safe-Area beachten (bestehende Insets nutzen).
- [ ] **Step 4:** `npx tsc --noEmit && npx jest` → grün (Wächter: „DE"/„EN" sind keine Treffer).
- [ ] **Step 5: Commit** `git commit -m "feat(i18n): Sprachwahl auf Welcome- und Login-Screen"`.

---

### Task 12: Berechtigungstexte lokalisiert

**Files:**
- Create: `locales/de.json`, `locales/en.json`
- Modify: `app.config.js` (`expo.locales`, `ios.infoPlist`)

- [ ] **Step 1:**
```json
// locales/de.json
{
  "NSLocationWhenInUseUsageDescription": "Sparr zeigt dir Sparring-Partner in deiner Nähe.",
  "NSPhotoLibraryUsageDescription": "Sparr verwendet deine Fotos, um Bilder im Sparring-Chat zu senden.",
  "NSCameraUsageDescription": "Sparr nutzt die Kamera, um den QR-Code eines Kämpferprofils zu scannen."
}
```
```json
// locales/en.json
{
  "NSLocationWhenInUseUsageDescription": "Sparr shows you sparring partners near you.",
  "NSPhotoLibraryUsageDescription": "Sparr uses your photos to send pictures in the sparring chat.",
  "NSCameraUsageDescription": "Sparr uses the camera to scan the QR code of a fighter profile."
}
```
(JSON ohne Kommentare speichern.) In `app.config.js` unter `expo`: `locales: { de: "./locales/de.json", en: "./locales/en.json" }`. Bestehende deutschen `infoPlist`-/Plugin-Texte bleiben als Basis. Außerdem `ios.infoPlist.CFBundleLocalizations: ["de", "en"]` und `CFBundleDevelopmentRegion: "de"`, falls nicht vorhanden.
- [ ] **Step 2:** `.easignore`-Check aus CLAUDE.md laufen lassen (neuer Root-Ordner `locales/` darf nicht ausgeschlossen sein): Befehl aus Release-Checkliste Punkt 3, Filter um `locales/` erweitern.
- [ ] **Step 3:** `npx expo config --type introspect | grep -A3 locales` → beide Dateien referenziert. `npx expo-doctor` → keine neuen Issues.
- [ ] **Step 4: Commit** `git add locales app.config.js && git commit -m "feat(i18n): Berechtigungstexte Deutsch/Englisch"`.

---

### Task 13: Gerätetest, Doku, offene Punkte

- [ ] **Step 1:** `npx tsc --noEmit && npx jest` → grün.
- [ ] **Step 2:** Dev-Build iOS (`npx expo run:ios`) und Android (`npx expo run:android`) – native Änderung durch `locales`. Je ein Durchgang EN und DE:
  - Welcome → Toggle EN → Login mit Account, dessen Profil `de` hat → App bleibt EN; Einstellungen zeigen English; umschalten DE wirkt sofort.
  - Alle Tabs, Tab-Bar-Labels, Karte ziehen (Cards), Regeln, Profil, Kämpfer suchen, Länderauswahl, Sparring erstellen/absagen (Alerts), Sparring-Chat (Systemnachrichten), Gym-Seite.
  - Push: zweiter Account meldet sich beim Sparring an → Push + Liste in Empfängersprache.
  - Android: Hardware-Back auf Welcome/Login mit Toggle; Tastatur auf Login verdeckt Felder nicht.
- [ ] **Step 3:** Obsidian (`/Users/romeogeorgiadis/Documents/Obsidian Vault/02 Projekte/Sparr/`):
  - `Features/Mehrsprachigkeit.md`: Teile 2–5 Status, neue Helfer (Client + Server), Wächter, Revision Server-Ansatz.
  - `Supabase-Contract (Shared).md`: neue Funktionen (`notify_user_i18n` usw., `discipline_label`, `sparring_title_for`, `notif_time`), Website nicht betroffen.
  - `Offene-Punkte.md`: EN-Seiten Datenschutz/AGB auf sparrapp.com; App-Store-/Play-Metadaten EN; iOS-Berechtigungsdialoge folgen Gerätesprache; echte Challenge-Karten müssen zweisprachig geliefert werden; alte Benachrichtigungen bei Sprachwechsel bleiben in alter Sprache; Gerätetests ausstehend falls nicht erledigt.
  - `Dev-Log/2026-10-07.md` nach Vorlage.
- [ ] **Step 4:** Memory-Eintrag nur falls etwas Nicht-Offensichtliches entsteht (z. B. „Disziplinen/Titel/Systemnachrichten sind in DB deutsch, Anzeige über Helfer").
