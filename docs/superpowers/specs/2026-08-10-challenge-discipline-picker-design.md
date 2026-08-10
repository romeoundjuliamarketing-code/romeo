# Disziplin einmalig wählen, grössere Karten — Design

Datum: 2026-08-10
Status: freigegeben, Implementierung offen

## Ziel

Die Disziplin wird einmal am Anfang gewählt statt dauerhaft als Segmentcontrol angezeigt.
Der frei werdende Platz geht in die Kartengrösse.

## Ausgangslage

Die Karte ist heute 306 × 437 pt. Begrenzt wird sie fast gleichauf von zwei Seiten:
Breite (78 % von 402 = 313) und Höhe (874 × 0,5 × 0,7 = 306). **Platz allein freiräumen
bringt darum fast nichts** — die Breitenbegrenzung greift sofort. Für spürbar grössere
Karten müssen beide Grenzen steigen.

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| Auswahl erscheint | Nur beim allerersten Öffnen; danach nie wieder von allein |
| Wechseln | Kleiner Knopf rechts in der Kopfzeile, zeigt die aktive Disziplin |
| Kartengrösse | 86 % Breite, Deckel 344 pt, Höhenanteil 56 % |

## Hook

`src/hooks/useSparringChallenge.ts` legt offen, ob je bewusst gewählt wurde.

`areaChosen` ist heute ein `useRef`, das aus `parseState().hadArea` gesetzt und in `setArea`
auf `true` gezogen wird. Es wird zu `useState`, damit der Screen darauf reagieren kann, und
kommt als `areaChosen: boolean` ins Ergebnis.

Der Effekt, der die Disziplin aus dem Profil vorwählt, prüft `areaChosen` weiterhin als
Abbruchbedingung. Wechselt der Wert auf `true`, läuft der Effekt einmal zusätzlich und
kehrt sofort zurück — unkritisch.

## Screen

`SparringChallengeScreen` bekommt drei Zustände:

1. `loading` — Spinner, unverändert
2. `!areaChosen` — die Auswahl statt des Decks, ohne Abbrechen: es muss gewählt werden
3. sonst — das Deck wie bisher, ohne Segmentcontrol

Zusätzlich ein lokaler Zustand `pickerVisible` für das erneute Wählen über den Kopfzeilen-Knopf.

## Komponente `ChallengeAreaPicker`

Neu unter `src/components/challenge/`.

```ts
interface Props {
  current:  ChallengeArea;              // hervorgehoben
  onSelect: (area: ChallengeArea) => void;
  onClose?: () => void;                 // gesetzt → als Overlay mit Schliessen
}
```

- Ohne `onClose` rendert die Komponente inline (Erstauswahl, kein Abbruch möglich).
- Mit `onClose` rendert sie in einem `Modal` mit `onRequestClose`, damit der
  Android-Zurück-Knopf das Overlay schliesst statt den Screen zu verlassen.
- Überschrift „Für welche Disziplin willst du Karten?", darunter die drei Bereiche aus
  `CHALLENGE_AREAS` als grosse Zeilen mit Kartenanzahl. Die aktive ist in `accentBlue`
  hervorgehoben.
- Touchflächen mindestens 44 pt hoch.

## Kopfzeile

`ChallengeHeader` bekommt einen optionalen rechten Slot:

```ts
right?: React.ReactNode;
```

Ohne `right` bleibt der heutige 44-pt-Platzhalter stehen, der den Titel mittig hält — das
ist bewusst eine Verallgemeinerung des vorhandenen Platzhalters, kein Sonderfall daneben.

Im Challenge-Screen sitzt dort ein Knopf: Label der aktiven Disziplin plus
`chevron-down`, `accessibilityLabel` „Disziplin ändern". Er kostet keine zusätzliche Höhe.

## Kartengrösse

In `src/components/challenge/cardLayout.ts`:

| Wert | vorher | nachher |
|---|---|---|
| Breitenanteil | 0.78 | 0.86 |
| `MAX_CARD_WIDTH` | 316 | 344 |
| `maxHeightFraction` (Default) | 0.5 | 0.56 |

Ergebnis iPhone 17 (402 × 874): 343 × 490 statt 306 × 437.
Ergebnis iPhone SE (375 × 667): 261 × 373 — dort greift weiter die Höhenbegrenzung,
nichts wird abgeschnitten, die Karte wächst nur weniger.

Der Kartenbrowser ruft `useCardSize(0.58)` und wächst dadurch ebenfalls leicht mit.

## Entfällt

`src/components/challenge/ChallengeAreaTabs.tsx` wird von niemandem mehr verwendet und
wird gelöscht, statt als toter Code liegenzubleiben.

## Fehlerfälle

| Fall | Verhalten |
|---|---|
| Gespeicherte Wahl unlesbar | `areaChosen` ist `false`, die Auswahl erscheint erneut |
| Bereich ohne Karten gewählt | Deck zeigt den vorhandenen Leerzustand, Ziehen deaktiviert |
| Overlay auf Android mit Zurück | `onRequestClose` schliesst nur das Overlay |

## Nicht enthalten

- Mehrere Disziplinen gleichzeitig
- Änderung der Ziehlogik, der Animation oder der Bewertung
- Änderungen an anderen Bereichen der App
