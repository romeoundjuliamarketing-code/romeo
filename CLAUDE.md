# CLAUDE.md

Guidance für Claude Code in diesem Repo.

## Website sparrapp.com (eigenes Projekt)

Die Bewertungs-/Landing-Website `sparrapp.com` ist ein **separates Projekt** mit eigenen
Regeln (reines HTML/CSS/JS + PHP auf STRATO, eigene CLAUDE.md). Beide teilen sich nur das
**Supabase-Backend**. Der geteilte Vertrag (Tabellen, RPCs, Policies) ist kanonisch im Vault:
`02 Projekte/Sparr/Supabase-Contract (Shared).md`. **Schema-/RPC-/Policy-Änderungen** hier
immer gegen die Website abgleichen und in der Contract-Note + Dev-Log festhalten. Konkret:
Web-Bewertungen liegen in `venue_web_ratings` / `studio_web_ratings` (nie in den App-Tabellen);
die App liest sie nur für Schnitt+Anzahl (SELECT-Policy `authenticated`).

## Befehle
```bash
npx expo start --ios        # Simulator (kein Expo Go — Dev-Build noetig)
npx expo start --android
npx tsc --noEmit            # nach JEDER Codeaenderung pflicht
npx jest                    # Tests; einzeln: npx jest src/utils/sparringSearch.test.ts
```
Kein separater Build-Schritt, kein Linter.

Test-Setup (`babel.config.js` + `jest.config.js`) ist environment-aware. In Test-Dateien **kein `import type`** (Babel kann das nicht parsen) — stattdessen `as const` auf String-Literale.

## Architektur

**Stack:** React Native + Expo SDK 55 (kein Expo Router — React Navigation), Supabase (Auth/Postgres/Storage/RPCs), TypeScript strict.

**Navigation** (`src/navigation/RootNavigator.tsx`): `AuthStack` ohne Session, sonst `AppStack` → `TabNavigator` (Home/Training/Ernaehrung/Profil) + modale Stacks. Tab-Screens persistent, Rest NativeStack-Modals.

**Datenzugriff:** Kein globaler State-Manager. Dedizierte Hooks in `src/hooks/`, Muster `useXxx(refetchTrigger = 0)` (Zahl aus `useFocusEffect` loest Refetch aus). `refetch`-Callbacks nach Mutationen explizit aufrufen.

**Supabase-Besonderheiten:**
- Typen manuell in `src/types/database.types.ts` (kein codegen).
- Session via `SecureStore` (< 1800 B) bzw. `AsyncStorage` (groessere JWTs) — `src/lib/supabase.ts`.
- Business-Logik (Punkte, Coach, Anwesenheit) in `SECURITY DEFINER` RPCs, nicht im Client.
- Rekursive RLS vermeiden: Subqueries auf dieselbe Tabelle als `SECURITY DEFINER`-Funktion auslagern (z.B. `get_my_studio_id()`).

**Feature-Map** (Details im jeweiligen Code/Test):
- **Entfernt (2026-10-04):** Training/Workouts/Timer, Punkte/XP/Serien, Ernaehrung/Nutrition Engine, Wasser (inkl. iOS-Widget), Montags-Gewicht, Studio-Stundenplan, Coach-Chat, Karten-Boost. Stand davor: Branch `backup/vor-aufraeumen-2026-10-04`. Server-RPCs/Tabellen (`add_/deduct_workout_points`, `mark_/unmark_attendance`, `water_logs`, `weight_logs`) bestehen noch fuer alte App-Versionen.
- **Coach:** Peer-Vouching `coach_nominations`+`coach_votes`; Selbst-Demotion `self_demote_coach`; Selbst-Nominierung clientseitig blockiert.
- **Subscription/Paywall:** `get_my_entitlement()` RPC; Plaene `individual`/`studio`; IAP RevenueCat+StoreKit (iOS, kein Stripe); `PaywallScreen.tsx`; Team via `create_studio_with_owner` (nur studio-Plan).
- **Studio-Einladungscode:** `create_studio_invite`/`accept_studio_invite` RPCs; Hook `useStudioInvite.ts`.
- **Partner-Venues:** Bars/Locations mit Profil (`venues`/`venue_photos`/`venue_ratings`); B2B-Freischaltung serverseitig via `grant_venue_partner(...)` (service_role, kein IAP); Partner-Events gratis via `create_venue_event`; `VenueDetailScreen` rollenbewusst; persistente Map-Marker; „Meine Location"-Einstieg im Profil. Spec/Plan unter `docs/superpowers/`.
- **Mehrsprachigkeit (DE/EN):** i18next, Texte in `src/i18n/locales/de.ts` (Quelle) + `en.ts` (gleiche Struktur, Paritaets-Test). Neue UI-Texte **nur** ueber `t('...')`, Datum nur ueber `formatDate`. Sprache via `useLanguage()`, gespeichert lokal + `profiles.language`. Spec `docs/superpowers/specs/2026-10-06-i18n-design.md`.

**Kritische Fallstricke:**
- **Avatar-Upload:** `expo-file-system` + `base64-arraybuffer` direkt in Storage (`avatars`-Bucket). **Nie** `fetch().blob()` (geht im Expo-Kontext nicht).
- **Maps:** Kein Google Maps (kein Key). iOS `react-native-maps`/Apple Maps (`PROVIDER_DEFAULT`); Android `@maplibre/maplibre-react-native` + OpenFreeMap. Plattform-Split via `.ios.tsx`/`.android.tsx` + TS-Stub `Name.tsx`.
- **Modals/Sheets vs. Navigation (iOS):** RN-`<Modal>` liegt UEBER dem ganzen Navigator. Ein aus einem Sheet heraus aufgerufener Screen (`navigation.navigate`) oeffnet sonst UNTER dem Sheet und ist unsichtbar. Regel: neue Seite muss immer ueber dem aktuellen Inhalt erscheinen — vor `navigate` das Sheet schliessen (State auf `null`, wie `onOpenVenue`/`onOpenChat` in `SparringMapScreen`), oder den Inhalt als Overlay im selben Modal zeigen (wie die Grundregeln im `SparringRulesConsentSheet`). Ein zweites Modal nie als Geschwister eines offenen Modals rendern (iOS zeigt es nicht, der unsichtbare Host blockiert danach alle Touches) — als Kind im offenen Modal rendern oder erst nach dem Schliessen oeffnen.
- **MapLibre Android (v11+):** `<Map>` OHNE `androidView`-Prop rendern (Default `GLSurfaceView` ist stabil). `androidView="texture"` verursacht SIGSEGV-Crashes. Richtig: `<Map mapStyle={MAP_STYLE} style={styles.map}>`

## UI-Performance
Vor Arbeit an Chats, Listen, Animationen, Sheets oder geteiltem State `docs/ui-performance.md` lesen
und die passenden Prüfszenarien durchführen (Umfang nach Änderung: Textänderung = keine).
Kernregeln: Listen virtualisiert + paginiert; Chat-Daten nur über `useChatMessageStream`/`mergeMessages`
(Sortierung `(created_at, id)`); Deps auf `user?.id` statt `user`; Draft-State nicht im Listen-Screen;
zeitkritische Animationen auf dem UI-Thread, kein setState pro Frame. React Compiler ist nicht aktiv.
tsc/jest belegen keine flüssige Darstellung – Laufzeit nur per Release-Build auf Gerät bewerten.
Agenten: Haiku = Fundstellensuche, Sonnet = Umsetzung/Analyse, Opus = schwierige Ursachen/Review (Details in der Datei).

## Android-Pflicht (immer mitbauen)

Wir bauen **immer fuer iOS und Android**. Jede native oder funktionale Aenderung
wird auf beiden Plattformen gebaut und getestet — iOS-Simulator allein reicht nie.
Android ist extrem fragmentiert (verschiedene GPUs/Renderer, OEM-Skins wie
OneUI/MIUI, API-Level, Display-Cutouts, Navigationsmodi), darum zusaetzlich zum
Emulator mindestens ein echtes Geraet testen.

```bash
npx expo run:android                       # lokaler Dev-Build
eas build --platform all --profile preview # beide Plattformen (EAS baut sonst nur eine)
# native Aenderung → zusaetzlich --clear-cache (EAS-Flag; NICHT --no-build-cache)
```

**Damit es auf ALLEN Geraeten laeuft — bei jedem Feature pruefen:**
- **Edge-to-Edge (SDK 55 = Pflicht, nicht abschaltbar):** Inhalt zeichnet unter
  Statusbar + Navigationsleiste. Immer `SafeAreaView`/Insets nutzen, nie feste
  Pixel fuer System-Bars — Statusbar-Hoehen, Punch-Holes und Gesten- vs.
  3-Button-Navigation variieren stark zwischen Geraeten.
- **Renderer/GPU:** MapLibre OHNE `androidView` (siehe oben); gilt analog fuer
  alles GPU-nahe — `texture`/TextureView crasht (SIGSEGV) auf vielen GPUs.
- **Hardware-Back-Button:** Android hat einen, iOS nicht. Modals/Sheets muessen
  den Back-Press abfangen (`BackHandler` bzw. Navigations-`beforeRemove`), sonst
  springt der User unerwartet aus dem Screen. (`predictiveBackGestureEnabled:false`
  ist gesetzt — nur der klassische Back bleibt relevant.)
- **Runtime-Permissions:** Nie als erteilt annehmen. Android 13+ braucht explizit
  POST_NOTIFICATIONS (Push); Standort hat precise/approximate; Kamera einzeln
  anfragen. Permission-Flow auf Geraet durchspielen.
- **Tastatur:** Verhalten weicht von iOS ab — Eingabefelder gegen Verdeckung
  durch die Tastatur testen (scrollbar / nicht verdeckt).
- **Fonts:** Inter muss gebuendelt sein — Android hat sie nicht systemseitig.
- **Release-Minify (R8):** Release-Build kann strippen, was im Debug laeuft. Vor
  jeder Submission einen Release-Build auf einem echten Geraet pruefen.
- **Low-End / OEM-Killer:** Wenig RAM, aggressive Akku-Optimierung (Xiaomi/Samsung
  killen Background-Tasks). Listen/Bilder schlank halten, Push nicht auf
  zuverlaessige Background-Zustellung verlassen.

## Release-Checkliste (vor JEDEM Store-Build/-Upload)

Cloud-Builds kosten Zeit/Kontingent — diese Punkte **lokal** abhaken, bevor `eas build`
laeuft. Jeder Punkt hat schon mal einen Build verbrannt.

**1. Code gruen:**
```bash
npx tsc --noEmit && npx jest
```

**2. expo-doctor 19/19:**
```bash
npx expo-doctor          # muss "No issues detected" sagen
npx expo install --check # Versions-Drift gegen SDK 55 pruefen (--fix zum Angleichen)
```
Bei Bedarf: `@types/jest` auf jest-Major pinnen; Duplikate via `overrides`;
unmaintained/no-metadata-Libs in `expo.doctor.reactNativeDirectoryCheck.exclude`.

**3. `.easignore`-Sanity (EAS nutzt sie STATT `.gitignore` fuers Upload-Archiv):**
Pruefen, dass kein benoetigtes File ausgeschlossen wird — Matching ist
case-insensitiv, native Source-Ordner (`widgets/`) duerfen NIE rausfallen:
```bash
node -e "const f=require('fs'),cp=require('child_process'),ig=require('ignore')().add(f.readFileSync('.easignore','utf8'));const w=cp.execSync('git ls-files',{encoding:'utf8'}).split('\n').filter(Boolean).filter(p=>/^(src|assets|widgets)\//.test(p)&&ig.ignores(p));console.log(w.length?'WRONGLY IGNORED:\n'+w.join('\n'):'ok: 0 wrongly ignored')"
```
Root-Only-Excludes immer mit fuehrendem `/` anchoren (`/COACH/`, nicht `COACH/`).

**4. Versionen hochziehen:**
- `version` in `app.config.js` MUSS hoeher sein als die zuletzt bei Apple
  eingereichte/freigegebene (sonst ITMS-90186/90062, Train geschlossen). Marketing-Version
  ist im Binary eingebacken → Bump = neuer Build noetig.
- `buildNumber`/`versionCode` laufen via EAS remote `autoIncrement`. Bei Android
  „versionCode N already used": neu bauen (auto +1) oder `eas build:version:set`.

**5. Sentry:** `production`-Profil in `eas.json` hat `env.SENTRY_DISABLE_AUTO_UPLOAD: "true"`
ODER ein `SENTRY_AUTH_TOKEN`-EAS-Secret — sonst bricht der Build am `sentry-cli`-Upload ab.

**Externe Voraussetzungen (sonst Submit-Fehler, kein Build-Fehler):**
- **Apple:** aktuelles Program License Agreement als Account Holder akzeptiert (sonst 403).
- **Google Play:** Service-Account hat App-Berechtigungen (Konto-Ebene →
  „Nutzer und Berechtigungen", nicht in der App); erste AAB ggf. einmal manuell hochladen.

# Projektregeln

**Kosten:** Keine Aenderungen, die kostenpflichtige Dienste aktivieren (Supabase Pro, Edge Functions mit externen Calls, bezahlte Drittanbieter). Kostenpflichtige Features nur nach expliziter Bestaetigung.

**Emojis/Icons:** Keine Emojis (UI, Kommentare, Labels). Icons ausschliesslich `@expo/vector-icons` — keine Unicode-Symbole.

**Designsystem** (immer einhalten, Farben nur aus `src/theme/colors.ts`, keine Hardcoded-Hex):

| Token | Wert | colors.ts |
|---|---|---|
| Hintergrund | `#F7F5F0` | `colors.background` |
| Text | `#141414` | `colors.text` |
| Akzent | `#4A90D9` | `colors.accentBlue` |
| Dunkel/Hero | `#0A0A0A` | `colors.dark` |
| Font | Inter | — |

**Styling:** Kein Inline-`style={{}}` — immer `StyleSheet.create`. Abstaende nur in 8px-Vielfachen (8, 16, 24, …).

**Raender/Ecken sauber:** Karten, Sheets und Overlays duerfen an Rundungen und Kanten keine hellen Saeume oder durchscheinenden Flaechen zeigen. Bei Bottom-Sheets liegt die Abdunklung vollflaechig HINTER dem Sheet (Wrapper mit Overlay-Farbe + `justifyContent: 'flex-end'`, Backdrop `absoluteFill`), nicht nur ueber ihm; Kinder mit eigenem Hintergrund in gerundeten Containern per `overflow: 'hidden'` beschneiden. Bei jeder Karte/jedem Sheet die Ecken bewusst pruefen (auch vor hellem Untergrund, z. B. Sheet ueber Sheet).

**TypeScript:** Strict, `any` verboten, Typen explizit.

**Sprache:** UI-Texte Deutsch; Code-Kommentare Englisch; Umlaute **immer** als Ä/Ö/Ü/ä/ö/ü (nie Ae/Oe/Ue).

**Komponentenstruktur:** Wiederverwendbares in `src/components/`. Screens > 150 Zeilen aufteilen.

**Scope-Disziplin:** Nur aendern, was angefragt wurde. Kein opportunistisches Refactoring/Umbenennen/Aufraeumen. Funktionierende Logik nie ohne Auftrag refactoren.

**Funktionalitaet vor Aesthetik:** Erst funktionell bauen (kein Styling/Animation ueber Minimum), Politur nur auf Wunsch.

**Planungspflicht:** Bei > 2 Dateien oder neuer Feature-Struktur zuerst kurzen Plan im Chat skizzieren und auf Genehmigung warten. Keine Ueberraschungsarchitektur.

**Fehlermanagement:** Nach jeder Codeaenderung `tsc --noEmit`. Wenn ein Ansatz nach 2 Versuchen scheitert: stoppen, erklaeren, Alternativen vorschlagen.

**Tool-Nutzung:** TodoWrite nur bei Meilensteinen. Bestehende Dateien immer mit Edit (nie ueberschreiben). Read mit offset+limit fuer Teilbereiche. Keine Plan-/Summary-Dateien auf Disk ohne expliziten Auftrag.

**Sub-Agents / Agenten-Workflow:**
- Kleine, klar umrissene Aenderungen (1–3 Dateien): direkt inline umsetzen — nie Subagenten fuer einzelne Codeaenderungen, einfache Reads oder Greps.
- Subagenten nur bei echt parallelisierbaren, unabhaengigen Recherchen; nur das Ergebnis zurueckgeben.
- Kein Agent schreibt Dateien, ohne dass der uebergeordnete Plan genehmigt wurde.
- `Edit`/`Write` sind in `.claude/settings.local.json` erlaubt, damit ein genehmigter Subagent selbst schreiben kann.

**Sicherheit:** Keine Keys/Secrets im Code — nur via `.env` + expo-constants/config. `.env` nie committen, nie Inhalte im Chat ausgeben.

**Tests:** Neue Utils in `src/utils/` bekommen Unit-Test (neben Quelldatei, `Name.test.tsx`). Keine Tests fuer reine UI-Screens.

## Obsidian Vault
Pfad: `/Users/romeogeorgiadis/Documents/Obsidian Vault/02 Projekte/Sparr/`. Kein MCP — Zugriff per Bash.
**Einzige Detailquelle fuer Struktur/Routing ist `_VAULT_SYSTEM.md` im Vault** — dort steht, was wohin gehoert und wann eine neue Datei angelegt wird. Diese CLAUDE.md-Passage ist nur der Kurz-Pointer; nicht doppelt pflegen.

**Update-Pflicht:** Nach jedem abgeschlossenen Feature / Bugfix / Architektur-/Abo-/App-Store-Schritt den passenden Vault-Eintrag ergaenzen, bevor die Aufgabe erledigt ist. Kadenz **pro Feature/Session, nicht pro einzelner Aenderung** — mehrere kleine Schritte einer Session in einem Eintrag buendeln. Ausnahmen: die unter „Nicht dokumentieren" genannten Faelle oder wenn ich „kein Obsidian" sage.

**Neue Datei vs. append (Faustregel):** Eigenstaendiges, weiterwachsendes Thema → **eigene Datei** (groesseres Feature/Subsystem → `Features/<Name>.md`; echte Architektur-Entscheidung → `Architektur/ADR-NNN-titel.md`; Spec/Konzept → eigene Note). Inkrement zu etwas Dokumentiertem → **append** in die Themendatei. Faustregel: eigenstaendig verlinkbar oder wuerde > ~1 Bildschirm → eigene Datei, sonst append. Kein Wildwuchs, aber sinnvoll verteilen statt alles in einen Monolithen.

**Routing (Kurzform, Details in `_VAULT_SYSTEM.md`):** grosses Feature → `Features/<Name>.md` + Zeile in `Funktionen.md`-Index | kleines Feature/Feature-Aenderung → `Funktionen.md` | Abo/Preis → `Abo-System.md` | App eingereicht → `App-Store.md` | Bug/Tech Debt → `Offene-Punkte.md` | Architektur-Entscheidung → `Architektur/ADR-NNN-titel.md`, kleine Notiz → `Architektur.md`.

**Dev-Log** (`Dev-Log/YYYY-MM-DD.md`, pro Session ein Eintrag, bei zweitem Eintrag/Tag `---`-Trenner):
```markdown
# Dev-Log – YYYY-MM-DD
## Was wurde gebaut / geaendert
## Warum
## Offene Probleme
## Naechste Schritte
```
**Nicht dokumentieren:** Typo-/Format-/Rename-Fixes, verworfener Code, oder wenn ich „kein Obsidian" sage.
