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
