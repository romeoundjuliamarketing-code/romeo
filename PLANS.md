# Kombat — Produkt-Roadmap & Ideen

## Status: In Entwicklung (Stand April 2026)

---

## Gebaut & aktiv

- **Home Screen** — Streak, Wochendots, heutiges Studio-Training, tägliches Dehnen, Workout-Empfehlung, persönliche Stats
- **Training Screen** — Studio-Stundenplan, Workout-Bibliothek (35+ Workouts, 7 Kategorien), Extras-Sektion
- **Extras** — Joggen, Schwimmen, Seilspringen, Rad Fahren, Schritte, Gym, Sauna — je einmal täglich loggbar, mit Punkten & Wochendots
- **KI Coach (Chat-Tab)** — Fitness-Profil als Balkendiagramm, Chat-Interface
- **Profil** — Avatar, Disziplinen, Team, Gewichtsverlauf, Fitness-Profil, Trainingsverteilung (Donut-Chart), Stats
- **Punkte-System** — Studio-Training, Workouts, Extras, tägliches Dehnen — alle mit Punkten verknüpft
- **Auth & Teams** — Supabase Auth, Studio-Teams, Coach-System (Peer-Vouching)

---

## Geplant: Ernährungsbereich

> Ziel: Einfaches, kampfsport-relevantes Ernährungs-Tracking — kein MyFitnessPal-Klon, sondern fokussiert auf das was Kämpfer wirklich brauchen.

### Phase 1 — Grundlagen (als nächstes bauen)

**Wasser-Tracking**
- Standardziel: 3,15L pro Tag
- Logging in Schritten (z.B. +250ml, +500ml per Tap)
- Visuell: Flasche auf dem Home Screen die sich füllt (animiert)
- Tagesreset um Mitternacht
- 5 Punkte wenn Tagesziel erreicht
- Daten in Supabase speichern (neue Tabelle `water_logs`)

### Phase 2 — Erweiterung (nach Phase 1)

**Mahlzeiten-Templates**
- Vorberechnete Mahlzeiten für typische Kampfsport-Situationen
- Templates: "Trainingstag", "Wettkampftag", "Regenerationstag", "Vor dem Training", "Nach dem Training"
- Kein manuelles Eintippen von Lebensmitteln — einfach Template wählen

**Makro-Überblick**
- Tägliche Protein / Kohlenhydrate / Fett Ziele
- Verknüpft mit Trainingsbelastung (an Trainingstagen höhere Protein-Empfehlung)

### Phase 3 — Ideen (noch nicht entschieden)

- Dynamisches Wasserziel: +500ml wenn an dem Tag Training geloggt wurde
- KI Coach Verknüpfung: Coach sieht Ernährungsdaten und gibt Empfehlungen ("Du hast diese Woche viel trainiert aber wenig getrunken")
- Gewichtsklassen-Assistent: Zielgewicht für Wettkampf + Tagesfortschritt

---

## Offene Ideen (besprochen, noch nicht priorisiert)

- **Monetarisierung**: 30 Tage kostenlos → 4,99 €/Monat oder 39,99 €/Jahr. Premium umfasst KI Coach, vollständige Workout-Bibliothek, Extras mit Punkte-Tracking
- **Maskottchen** weiter einsetzen (Penguin "Coach") — z.B. als Reaktion wenn Ziele erreicht werden
- **Einheit vorschlagen** — Feedback-Funktion in den Extras bereits eingebaut

---

## Technische Entscheidungen (festgelegt)

- React Native + Expo SDK 55, kein Expo Router
- Supabase (Auth, Postgres, Storage, RPCs)
- Design: `#0A0A0A` Hintergrund, `#4A90D9` Akzent, `#F7F5F0` Hell, Inter Font
- Farben nur aus `src/theme/colors.ts`
- Keine Inline-Styles, nur `StyleSheet.create`
- Abstände in Vielfachen von 8px
- Kein `any` in TypeScript
