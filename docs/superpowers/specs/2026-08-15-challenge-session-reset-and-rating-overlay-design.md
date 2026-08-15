# Frischer Start je Sitzung + sichtbares Bewertungs-Overlay — Design

Datum: 2026-08-15
Status: freigegeben, Implementierung offen

Zwei zusammenhängende Änderungen an der Sparrings-Challenge. Sie kommen in eine Spec, weil
beide denselben Hook und denselben Screen betreffen.

---

## Teil 1: Jede Sitzung startet frisch

### Ziel

Beim Öffnen der Challenge liegt das Deck vollständig und verdeckt da. Nichts ist gezogen,
nichts ist als geschafft markiert. Die Ziehreihenfolge ist dadurch bei jedem Öffnen neu.

### Entscheidung

Vom bisher gespeicherten Zustand bleibt **nur die gewählte Disziplin** übrig. Alles andere
lebt nur in der Sitzung.

| Wert | vorher | nachher |
|---|---|---|
| `area` + „wurde gewählt" | gespeichert | **bleibt gespeichert** |
| `drawn` (Ziehhistorie) | gespeichert | nur Sitzung |
| `current` (gezogene Karte) | gespeichert | nur Sitzung |
| `done` (geschafft) | gespeichert | nur Sitzung |
| `draws` (Zähler fürs Overlay) | — | nur Sitzung |

„Sitzung" heisst: solange der Challenge-Screen gemountet ist. Er ist ein Modal-Screen und
wird beim Zurückgehen entfernt — erneutes Öffnen ist damit ein frischer Start.

### Umbau im Hook

`src/hooks/useSparringChallenge.ts` trennt die beiden Ebenen:

```ts
// Nur das hier geht auf die Platte
interface PersistedState { area: ChallengeArea }

// Das hier lebt nur, solange der Screen offen ist
interface SessionState {
  drawn:   Record<ChallengeArea, string[]>;
  current: Record<ChallengeArea, string | null>;
  done:    string[];
  draws:   number;
}
```

- `parseState` liest künftig nur `area` und meldet weiterhin `hadArea`. Ältere Stände
  enthalten zusätzliche Felder — die werden schlicht ignoriert, der Speicherschlüssel
  `sparr.challenge.v1` bleibt. Dadurch behalten bestehende Nutzer ihre Disziplin.
- Geschrieben wird nur noch beim Wechsel der Disziplin.
- `knownIds`/`knownId` werden nicht mehr gebraucht, weil keine Karten-IDs mehr aus dem
  Speicher kommen, und entfallen.
- Die öffentliche Schnittstelle des Hooks bleibt unverändert bis auf `draws: number`.

### Folgen

- Die Statuszeile liest sich beim Öffnen immer „N Karten übrig · 0 geschafft".
- Der Deck-Zustand beim Mount ist immer „keine Karte" — die vorhandene Sonderbehandlung
  für eine aus dem Speicher wiederhergestellte Karte in `ChallengeDeck` wird damit nie
  mehr ausgelöst. Sie bleibt trotzdem stehen: sie schadet nicht und hält die Komponente
  unabhängig davon, woher ihre Karte kommt.

---

## Teil 2: Bewertungs-Overlay beim Ziehen

### Ziel

Die Bewertung soll sichtbarer werden. Zusätzlich zur Zeile nach „Geschafft" erscheint
gelegentlich ein Overlay über dem Bildschirm.

### Entscheidungen

| Frage | Entscheidung |
|---|---|
| Bewertet wird | die **weggelegte** Karte, nicht die neu gezogene |
| Häufigkeit | jede 4. Ziehung der Sitzung |
| Zusätzliche Bedingung | nur, wenn diese Karte noch nicht bewertet wurde |
| Zeile nach „Geschafft" | bleibt unverändert bestehen |

Die weggelegte Karte wird bewertet, weil man sie gelesen hat. Die neue könnte man nicht
beurteilen. Damit kein Zweifel entsteht, **nennt das Overlay die Karte beim Namen**.

### Auslöser

Im Screen, nicht im Hook — der Hook liefert nur `draws`.

Beim Ziehen merkt sich der Screen die Karte, die gerade ersetzt wird. Das Overlay erscheint
**nach** der Ziehanimation: der vorhandene Timer, der die Zieh-Sperre löst
(`DRAW_ANIMATION_MS`), löst auch die Prüfung aus. Während der Drehung erscheint nichts —
sonst konkurrieren Flip und Overlay um die Aufmerksamkeit.

Bedingungen, alle drei müssen zutreffen:

1. es gab eine Vorgängerkarte (nicht die allererste Ziehung),
2. `draws % 4 === 0`,
3. die Vorgängerkarte steht nicht in `ratedIds`.

### Komponente `ChallengeRatingOverlay`

Neu unter `src/components/challenge/`.

```ts
interface Props {
  challenge: SparringChallenge;
  onRate:    (clarity: ClarityValue) => void;
  onSkip:    () => void;
}
```

- `Modal` mit abgedunkeltem Hintergrund (`colors.mapOverlay`) und `onRequestClose = onSkip`,
  damit der Android-Zurück-Knopf nur das Overlay schliesst.
- Inhalt mittig auf einer Fläche in `colors.card`: Überschrift „Kurz gefragt", darunter die
  Frage mit dem Kartennamen, darunter die drei Stufen gross nebeneinander, darunter
  „Überspringen" als dezenter Textknopf.
- Nach der Wahl kurz „Danke" (1,5 s wie in der Zeile), dann schliesst es sich.
- Touchflächen mindestens 44 × 44 pt.

### Gemeinsame Quelle für die drei Stufen

Die Stufen stehen heute in `ChallengeClarityRating.tsx`. Sie wandern nach
`src/components/challenge/clarityLevels.ts` (Typ `ClarityValue`, Array `CLARITY_LEVELS`),
das Zeile und Overlay gemeinsam nutzen. Sonst gäbe es sie zweimal — und der spätere Tausch
gegen Pinguin-Bilder müsste an zwei Stellen passieren statt an einer.

---

## Fehlerfälle

| Fall | Verhalten |
|---|---|
| Gespeicherte Disziplin unlesbar | Auswahl erscheint erneut, Rest ist ohnehin frisch |
| Overlay-Bewertung ohne Netz | Wie bisher: optimistisch angezeigt, bei Fehler zurückgenommen |
| „Überspringen" | Kein Schreibvorgang; erneut gefragt frühestens vier Ziehungen später |
| Deck mit nur einer Karte | Es gibt keine Vorgängerkarte beim ersten Zug, danach greift die 4er-Regel |

## Tests

Keine neue reine Logik, die sich isoliert testen liesse; die Ziehlogik in
`challengeDraw.ts` bleibt unverändert und behält ihre 8 Tests. Verifiziert wird über
`tsc --noEmit`, die bestehende Suite und einen Gerätecheck beider Zustände.

## Nicht enthalten

- Änderungen an Tabelle, RLS oder dem Speicherpfad der Bewertungen
- Änderungen an Ziehlogik, Flip-Animation oder Kartengestaltung
- Eine Möglichkeit, den frischen Start abzuschalten
