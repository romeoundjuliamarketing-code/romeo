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
- `src/utils/countries.ts`: Namen über `Intl.DisplayNames([locale], { type: 'region' })`;
  wenn nicht verfügbar oder Ergebnis leer → bestehende Liste als Fallback.

### 1.4 Standard-Sparringtitel
- Neu erstellte Sparrings ohne eigenen Titel speichern `title` leer statt
  „{Disziplin} – Sparring“.
- Anzeige über Helfer `sparringDisplayTitle(sparring, language)` (in `src/utils/`, + Test): leer →
  „{Disziplin} – Sparring“ in aktiver Sprache; alter gespeicherter Titel, der exakt dem Muster
  „{deutscher Disziplinname} – Sparring“ entspricht, wird ebenfalls übersetzt.
- Im Plan prüfen: Spalte erlaubt leeren Titel (NOT NULL/CHECK), alte App-Versionen kommen mit
  leerem Titel zurecht. Falls nicht: Titel weiter speichern, aber nur Muster-Erkennung nutzen.

### 1.5 Wächter
Jest-Test durchsucht `src/**/*.ts(x)` außer `src/i18n/locales/`, `src/data/` und Tests nach
Text-Literalen mit Umlauten/ß oder häufigen deutschen Wörtern; Ausnahmeliste (z. B. „Sparr“,
Kommentare). Schlägt bei Treffern fehl.

## Abschnitt 2 – Server (Benachrichtigungen + Push)

Entscheidung: Übersetzung beim Erzeugen auf dem Server (Weg A). Grund: eine Quelle für Texte,
wirkt auch für alte App-Versionen, Liste und Push immer gleich.

### 2.1 Vorlagen
- Tabelle `notification_templates(type text, lang text CHECK in ('de','en'), title text,
  body text, PRIMARY KEY (type, lang))`. RLS an, keine Policies (nur DEFINER-Funktionen lesen).
- Platzhalter `{actor}`, `{sparring}`, `{studio}`, `{event}`, `{plan}` aus `data`.
- Typen: `sparring_signup`, `sparring_signup_cancelled`, `sparring_cancelled`, `event_signup`,
  `studio_join_request`, `studio_join_response` (Vorlagenschlüssel `studio_join_response.approved` /
  `studio_join_response.rejected` nach `data.approved`), `membership_requested`, `membership_confirmed`, `membership_ended`,
  `cancellation_requested`, plus feste Wörter der Chat-Pushes und alle weiteren Typen, die im Plan
  in den Funktionen aus 2.3 gefunden werden.

### 2.2 `notify_user` / `notify_studio_staff`
- Signatur unverändert. Pro Empfänger `profiles.language` (NULL → `de`), Vorlage rendern.
- Fallback: keine Vorlage oder fehlender Platzhalterwert → übergebener `p_title`/`p_body`.
- `notify_studio_staff` rendert je Staff-Mitglied.

### 2.3 Aufrufstellen
Live-Funktionen, die benachrichtigen: `cancel_sparring_signup`, `confirm_membership_end`,
`deactivate_event`, `deactivate_sparring`, `join_sparring`, `notify_event_message`,
`notify_event_signup`, `notify_sparring_group_message`, `promote_sparring_waitlist`,
`request_membership_cancellation`, `request_studio_join`, `respond_membership_request`,
`respond_studio_join`, `sign_membership`, `sparring_notify_safe`,
`trg_sparring_signup_legacy_notify`. Je Funktion: Definition 1:1 aus Prod
(`pg_get_functiondef`) übernehmen, nur `data` um `actor_name`, `sparring_title`,
`sparring_discipline`, `studio_name`, `event_title`, `plan_name` ergänzen (soweit relevant).

### 2.4 Sparringtitel serverseitig
Helfer `sparring_title_for(title, discipline, lang)`: leer oder Muster „{Disziplin} – Sparring“ →
in Empfängersprache bauen (kleine DE/EN-Disziplinliste in SQL, gleich wie Client).

### 2.5 Chat-Pushes
Nachrichteninhalt bleibt unübersetzt; feste Wörter aus Vorlagen.

### 2.6 Backfill
Einmalig nur Benachrichtigungen von Empfängern mit `language = 'en'`: Titel per Typ ersetzen; Body
per festem Regex-Muster je Typ parsen und mit EN-Vorlage neu bauen; kein Treffer → unverändert.

### 2.7 Kompatibilität / Kosten / Doku
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
