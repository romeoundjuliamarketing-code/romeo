# Sparr Instagram Story – Wasser-Reminder
**Format:** 1080 × 1920 px · Instagram Story

---

## Farbpalette

| Token | Hex | Verwendung |
|---|---|---|
| Background | `#F7F5F0` | Gesamthintergrund |
| Text | `#141414` | Headlines, Body |
| Accent Blue | `#4A90D9` | CTA-Button, Highlights |
| Dark | `#0A0A0A` | Subtext, Footer |

**Font:** Inter (Regular 400, SemiBold 600, Bold 700)

---

## Layout – Zone für Zone (von oben nach unten)

### Zone 1 — Top Bar · Y: 0–120px
- **Sparr Logo** (Wortmarke oder Icon), zentriert
- Farbe: `#141414`
- Schrift: Inter Bold, 32px
- Vertikaler Abstand: 48px oben, 40px unten

---

### Zone 2 — Headline · Y: 120–340px
- Großes Headline-Block, zentriert
- **Zeile 1:** „Dein heutiger"
  - Inter SemiBold, 52px, `#141414`, Letterspace –1
- **Zeile 2:** „Wasser-Check"
  - Inter Bold, 64px, `#4A90D9`, Letterspace –2
- Abstand zwischen den Zeilen: 8px

---

### Zone 3 — Maskottchen-Placeholder · Y: 340–980px
- Rechteck: 640 × 640px, zentriert horizontal
- Hintergrundfarbe des Placeholders: `#EEE9DE` (leicht wärmeres Grau auf dem Cream-BG)
- Eckenradius: 24px
- Dashed Border: 2px, `#4A90D9`, Dash-Gap 8/8
- Beschriftung zentriert im Placeholder:
  - „Maskottchen hier" · Inter Regular, 24px, `#4A90D9`
- **→ Du ersetzt diesen Block durch dein Waage.png / Maskottchen-Asset**

---

### Zone 4 — Subtext / Reminder · Y: 1000–1140px
- Zentriert, max. Breite 860px, padding 110px links/rechts
- **Zeile 1:** „Wasser trinken macht dich schneller,"
  - Inter Regular, 32px, `#141414`
- **Zeile 2:** „stärker & fokussierter."
  - Inter SemiBold, 32px, `#4A90D9`
- Zeilenabstand: 12px

---

### Zone 5 — Trennlinie · Y: 1160–1168px
- Horizontale Line: 860px breit, 2px, `#141414`, Opacity 12%
- Zentriert

---

### Zone 6 — Instagram-Poll-Platzhalter · Y: 1188–1420px
> **Hinweis:** Der echte Poll wird nativ in Instagram nach dem Upload hinzugefügt.
> Dieser Block simuliert die Optik im Figma-Entwurf.

- Umrahmtes Rechteck: 860 × 180px, zentriert
- Hintergrund: `#FFFFFF`, Eckenradius 20px
- Border: 1.5px, `#141414`, Opacity 20%
- Schatten: `0 4px 16px rgba(0,0,0,0.06)`

**Innenlayout (vertikal zentriert):**
- Poll-Frage (oben):
  - „Hast du heute genug getrunken?"
  - Inter SemiBold, 26px, `#141414`, zentriert
- Zwei Antwort-Buttons (nebeneinander, je 50% Breite, 16px Gap):
  - **Links:** Pill-Button · Label „Ja" · BG `#4A90D9` · Text `#FFFFFF` · Inter Bold 24px · Höhe 64px · Radius 100px
  - **Rechts:** Pill-Button · Label „Noch nicht" · BG `#F7F5F0` · Border 1.5px `#141414` · Text `#141414` · Inter Bold 24px · Höhe 64px · Radius 100px

---

### Zone 7 — Footer / Branding · Y: 1460–1920px
- Viel Luft (Freiraum für Instagram-UI unten)
- Zentriert, Y: ~1500px:
  - „@sparr.app"
  - Inter Regular, 24px, `#141414`, Opacity 40%

---

## Hintergrund-Detail (optional, subtil)
- Ganz leichte Kreise / Blasen im Hintergrund als Wasser-Metapher
- Farbe: `#4A90D9`, Opacity 4–6%
- Größen: 3–4 Kreise variierend (120px / 200px / 80px Durchmesser)
- Positionen: zufällig verstreut, keiner überlappt die Hauptzonen

---

## Export
- Format: PNG, 1080 × 1920px, @1x
- Dateiname: `sparr_wasser_story_YYYY-MM-DD.png`
- Exportiere ohne Maskottchen-Layer — den fügst du separat in Instagram ein

---

## Instagram-Workflow nach Export
1. Story in Instagram öffnen
2. Exportiertes PNG als Hintergrund hochladen
3. Maskottchen-Sticker / Bild-Layer oben drauflegen (Zone 3)
4. Nativen **Poll-Sticker** platzieren (Zone 6 überschreiben)
   - Frage: „Hast du heute genug getrunken?"
   - Antwort A: „Ja"
   - Antwort B: „Noch nicht"
5. Posten

---

*Erstellt: 2026-05-11 · Sparr Design System v1*
