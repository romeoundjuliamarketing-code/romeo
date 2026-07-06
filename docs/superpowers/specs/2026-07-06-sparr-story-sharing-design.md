# Sparr in Story teilbar machen (Web-Landingpage + Deep Links)

**Datum:** 2026-07-06
**Status:** Entwurf zur Freigabe
**Kontext:** Nutzer sollen einen einzelnen Sparr (`open_sparrings`) aus der App heraus in ihrer
Instagram-Story (und in Chats) teilen können. Dafür braucht es eine öffentliche Web-Landingpage
pro Sparr, die man verlinken kann, plus einen sauberen Weg zurück in die App bzw. in den App Store.

---

## Ziele

- **Gleichwertig zwei Zielgruppen bedienen:** App-Nutzer (Sparr beitreten) UND Nicht-Nutzer
  (App laden). Beides ist gleich wichtig.
- **Story-tauglich:** Primär ein gebrandetes Story-Bild, das direkt an Instagram Stories übergeben
  wird; sekundär ein teilbarer Link mit schöner Vorschau für WhatsApp/Telegram/etc.
- **Web = Schaufenster:** Beitreten passiert immer in der App. Kein Web-Login/-Auth.
- **Maximal kostengünstig:** Nur Gratis-Infrastruktur (Vercel Free-Tier, bestehende Supabase-View
  mit Anon-Key, OSS-Libs). Einzige Ausgabe ist die Domain-Registrierung (macht das Team separat).

## Nicht-Ziele (YAGNI)

- Web-Login / Beitreten im Browser
- Web-Kartendetails mit punktgenauem Pin
- Dynamische Server-OG-Bild-Generierung (wir nutzen das in-App erzeugte Story-Bild bzw. ein
  statisches OG-Bild)
- Analytics/Tracking auf der Web-Seite
- Mehrsprachige Web-Seite (nur Deutsch)
- Teilen von `verified_only`-Sparrs

---

## Gesamtarchitektur

Drei getrennte Teile, verbunden über die öffentliche Sparr-ID:

```
App (RN/Expo)                 Supabase                    Web (Next.js/Vercel)
─────────────                 ────────                    ────────────────────
[Sparr teilen]                public_sparrings   ◀──SSR── /s/<id>  (Schaufenster)
  ├─ Story-Bild bauen           (View, anon-read)          ├─ Details + grober Ort
  ├─ IG-Story öffnen            nur aktiv,                  ├─ pro-Sparr OG-Vorschau
  └─ Link teilen                nicht verified_only         └─ "In App öffnen"
        │                                                          │
        └──────────────── Universal/App Link (https://DOMAIN/s/<id>) ┘
                          → App installiert: springt direkt zum Sparr
                          → nicht installiert: bleibt auf Web → App Store
```

**Domain-agnostisch:** Es gibt noch keine Domain. Überall wird ein `DOMAIN`-Platzhalter genutzt und
an einer einzigen zentralen Stelle (Web-Config + `app.config.js`) eingetragen. Registrierung
(~10–15 €/Jahr) erfolgt separat durch das Team.

---

## 1. Datenschicht (Supabase)

Neue **öffentliche View `public_sparrings`** (anon-lesbar), die nur unkritische Felder für
**aktive, nicht-`verified_only`** Sparrs freigibt:

- `id`, `title`, `discipline`, `scheduled_at`, `duration_min`, `max_slots`
- **freie Plätze** = `max_slots` minus Anzahl `sparring_signups`
- **`area_label`** = grober Ort:
  - wenn `is_at_studio` und `studio_id` gesetzt → Studioname
  - sonst → nur Stadt/Bezirk aus `address` abgeleitet (nie die exakte Straße)
- Host-Anzeige: **Vorname + Avatar** (Social Proof) — dieselben öffentlichen Felder, die schon der
  bestehende `PublicProfileScreen` zeigt
- **Keine** `lat`/`lng`-Punktgenauigkeit nach außen

Filterbedingungen der View: `is_active = true` UND `verified_only = false`. (Abgelaufene Sparrs
liefert die View weiterhin, damit die Web-Seite einen sauberen „vorbei"-Zustand zeigen kann — die
Abgelaufen-Prüfung passiert anhand `scheduled_at` im Web, nicht durch Ausblenden in der View. Ob
abgelaufene Sparrs besser komplett ausgeblendet werden, wird beim Implementieren final entschieden;
Default: anzeigen mit „vorbei"-Zustand.)

Web liest ausschließlich diese View mit dem **Anon-Key**. Kein Secret verlässt den Server.

**RLS:** anon `SELECT` nur auf `public_sparrings` erlauben, nicht auf die Basistabelle. Rekursive RLS
vermeiden (Muster `get_my_studio_id()` aus CLAUDE.md beachten, falls Subqueries nötig).

## 2. App-Seite (Teilen-Flow)

Neuer **Teilen-Button** im `SparringDetailSheet` (Referenz-Sheet). Zwei Aktionen:

1. **Primär „In Story teilen":** Eine versteckte, gebrandete **1080×1920**-Card
   (Titel, Disziplin, grober Ort, Datum/Zeit, freie Plätze, Sparr-Logo) wird per
   `react-native-view-shot` zu PNG gerendert und via `react-native-share` direkt an
   **Instagram Stories** übergeben. Nutzer klebt den Link-Sticker (`https://DOMAIN/s/<id>`) manuell
   drauf (Instagram erlaubt kein automatisches Link-Sticker-Setzen). Fallback, wenn Instagram nicht
   installiert / Übergabe scheitert: OS-Share-Sheet mit dem Bild.
2. **Sekundär „Link teilen/kopieren":** OS-Share-Sheet / Clipboard mit der URL
   `https://DOMAIN/s/<id>` — für WhatsApp, Telegram etc.

Neue native Libs: `react-native-view-shot`, `react-native-share`. Beide OSS/gratis, aber native →
**Dev-/EAS-Build** nötig (iOS + Android, bei nativen Änderungen `--no-build-cache`).

**Designsystem:** Story-Card nutzt Farben aus `src/theme/colors.ts` (`#F7F5F0`/`#141414`/`#4A90D9`,
Inter), keine Hardcoded-Hex, keine Emojis, Icons nur `@expo/vector-icons`. Funktion vor Ästhetik:
erst funktional bauen, Politur nur auf Wunsch.

## 3. Web-App (Next.js auf Vercel)

Minimale App, ein sinnvoller Screen.

- **Route `/s/[id]`** (Server-Rendering): holt den Sparr aus `public_sparrings` (Anon-Key), rendert
  Details + groben Ort. Pro-Sparr **OG-Tags** (Titel z.B. „Sparring: Boxen · Berlin · Sa 18:00",
  Beschreibung, Bild) → schöne Vorschau in allen Chat-Apps.
- **„In App öffnen"-Logik** (heikelster UX-Teil):
  - App installiert → Universal/App-Link öffnet die App direkt (Seite wird gar nicht sichtbar).
  - Landet jemand doch im Browser → Button versucht `sparr://s/<id>`; klappt das nicht in
    ~1,5 s → **App-Store-Badges** (iOS/Android, plattformerkannt via User-Agent).
  - Desktop-Besucher → QR-Code zum selben Link + Store-Badges (kein toter Deep-Link).
- **Statuszustände** (UX-relevant):
  - **abgelaufen** (`scheduled_at` vorbei) → „Dieser Sparr ist vorbei" + CTA
  - **voll** (0 Plätze) → Hinweis „ausgebucht", trotzdem App-CTA
  - **nicht gefunden / inaktiv / `verified_only`** (View liefert nichts) → freundliche
    „Dieser Sparr ist nicht mehr verfügbar"-Seite + CTA „App holen / andere Sparrs finden".
    Kein nackter 404.
- **Rechtliches:** Impressum/Datenschutz-Link im Footer (Pflicht in DE für öffentliche Seite) →
  verlinkt die bestehenden Notion-Seiten (Datenschutz-URL wie in `PaywallScreen.tsx`).
- **Sprache:** Deutsch. **Designsystem** gespiegelt (`#F7F5F0`/`#141414`/`#4A90D9`, Inter). Umlaute
  immer als Ä/Ö/Ü.
- `/.well-known/apple-app-site-association` + `/.well-known/assetlinks.json` liefert Vercel aus.

**Repo-Layout:** Web-App als eigener Unterordner (z.B. `web/`) im selben Repo, getrennt vom
Expo-Projekt (eigene `package.json`, eigenes Vercel-Deployment). Muss von `.easignore` sauber
ausgeschlossen werden (Root-Only-Anchor `/web/`), damit sie nicht ins EAS-Upload-Archiv wandert —
aber ohne native Source-Ordner mitzureißen (`.easignore`-Falle aus CLAUDE.md beachten).

## 4. Deep-Linking-Konfiguration (App)

- `app.config.js`:
  - iOS `associatedDomains: ["applinks:DOMAIN"]`
  - Android `intentFilters` (autoVerify) für `https://DOMAIN/s/*`
  - bestehendes `sparr://`-Scheme bleibt
- **React-Navigation Linking-Config** ergänzen: `https://DOMAIN/s/:id` **und** `sparr://s/:id`
  → öffnen `SparringMapScreen`/Detail-Sheet mit der ID. **Kaltstart** (App war zu) und **Warmstart**
  beide behandeln.
- **AASA/assetlinks** brauchen App-IDs (iOS `appID` = TeamID.BundleID) + Android SHA-256-Fingerprint
  (aus EAS-Credentials). Eigener, expliziter Sammel-Schritt im Plan — hier brechen Deep Links sonst
  still.

## 5. Tests

- **Unit (Pflicht, `src/utils/`)** als pure TS-Funktionen extrahiert und getestet (Muster:
  bestehende 62-Test-Engine):
  - `area_label`-Ableitung (Studioname vs. Stadt-Parsing aus Adresse)
  - Share-URL-Bau (`https://DOMAIN/s/<id>`)
  - „Plätze frei"-Berechnung
  - Status-Logik „abgelaufen" / „voll" / „nicht verfügbar"
- **Web:** leichter Render-/Metadaten-Test der `/s/[id]`-Route (Fälle: normal, abgelaufen, voll,
  nicht gefunden).
- **Manuell auf echtem iOS + Android:** Story-Share nach Instagram, Link öffnet App kalt/warm,
  Store-Fallback ohne installierte App, Desktop-QR.

---

## Ausführungsstrategie (Modell-/Kostendisziplin)

- **Planung** mit einem starken Modell (Fable) — saubere, vollständige Schritte.
- **Umsetzung** der mechanischen, klar umrissenen Tasks von günstigeren Modellen (Fable/Sonnet-
  Subagenten); Opus nur für Koordination/Review. Deckt sich mit
  `[[feedback_model_choice]]`.
- Kleine Änderungen (1–3 Dateien) inline, keine Subagenten für einzelne Edits/Reads/Greps.
- Keine kostenpflichtigen Dienste ohne explizite Bestätigung.

## Offene Punkte zur Klärung beim Implementieren

- Endgültige Entscheidung: abgelaufene Sparrs auf der Web-Seite anzeigen (mit „vorbei"-Zustand) vs.
  komplett auf „nicht verfügbar" mappen. Default: anzeigen.
- Genaues Stadt-Parsing der `address` (Format-Annahmen) — Fallback, wenn kein Studio und keine Stadt
  ableitbar: neutrales Label (z.B. „Ort in der App").
- Statisches OG-Standardbild als Fallback, falls kein Story-Bild vorliegt.

## Vault-Pflege

Nach Umsetzung: Eintrag in `Funktionen.md` (neues Feature) + ggf. `Architektur.md`/ADR für die
Web-App-Entscheidung, sowie `API/Endpunkte.md` für die `public_sparrings`-View. Vor dem Update
`_VAULT_SYSTEM.md` lesen, append statt überschreiben.
