# Sparr Cockpit — Live-Dashboard (Design)

Datum: 2026-07-06
Status: genehmigt (Design), Umsetzung folgt

## Ziel
Ein „stets aktuelles" Gruender-Cockpit fuer die Sparr-App: eine feste, gehostete
claude.ai-Artifact-URL, die jeden Morgen automatisch mit frischen Live-Zahlen aus
Supabase + Repo-Status neu befuellt wird.

## Nicht-Ziele (YAGNI)
- Kein sekundengenaues Live-Polling (Artifact-CSP verbietet externe Calls).
- Keine Pro-Studio-Aufschluesselung (Scope: global ueber die ganze App).
- Keine Schreibzugriffe auf die DB. Rein lesend.

## Datenfluss
```
Taeglicher Cloud-Agent (Routine, morgens)
  1. Supabase-MCP: KPI- + 7-Tage-Trend-Queries (execute_sql, read-only)
  2. Git/Repo: Branch, App-Version (app.config.js), letzte 5 Commits, git status
  3. Template-Tokens in dashboard/sparr-cockpit.template.html ersetzen
  4. Artifact-Deploy auf DIESELBE URL (url-Param) → immer die letzte Version
```
„Aktuell" = Stand des letzten Laufs (taeglich morgens). Footer zeigt Zeitstempel.

## Dashboard-Inhalt (global, aus echten Feldern)
Alle Zahlen aus `public`-Schema, Supabase-Projekt `lkgrnuwtnifnmghthbog`.

| Block | Kennzahlen | Quelle |
|---|---|---|
| Nutzer | Gesamt, neu heute, neu 7T, 14-Tage-Sparkline | profiles.created_at |
| Sparrings (Kern) | Offen gesamt, neu 7T, kommende (Zukunft), Anmeldungen gesamt, aktive Chats | open_sparrings, sparring_signups, sparring_chat_settings |
| Aktivitaet | Workouts 7T, Weight-Logs 7T, Water-Logs 7T, Notifications 7T | workout_logs.date, weight_logs, water_logs, notifications.created_at |
| Studios & Venues | Studios, Venues, Events, kommende Events, Trial-Bookings, Memberships, aktive Subs | studios, venues, events, trial_bookings, studio_memberships, subscriptions |
| Dev/Repo | Branch, App-Version, letzte 5 Commits, offener Git-Status | git, app.config.js |
| Footer | „Zuletzt aktualisiert: <ts>" + Hinweis auf taeglichen Lauf | Laufzeit |

## Darstellung
- Strikeforce-Designsystem: bg `#F7F5F0`, Text `#141414`, Akzent `#4A90D9`, Hero `#0A0A0A`, Inter.
- Keine Emojis. KPI-Kacheln + einfache Inline-SVG-Sparklines (kein externes JS/CDN — CSP).
- Light/Dark-aware (prefers-color-scheme + data-theme).
- Voll self-contained (Inline-CSS/JS/SVG), responsive, horizontale Overflows scrollbar.
- Skills: `dataviz` (Kacheln/Sparklines/Farben) + `artifact-design` (Kalibrierung) vor dem Bauen laden.

## Reproduzierbarkeit
- `dashboard/sparr-cockpit.template.html`: committet, enthaelt `{{TOKEN}}`-Platzhalter.
- Routine-Prompt (via /schedule): enthaelt exakte SQL + Git-Schritte + Token-Mapping + Deploy-URL.
- So bleibt das Design ueber alle Laeufe stabil (kein Neu-Erfinden pro Tag).

## Aufbau-Reihenfolge
1. Template + Queries bauen, **einmal jetzt** manuell deployen → echte Live-URL validieren.
2. Danach die taegliche Routine einrichten (via /schedule) mit dieser URL.
3. Cloud-Agent-Testlauf: prueft, ob Routine Supabase-MCP + Artifact-Zugriff hat.

## Risiko / Fallback
Falls der Cloud-Agent im Routine-Env KEINEN Supabase-MCP-Zugriff hat, ist der
Auto-Refresh nicht moeglich. Fallback: taeglicher Kurz-Report per Telegram statt
Artifact-Redeploy, oder manueller Refresh auf Zuruf. Wird beim Testlauf geklaert.

## Kosten
Ein Cloud-Agent-Lauf pro Tag (Kontingent). Keine kostenpflichtigen Dienste aktiviert.
