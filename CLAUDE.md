# Projektregeln

## Emojis
- Keine Emojis in der App – weder in UI-Komponenten, Screens, Buttons, Labels noch in Kommentaren, die als Text angezeigt werden.

## Icons
- Icons werden ausschliesslich über die Bibliothek `@expo/vector-icons` umgesetzt. Keine Emoji-Icons, keine Unicode-Symbole als Icons.

## Designsystem
Immer einhalten:

| Token      | Wert      |
|------------|-----------|
| Hintergrund | `#F3F1EC` |
| Text        | `#2B2F34` |
| Akzent      | `#8C9A8B` |
| Font        | Inter     |
- Keine abweichenden Farben ohne explizite Genehmigung.
- Font `Inter` konsequent verwenden – keine anderen Schriften.
- Farben ausschliesslich aus `src/theme/colors.ts` importieren – keine Hardcoded-Hex-Werte im Code.

## Styling
- Kein Inline-Styling (`style={{ ... }}` direkt im JSX) – immer `StyleSheet.create` verwenden.
- Abstände ausschliesslich in Vielfachen von 8px: `8, 16, 24, 32, 40, 48, ...`

## TypeScript
- Strict-Modus aktiv – `any` ist verboten. Typen immer explizit angeben.

## Sprache
- UI-Texte (Labels, Buttons, Fehlermeldungen, Platzhalter): Deutsch.
- Code-Kommentare: Englisch.

## Komponentenstruktur
- Wiederverwendbare Komponenten gehoeren in `src/components/`.
- Screens, die laenger als 150 Zeilen sind, in kleinere Teilkomponenten aufteilen.

## Tool-Nutzung
- Update TodoWrite only at major milestones (not after every single tool call).
- ALWAYS use Edit for existing files, never Write/overwrite.
- Read files with offset+limit when only a specific section is needed.
- Do NOT write plan files or summaries to disk unless explicitly asked.
- Do NOT spawn sub-agents for simple file reads — use Read and Grep directly.

## Planungspflicht
- Bei Aufgaben, die mehr als 2 Dateien betreffen oder eine neue Feature-Struktur einführen:
  zuerst einen kurzen Implementierungsplan im Chat skizzieren und auf Genehmigung warten,
  bevor Code geschrieben wird.
- Keine Überraschungsarchitektur – Claude entscheidet keine Struktur-Entscheidungen eigenständig.

## Sub-Agents / Task-Tool
- Sub-Agents nur dann spawnen, wenn die Aufgabe wirklich parallelisierbar ist
  (z.B. unabhängige Recherchen).
- Niemals Sub-Agents für einfache Datei-Reads, Grep-Suchen oder einzelne Codeänderungen.
- Kein Agent darf Dateien schreiben, ohne dass der übergeordnete Plan genehmigt wurde.

## Fehlermanagement
- Nach jeder Codeänderung TypeScript-Fehler prüfen (tsc --noEmit) bevor die Aufgabe
  als erledigt gilt.
- Wenn ein Ansatz nach 2 Versuchen nicht funktioniert: stoppen, Problem erklären,
  Alternativen vorschlagen – nicht blind weiterprobieren.
- Niemals funktionierende Logik refactoren, wenn die Aufgabe das nicht explizit verlangt.

## Scope-Disziplin
- Claude aendert ausschliesslich, was explizit angefragt wurde.
- Kein opportunistisches Refactoring, Umbenennen oder "Aufräumen" ohne Auftrag.
- Bestehende Komponenten nicht umstrukturieren, solange die Aufgabe das nicht erfordert.

## Sicherheit
- Keine API-Keys, Tokens oder Secrets im Code – ausschliesslich über .env und
  expo-constants/config.
- .env niemals committen, niemals Inhalte davon in Chat-Antworten ausgeben.

## Tests
- Neue Utility-Funktionen (src/utils/) bekommen einen Unit-Test.
- Test-Dateien liegen neben der Quelldatei: ComponentName.test.tsx.
- Keine Tests für reine UI-Screens – Fokus auf Logik und Hooks.