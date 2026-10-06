# UI-Performance – Regeln und Prüfszenarien

Kurzregeln stehen in `CLAUDE.md` (Abschnitt „UI-Performance“). Hier stehen die Details. Diese Datei enthält bewusst **keine** Auditberichte.

## Wann was prüfen

| Änderung | Prüfung |
|---|---|
| Text, Farbe, Icon, Abstand | keine Performance-Prüfung |
| Neuer Screen ohne lange Liste | Öffnen/Schließen mehrfach (Szenario 7) |
| Liste, Chat, Realtime-Hook, geteilter State | passende Szenarien 1–6 + Tests für neue Logik |
| Animation, Sheet, Gesten | Szenario 7 + Perf Monitor während der Animation |

`tsc` und `jest` sichern Logik ab (Reihenfolge, Deduplizierung, Scroll-Entscheidungen). Sie sind **kein** Nachweis flüssiger Darstellung. Laufzeit wird nur per Release-Build auf einem echten Gerät bewertet. Messwerte nie schätzen.

## Regeln

**Listen**
- Datenlisten mit `FlatList` und stabilem `keyExtractor` (DB-ID, nie Index). `ScrollView` + `.map` nur für kleine, beschränkte Mengen.
- Keine erfundenen festen Zeilenhöhen (`getItemLayout` nur bei wirklich fixer Höhe). Bilder in Zellen mit festen Abmessungen, damit nichts nachspringt.
- `renderItem` und Zellen-Props stabil halten (`useCallback`, Objekt-Identität erhalten). Zellen gezielt mit `React.memo`, nicht pauschal jede Komponente.

**Chats** (Referenz: `useChatMessageStream`, `src/lib/chatPage.ts`, `src/utils/chatSync.ts`, `src/utils/chatMessages.ts`)
- Invertierte `FlatList` + `maintainVisibleContentPosition`, paginiert mit `CHAT_PAGE_SIZE`. Nie den ganzen Verlauf laden.
- Sortierung und Keyset-Pagination immer über `(created_at, id)`. `now()` ist pro Transaktion gleich, gleiche Zeitstempel kommen also vor.
- Jede Quelle (Seite, Realtime, eigene Insert-Antwort) läuft über `mergeMessages`. Die vorhandene Zeile gewinnt, damit nichts remountet.
- Die erste Seite wird erst nach `SUBSCRIBED` geladen (Fallback nach Timeout). Jeder Re-Join und jede Rückkehr in den Vordergrund holt mehrseitig nach.
- Hook-Abhängigkeiten auf `user?.id`, nie auf `user`: Ein Token-Refresh erzeugt ein neues Objekt. supabase-js reicht den neuen Token selbst an Realtime weiter.
- Asynchrone Ergebnisse gegen die Stream-Instanz prüfen (`dispose`, gecapturte `currentSync()`), damit nichts im falschen Chat landet.
- Kein `scrollToEnd` in `onContentSizeChange`. Nahe am Ende folgt die Liste nativ (`autoscrollToTopThreshold`). Sonst erscheint der Hinweis „Neue Nachrichten“. Eigene Nachrichten werden immer sichtbar gemacht.
- Der Entwurfstext gehört in die Eingabekomponente (`ChatComposer`), nicht in den Screen mit der Liste.

**Animationen**
- Zeitkritisches (Gesten, Sheets, Übergänge) über Reanimated 4 auf dem UI-Thread oder `Animated` mit `useNativeDriver: true` für `transform`/`opacity`.
- `useNativeDriver: false` nur für Layout-Props mit Begründung (kurz, selten, z. B. `WaterBottleCard`-Füllhöhe).
- Kein React-State-Update pro Frame. Timer-Ticks im Sekundentakt sind okay.
- `LayoutAnimation` ist für einmaliges Auf- und Zuklappen erlaubt, nicht während Scrollen oder Gesten.
- Neue Dauer- oder Eingangsanimationen respektieren „Bewegung reduzieren“ (`useReducedMotion()` aus Reanimated).
- Keine Web-Konzepte (`will-change` o. Ä.) auf native Screens übertragen.
- **Ruhezustand ist scharf:** Inhalt mit Text/Bildern (Karten, Sheets) steht nach der Animation ohne Rest-Transform da. Solange `scale`, Sub-Pixel-`translate` oder 3D (`perspective`/`rotateX/Y`) aktiv sind, wird die Ebene gefiltert gezeichnet und wirkt unscharf/verpixelt. Darum: (1) die letzte Phase mit `withTiming` auf den exakten Endwert, nicht mit `withSpring` (Federn pendeln fast eine Sekunde um den Zielwert); (2) 3D-Transforms im Ruhezustand ganz weglassen (`transform: []`), denn auch `perspective` + `rotateY(0deg)` ist keine reine 2D-Matrix; (3) keine Schatten ohne `shadowPath` auf gedrehten Ebenen. Referenz: `ChallengeDeck.tsx`. Federn sind okay für Flächen ohne Inhalt (Stapelkarten, Buttons) oder wenn danach ohnehin nichts gelesen wird.

**Rendering/State**
- Der React Compiler ist **nicht** aktiv (`babel-plugin-react-compiler` installiert, nicht eingeschaltet). Memoisierung also gezielt und manuell.
- Häufig ändernden State (Eingabe, Scrollposition, Timer) möglichst weit unten halten.
- Hintergrund-Refetches erhalten vorhandene Inhalte (Query-Cache / stale-while-revalidate). Kein Spinner über vorhandenen Daten.
- Langsames Netz ≠ blockierter JS-Thread: im Perf Monitor unterscheiden (JS-FPS fällt = Blockade; bleibt hoch = Netz).

## Prüfszenarien (vor/nach der Änderung identisch)

Setup: Release-Build (`eas build --profile preview` oder `npx expo run:ios --configuration Release` / `npx expo run:android --variant release`). Ein aktuelles und ein älteres Android-Gerät, dazu ein iPhone. Zwei Test-Accounts im selben Chat, einer mit mindestens 150 Nachrichten.

1. **Langer Chat, schnelles Scrollen:** öffnen → startet unten ohne sichtbares Nachscrollen. Schnell nach oben und unten flicken: keine weißen Lücken, keine Sprünge.
2. **Ältere Nachrichten:** bis ganz nach oben scrollen → Spinner oben, neue Seite erscheint, die gelesene Nachricht bleibt an Ort und Stelle. Am Anfang des Verlaufs kein weiterer Spinner.
3. **Empfang beim Scrollen:** oben lesen, zweiter Account sendet → keine Bewegung, Hinweis „Neue Nachrichten“. Tap → nach unten. Unten stehend → die Liste folgt.
4. **Tippen + Senden bei Eingang:** tippen, während der zweite Account mehrere Nachrichten schickt → Eingabe verzögert nicht, Reihenfolge stimmt, keine Duplikate. Eigene Nachricht senden, während oben gelesen wird → springt nach unten.
5. **Tastatur:** öffnen/schließen, auch mit mehrzeiliger Eingabe → letzte Nachricht bleibt sichtbar, das Eingabefeld wird nicht verdeckt (Android: Gesten- und 3-Button-Navigation).
6. **Bilder + langsames Netz:** Bildnachrichten bei gedrosseltem Netz → Zeilenhöhe springt nicht. **Wiederverbindung:** Flugmodus 30 s, der zweite Account sendet mehr als 50 Nachrichten, Flugmodus aus bzw. App in den Vordergrund → alle Nachrichten da, lückenlos, ohne Duplikate.
7. **Screens/Modals:** Chat, Sheets und Modals 10× öffnen/schließen → keine Verzögerung, die zunimmt (Leck-Hinweis). Hardware-Back (Android) schließt korrekt.

Werkzeuge:
- Perf Monitor (Dev-Menü): JS- und UI-FPS, auf **einzelne Einbrüche** achten, nicht nur auf den Durchschnitt.
- Android: `adb shell dumpsys gfxinfo <package> reset`, Szenario durchspielen, dann `adb shell dumpsys gfxinfo <package> framestats` (Janky frames, 90./99. Perzentil).
- iOS: Instruments → „Animation Hitches“ / Time Profiler.
- Langsames Netz: iOS Network Link Conditioner, Android-Emulator Extended Controls → Cellular → EDGE.

## Modelle und Agenten (wirtschaftlich)

- **Klein (1–3 Dateien, klare Ursache):** direkt inline, kein Subagent.
- **Haiku** (`Explore`, `model: haiku`): eng begrenzte Fundstellensuche/Bestandsaufnahme mit festem Ergebnisformat. Nie Architekturentscheidung oder Freigabe.
- **Sonnet:** reguläre Ursachenanalyse, Implementierung klar umrissener Tasks, gezielte Prüfung.
- **Opus:** bereichsübergreifende oder mit dem bisherigen Ansatz ungeklärte Ursachen, Koordination, Abschlussreview.
- Modell beim Delegieren ausdrücklich setzen. Nur nötigen Kontext und Dateibereich übergeben. Rückgabe: Fundstelle, Beobachtung, Beleg, Unsicherheit, Empfehlung.
- Befunde vor jeder Änderung im Code verifizieren. Keine parallelen Edits derselben Datei, keine rekursiven Agententeams, keine wiederholten Voll-Audits.
