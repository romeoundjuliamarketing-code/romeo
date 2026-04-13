# Training Screen Redesign

**Datum:** 2026-04-13  
**Status:** Approved  
**Ziel:** Trainingsseite als persönlichen Selbstverbesserungs-Hub für Kämpfer neu strukturieren — klare visuelle Hierarchie, richtiger Fokus auf "Workout starten".

---

## Kontext

Die aktuelle Trainingsseite ist eine einzige lange Scroll-Liste ohne visuelle Hierarchie. WeeklyVolumeCard, Heute-Sessions, Stundenplan, Workouts und Extras sind alle gleichgewichtig gestapelt. Die Workouts-Sektion — die wichtigste Aktion auf der Seite — ist das dritte Element in der Reihe.

---

## Neue Struktur

```
TrainingScreen
├── Fixierter Header (scrollt NICHT mit)
│   ├── Heute-Card
│   └── Wochenstats-Zeile
├── Tab-Leiste: [Workouts] [Plan]
└── Tab-Inhalt (scrollbar)
    ├── Tab "Workouts"
    │   ├── Favoriten (nur wenn vorhanden)
    │   ├── Eigene Workouts
    │   ├── Kategorien (Schlagkraft, Ausdauer etc., gefiltert nach Disciplines)
    │   └── Extras (Kondition / Kraft / Regeneration) — Section-Header "Zusatztraining"
    └── Tab "Plan"
        └── StundenplanSection (komplette Woche, editierbar)
```

---

## Fixierter Header

### Heute-Card
- `colors.headerCard`, `borderRadius: 16`, `marginHorizontal: 16`
- **Session vorhanden:** Trainingsname (`fontSize: 17`, `fontWeight: '700'`), Uhrzeit + Dauer + Coach als Metazeile, "Teilnehmen"/"Zugesagt"-Button rechts
- **Keine Session:** Text "Heute kein Studiotraining" + Textverweis "Freies Training starten" → setzt Workouts-Tab aktiv (kein separater Button, nur `onPress`)
- `paddingTop: 0` nach SafeAreaView

### Wochenstats-Zeile
- Kompakte einzeilige Leiste, kein grosser Card-Block
- `marginHorizontal: 16`, `marginTop: 8`
- Drei Werte mit Trennstrichen: `3 Einheiten · 120 Min · 45 Pts`
- `fontSize: 13`, `color: colors.headerTextSecondary` — bewusst unauffälliger als die Heute-Card

---

## Tab-Leiste

- Zwei Pills: **"Workouts"** und **"Plan"**
- Container: `marginHorizontal: 16`, `marginTop: 16`, `flexDirection: 'row'`, `gap: 8`
- Aktiver Tab: `backgroundColor: colors.accentBlue`, weisser Text
- Inaktiver Tab: transparenter Hintergrund, `color: colors.headerTextSecondary`
- Jeder Pill: `flex: 1`, `height: 40`, `borderRadius: 10`

---

## Tab "Workouts"

Akkordeon-Struktur bleibt erhalten. Reihenfolge:
1. Favoriten (nur wenn `favoriteIds.size > 0`)
2. Eigene Workouts
3. Workout-Kategorien (gefiltert nach `disciplines`)
4. Extras (ExtraTab-Inhalt) mit Section-Header "Zusatztraining"

### Visuelles Cleanup der Kategorie-Karten
- **Aktuell:** `borderColor: rgba(74,144,217,0.6)`, `shadowColor: '#4A90D9'`, `shadowOpacity: 0.95` — zu dominant bei 8+ Karten
- **Neu:** `backgroundColor: colors.headerCard`, `borderColor: colors.headerBorder`, kein Shadow
- Workout-Einträge innerhalb der Kategorien: unverändert

---

## Tab "Plan"

- Ausschliesslich `StundenplanSection` — kein weiterer Inhalt
- Coach-Edit-Modus (Stift-Button) bleibt unverändert
- Kein eigener fixierter Header nötig — Heute-Card und Stats sind global fixiert

---

## Implementierungshinweise

- `TrainingScreen` bekommt einen lokalen `activeTab: 'workouts' | 'plan'` State
- Der fixierte Header ersetzt die bisherige `WeeklyVolumeCard` + `TodaySessionCard` Logik
- `ExtraTab` bleibt als Komponente unverändert — wird nur im Workouts-Tab unterhalb der Kategorien eingebettet, mit einem zusätzlichen Section-Header darüber
- `WorkoutCategoryRows` bleibt als Komponente unverändert — Shadow/Border-Cleanup direkt in der Komponente
- Die `StundenplanSection` wird 1:1 in den Plan-Tab übernommen

---

## Nicht in Scope

- Neue Features (empfohlene Workouts, Streak-Anzeige, PR-Tracking) — spätere Iteration
- Änderungen an Workout-Logik, Navigation oder Datenbankstruktur
- Änderungen an ExtraTab, StundenplanSection oder WorkoutCategoryRows Funktionalität
