# Sparrings-Challenge — Design

Datum: 2026-08-06
Status: freigegeben, Implementierung offen

## Ziel

Im Trainingsbereich ein neuer, deutlich erkennbarer Einstieg „Sparrings-Challenge". Er führt
auf einen eigenen Screen, auf dem sich der Nutzer eine Challenge-Karte für sein nächstes
Sparring zieht. Die Karten liegen in drei Bereichen vor: Boxen, Kickboxen, MMA (Striking).
Insgesamt sind 100 Karten vorgesehen; die Inhalte liefert der Auftraggeber, dieses Design
umfasst ausschliesslich Struktur und UI.

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| Zugang zur Karte | Zufallsziehung mit Flip-Animation, zusätzlich Blättern durch alle Karten |
| Persistenz | Lokal via AsyncStorage — kein Supabase, keine Migration, keine laufenden Kosten |
| Kopplung an Sparring-Termine | Keine — der Screen steht eigenständig |
| Bereichswahl | Drei Pills über dem Deck, vorausgewählt aus den Profil-Disziplinen |

## Datenmodell

Neue Datei `src/data/sparringChallenges.ts`, Machart analog `src/data/workouts.ts`:

```ts
export type ChallengeArea = 'boxen' | 'kickboxen' | 'mma';

export interface SparringChallenge {
  id:          string;   // 'box-01'
  area:        ChallengeArea;
  title:       string;   // gross auf der Karte
  instruction: string;   // was in diesem Sparring zu tun ist
  focus:       string;   // kleines Label, z.B. 'Defensive'
  difficulty:  'leicht' | 'mittel' | 'schwer';
}

export const SPARRING_CHALLENGES: SparringChallenge[];
export function challengesForArea(area: ChallengeArea): SparringChallenge[];
```

`ChallengeArea` ist bewusst eigenständig und **nicht** an `Discipline` aus
`src/data/disciplines.ts` gekoppelt: dort existieren sechs Werte inklusive BJJ und Wrestling,
die als Striking-Challenges nicht vorkommen. Eine einmalige Zuordnung mappt die Profilwerte
`Boxen`/`Kickboxen`/`MMA` auf den Bereich; alles andere fällt auf `boxen` zurück.

Die Datei enthält vorerst pro Bereich zwei bis drei Einträge, die im Titel klar als
`Platzhalter` gekennzeichnet sind — nur damit das UI lauffähig und testbar ist. Es werden
keine Challenge-Inhalte erfunden. Die späteren 100 Karten ersetzen die Platzhalter ohne
Codeänderung.

## Ziehlogik

Neue Datei `src/utils/challengeDraw.ts` mit Unit-Test `challengeDraw.test.ts` daneben
(Pflicht laut CLAUDE.md für Utils).

```ts
export function drawChallenge(
  pool:       SparringChallenge[],
  drawnIds:   string[],
  random:     () => number,
): { card: SparringChallenge; drawnIds: string[] } | null;
```

Verhalten:

- Zieht zufällig aus den Karten des Pools, die noch nicht in `drawnIds` stehen.
- Sind alle Karten des Pools gezogen, wird `drawnIds` für diesen Pool zurückgesetzt und
  neu gezogen. „Keine Karte mehr" tritt dadurch nie auf.
- Ist der Pool leer, wird `null` zurückgegeben (Leerzustand im UI).
- Die Zufallsquelle wird injiziert, damit der Test deterministisch ist.

Bei einem Reset wird — sofern der Pool mehr als eine Karte hat — die zuletzt gezogene Karte
von der unmittelbar folgenden Ziehung ausgeschlossen, damit nach dem Durchlauf nicht
zweimal dieselbe Karte hintereinander erscheint.

## Persistenz

Neuer Hook `src/hooks/useSparringChallenge.ts`, AsyncStorage-Key `sparr.challenge.v1`:

```ts
type StoredState = {
  area:    ChallengeArea;                        // zuletzt gewählter Bereich
  drawn:   Record<ChallengeArea, string[]>;      // bereits gezogene IDs je Bereich
  current: Record<ChallengeArea, string | null>; // zuletzt gezogene Karte je Bereich
  done:    string[];                             // als erledigt markierte IDs
};
```

Hook-API: `{ area, setArea, current, draw, markDone, isDone, doneIds, loading }`.

- Beim ersten Laden wird `area` aus dem gespeicherten Zustand übernommen; existiert keiner,
  aus den Profil-Disziplinen abgeleitet.
- Schreibvorgänge laufen feuernd im Hintergrund; der State im Speicher ist führend, damit
  das UI nicht auf die Platte wartet.
- Unbekannte oder beschädigte Werte aus dem Storage werden verworfen und durch den
  Anfangszustand ersetzt, statt einen Fehler zu werfen.
- IDs, die im Storage stehen aber nicht mehr in den Daten existieren (weil Platzhalter durch
  die echten 100 Karten ersetzt wurden), werden beim Laden herausgefiltert.

## UI

### Einstieg im Trainingsbereich

In `TrainingScreen.tsx`, im Tab „Workouts" direkt unter „Workout starten": eine eigene Karte,
bewusst anders als der blaue Primärbutton, damit die bestehende Hauptaktion nicht verwässert
wird. Dunkle Kartenfläche mit Akzentrand (`colors.accentBlue`), Icon aus `@expo/vector-icons`,
Titel „Sparrings-Challenge", darunter „Zieh deine Karte fürs nächste Sparring", rechts ein
Chevron.

### Screen

Neue Route `SparringChallenge` (ohne Parameter) in `RootStackParamList`, registriert im
`AppStack` als Modal-Screen. `SparringChallengeScreen.tsx` orchestriert nur; die Arbeit
erledigen Komponenten unter `src/components/challenge/`:

- `ChallengeAreaTabs` — drei Pills (Boxen / Kickboxen / MMA), Optik wie die vorhandene
  Tab-Leiste im TrainingScreen.
- `ChallengeCard` — die Kartenfläche selbst; wiederverwendet beim Ziehen und beim Blättern.
  Zeigt Bereich, Fokus-Label, Titel, Anweisung, Schwierigkeit.
- `ChallengeDeck` — Stapel aus drei versetzten Kartenrücken, führt Abheben und Flip aus.
- `ChallengeBrowser` — Vollbild-Modal, horizontal gepagte Liste über alle Karten des
  aktiven Bereichs.

Aufbau des Screens von oben nach unten: Kopfzeile mit Zurück und Titel, Bereichs-Pills,
Deck beziehungsweise gezogene Karte, Zähler „N Karten", Primäraktion „Karte ziehen",
sekundär „Alle Karten ansehen".

### Animationen

Reanimated 4 ist im Projekt vorhanden und wird bereits für Bottom-Sheets genutzt.

- Der Stapel liegt leicht versetzt und rotiert, die Karten darunter etwas kleiner.
- Beim Ziehen hebt die oberste Karte ab (`translateY` + `scale`, Spring), dreht sich per
  `rotateY` vom Rücken auf die Vorderseite und setzt sich mittig.
- Der Flip nutzt zwei absolut positionierte Flächen, deren Sichtbarkeit über den
  Rotationswert geschaltet wird — `backfaceVisibility` ist auf Android unzuverlässig.
- Erneutes Ziehen schiebt die aktuelle Karte seitlich weg, bevor die neue kommt.
- „Erledigt" gibt ein kurzes Scale-Feedback.
- Im Browser skalieren Nachbarkarten leicht herunter.

### Plattform

- Der Screen ist ein NativeStack-Screen, der Hardware-Back auf Android greift dadurch von
  selbst. Der Browser läuft als `Modal` mit `onRequestClose`, damit Back das Overlay schliesst
  statt den Screen zu verlassen.
- `SafeAreaView`/Insets statt fester Pixelwerte für System-Bars.
- Farben ausschliesslich aus `src/theme/colors.ts`, Abstände in 8er-Schritten, kein
  Inline-`style`, keine Emojis, Icons nur aus `@expo/vector-icons`.

## Fehlerfälle

| Fall | Verhalten |
|---|---|
| Bereich enthält keine Karten | Leerzustand auf dem Deck, „Karte ziehen" deaktiviert |
| AsyncStorage nicht lesbar | Anfangszustand, Feature bleibt benutzbar |
| Gespeicherte ID nicht mehr vorhanden | Wird beim Laden verworfen |
| Alle Karten eines Bereichs gezogen | Bereich wird zurückgesetzt, Ziehen läuft weiter |

## Tests

- `src/utils/challengeDraw.test.ts`: zieht nur ungezogene Karten, setzt bei erschöpftem Pool
  zurück, vermeidet direkte Wiederholung, gibt bei leerem Pool `null`.
- Keine Tests für die reinen UI-Komponenten (Projektregel).

## Umfang

Neue Dateien: `src/data/sparringChallenges.ts`, `src/utils/challengeDraw.ts` (+ Test),
`src/hooks/useSparringChallenge.ts`, `src/screens/SparringChallengeScreen.tsx`,
`src/components/challenge/ChallengeAreaTabs.tsx`, `ChallengeCard.tsx`, `ChallengeDeck.tsx`,
`ChallengeBrowser.tsx`.

Geänderte Dateien: `src/screens/TrainingScreen.tsx`, `src/navigation/types.ts`,
`src/navigation/RootNavigator.tsx`.

Kein Backend, keine Migration, kein neues Package, keine kostenpflichtigen Dienste.

## Bewusst nicht enthalten

- Kopplung an konkrete Sparring-Termine oder Gruppenchats
- Punkte/XP für erledigte Challenges
- Gerätübergreifende Synchronisation
- Teilen einer Karte nach aussen
