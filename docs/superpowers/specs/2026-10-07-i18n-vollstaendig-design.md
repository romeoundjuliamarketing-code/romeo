# i18n vollständig: kein Deutsch/Englisch-Mix – Design

Stand: 2026-10-07 · Baut auf `2026-10-06-i18n-design.md` auf (Teil 1 + Großteil Teil 2 erledigt).

## Ziel
Deutsch ist komplett deutsch, Englisch komplett englisch. Ein Nutzer sieht in der gewählten Sprache
keine Texte der anderen Sprache: Screens, Challenge-Karten, Regeln, Disziplinen, Länder,
Benachrichtigungsliste, Push. Sprache ist schon vor dem Login (Welcome + Login) wählbar und in den
Einstellungen jederzeit änderbar.

## Erfolgskriterium
Auf EN durch alle Tabs klicken, Karte ziehen, Regeln öffnen, Profil/Länderauswahl öffnen, Push
erhalten – kein deutsches Wort (und umgekehrt auf DE). Ein Jest-Wächter verhindert neue hartcodierte
deutsche Texte.

## Nicht im Scope
- Nutzerinhalte (Chats, Bios, Gym-/Venue-Beschreibungen, Eventtitel, frei gewählte Sparringtitel).
- Website sparrapp.com (EN-Seiten für Datenschutz/AGB → offener Punkt).
- App-Store-/Play-Metadaten (manuell in den Konsolen → offener Punkt).
- iOS-Berechtigungsdialoge folgen der Gerätesprache, nicht der App-Sprache (Apple-Grenze).

## Abschnitt 1 – App

### 1.1 Sprachwahl vor dem Login
- Neue Komponente `src/components/common/LanguageToggle.tsx` (zwei Segmente „DE | EN“), nutzt
  `useLanguage().setLanguage`, wirkt sofort.
- Eingebaut oben im `WelcomeScreen` (neben „Überspringen“) und im `LoginScreen`.
- Wahl ohne Session setzt das bestehende Pending-Flag (`sparr.languagePending.v1`); nach Login
  gewinnt sie über `decideProfileSync` gegen ein älteres `profiles.language` und wird hochgeladen.
  Im Plan verifizieren, dass `setLanguage` ohne Session das Flag setzt; sonst ergänzen.
- Einstellungen: unverändert.

### 1.2 Restliche Screens auf `t()`
`HomeScreen`, `ProfilScreen`, `SparringMapScreen`, `CardsScreen`, `CardsIntro`, `TabNavigator`
sowie Einzelstellen (u. a. `StepName`, `CreateSparringSheet`, `ResetPasswordScreen`,
`SparringMapPreview`, `InvitationPreview`, `GymSparringList`, `ChatGroupMotif`,
`useSparringActions`, `useFitnessRatings`, `useAnnouncement`, `sparringShare`, `sparringDetail`,
`gymLinks`, `fightEvents`, `contentFilter`, `chatList`, `SettingsScreen`-Reste).
Texte in die bestehenden Bereichsdateien `src/i18n/locales/de|en/*.ts`. Datum nur über `formatDate`.
Vor Beginn: Prüfen, dass Codex an den 6 uncommitteten Screens nicht mehr arbeitet.

### 1.3 Inhaltsdaten
- `src/data/sparringChallenges.ts`, `sparringRules.ts`, `disciplines.ts` (und weitere
  Anzeige-Strings in `src/data/`): Textfelder als `{ de: string; en: string }`
  (Typ `LocalizedText`). Helfer `localized(text, language)` in `src/utils/localized.ts` (+ Test).
- Test: jede Karte/Regel/Disziplin hat nicht-leere `de` und `en`.
- `src/utils/countries.ts`: `Country` bekommt `nameEn`; englische Namen einmalig mit Node-`Intl.DisplayNames`
  generiert und statisch eingecheckt (Hermes-`Intl.DisplayNames` laut Code-Kommentar unzuverlässig).
  Anzeige/Suche/Sortierung nach aktiver Sprache.
- **Disziplinnamen** (in DB als deutsche Werte gespeichert: `Boxen`, `K1 / Kickboxen`, `Ringen`,
  `Sonstiges`, `Kickboxen`, `Wrestling`, …): Helfer `disciplineLabel(value, language)` in
  `src/utils/disciplineLabel.ts` (+ Test). Unbekannte Werte unverändert. Überall verwenden, wo eine
  Disziplin angezeigt wird (Badges, Sparring-Karten/-Listen, Gym-Hero, Kämpferlisten, Auswahl-Kacheln).
  Gespeicherte Werte bleiben unverändert.

### 1.4 Standard-Sparringtitel
- `open_sparrings.title` ist NOT NULL → der automatische Titel wird weiter als
  „{deutscher Disziplinwert} – Sparring“ gespeichert (kanonisch, auch für alte App-Versionen).
- Anzeige über `sparringDisplayTitle(title, language)` (`src/utils/sparringDisplayTitle.ts`, + Test):
  Titel exakt im Muster „{bekannter Disziplinwert} – Sparring“ → `disciplineLabel` + „ – Sparring“
  in aktiver Sprache (`Sonstiges – Sparring` → „Sparring“, wie bisher `displaySparringTitle`).
  Eigene Titel unverändert. Auf alle Anzeigestellen von Sparringtiteln anwenden.

### 1.5 Wächter
Jest-Test durchsucht `src/**/*.ts(x)` außer `src/i18n/locales/`, `src/data/` und Tests nach
Text-Literalen mit Umlauten/ß oder häufigen deutschen Wörtern; Ausnahmeliste (z. B. „Sparr“,
Kommentare). Schlägt bei Treffern fehl.

## Abschnitt 2 – Server (Benachrichtigungen + Push)

Entscheidung: Übersetzung beim Erzeugen auf dem Server (Weg A). Grund: eine Quelle für Texte,
wirkt auch für alte App-Versionen, Liste und Push immer gleich.

Revision 2026-10-07 (Planung): Live-Stand hat ~22 Benachrichtigungstypen, viele mit
Bedingungen und Uhrzeiten (Lifecycle-Cron, `update_sparring`, Warteliste). Eine Vorlagen-Tabelle
mit Platzhaltern müsste diese Logik nachbauen. Stattdessen baut jede Aufrufstelle Titel/Text in
**beiden Sprachen** dort, wo die Logik schon steht; der Server wählt pro Empfänger. Ergebnis für
Nutzer identisch, eine Quelle (Server), alte App-Versionen kompatibel.

### 2.1 Helfer
- `notification_lang(p_user_id uuid) RETURNS text`: `profiles.language`, NULL → `'de'`.
- `notify_user_i18n(p_user_id, p_type, p_title_de, p_body_de, p_title_en, p_body_en, p_data)`:
  wählt nach `notification_lang`, ruft dann `notify_user` (Insert + Push). Leerer EN-Text → DE.
- `notify_studio_staff_i18n(p_studio_id, p_type, p_title_de, p_body_de, p_title_en, p_body_en,
  p_data, p_exclude_user)`: wie `notify_studio_staff`, je Empfänger `notify_user_i18n`.
- `sparring_notify_safe_i18n(...)`: wie `sparring_notify_safe` (Fehler schlucken) mit i18n-Variante.
- `push_i18n(p_user_id, p_title_de, p_body_de, p_title_en, p_body_en, p_data)`: für die
  Chat-Pushes, die ohne Notification-Zeile direkt `send_push_notification` rufen.
- `sparring_title_for(p_title text, p_lang text) RETURNS text`: Muster
  „{Disziplinwert} – Sparring“ → Empfängersprache (DE/EN-Disziplinliste in SQL, identisch zum Client).
- `notif_time(p_ts timestamptz, p_lang text, p_with_date boolean) RETURNS text`: DE
  `DD.MM. um HH24:MI Uhr` / `HH24:MI Uhr`, EN `DD/MM at HH24:MI` / `HH24:MI` (Europe/Berlin).
- Alle `SECURITY DEFINER`, `SET search_path = public`, `REVOKE ALL ... FROM public, anon, authenticated`
  (wie `notify_user`).
- Bestehende `notify_user`/`notify_studio_staff`/`sparring_notify_safe` bleiben unverändert.

### 2.2 Aufrufstellen
Auf die i18n-Helfer umstellen (Definition 1:1 aus Prod via `pg_get_functiondef`, nur der
Benachrichtigungsaufruf ändert sich): `join_sparring`, `trg_sparring_signup_legacy_notify`,
`cancel_sparring_signup`, `deactivate_sparring`, `promote_sparring_waitlist`, `update_sparring`,
`process_sparring_lifecycle` (5 Typen), `deactivate_event`, `notify_event_signup`,
`notify_event_message`, `notify_sparring_group_message`, `sign_membership`,
`respond_membership_request` (2 Typen), `request_membership_cancellation`, `confirm_membership_end`,
`request_studio_join`, `respond_studio_join`.
Nutzerinhalte (Namen, eigene Titel, Studio-/Planname, Chatnachricht) bleiben unübersetzt; feste
Fallbacks („Jemand“, „dein Sparring“, „Sparring-Chat“) je Sprache.

### 2.3 Backfill
Prod hat aktuell 1 Nutzer mit `language = 'en'` (5 Einträge). Einmalig für Empfänger mit `'en'`:
Titel per Typ auf EN setzen; Body für die einfachen Typen per Regex neu bauen; sonst unverändert.

### 2.4 Kompatibilität / Kosten / Doku
Alte App-Versionen lesen `title/body` → automatisch korrekt. Keine kostenpflichtigen Dienste.
Contract-Note (`Supabase-Contract (Shared).md`) ergänzen; Website nicht betroffen.

## Abschnitt 3 – System, Rechtliches, Tests, Auslieferung

### 3.1 Berechtigungstexte
Expo `locales` in `app.config.js` mit `locales/de.json` und `locales/en.json` für
`NSLocationWhenInUseUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription`.
Native Änderung → neuer Build (beide Plattformen).

### 3.2 Datenschutz / AGB
Bei EN Link auf EN-Variante der Website, sobald vorhanden; bis dahin deutscher Link. EN-Seiten als
offener Punkt im Vault (Website-Projekt).

### 3.3 Tests
- Jest: Parität (vorhanden), Vollständigkeit Inhaltsdaten, Wächter, `localized`,
  `sparringDisplayTitle`, Länder-Fallback.
- SQL (nur lesend auf Prod): Render je Typ DE + EN.
- Manuell iOS + Android, je ein EN- und ein DE-Durchgang: Welcome/Login umschalten → einloggen →
  Sprache bleibt; alle Tabs; Karte ziehen; Regeln; Profil; Länderauswahl; Push (Sparring-Anmeldung).

### 3.4 Reihenfolge
1. Server-Migration (rückwärtskompatibel, sofort live).
2. App-Code bereichsweise, jeweils `tsc` + `jest`.
3. Berechtigungstexte, dann Build.
4. Obsidian: `Features/Mehrsprachigkeit.md`, Contract-Note, `Offene-Punkte.md`, Dev-Log.
