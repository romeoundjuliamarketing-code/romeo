# Pricing Modell (Stand: 08.04.2026)

Diese Datei zeigt, wie sich die Preise zusammensetzen und welcher Nettoerlös nach Stripe-Gebühren übrig bleibt.

## 1) Preisstruktur

- Einzel monatlich: `11,99 €`
- Einzel jährlich: `99,00 €`
- Studio monatlich: `79,00 €`
- Studio jährlich: `790,00 €`
- Studio enthält: `1 Betreiber + 8 Schüler` (insgesamt 9 Nutzer)

## 2) Annahmen für Gebühren

Berechnung mit Stripe Standard-Kartengebühren (EWR):

- Standardkarte: `1,5 % + 0,25 €`
- Premiumkarte: `1,9 % + 0,25 €`

Hinweis: Das ist nur Stripe. Nicht enthalten sind u. a. MwSt., Supabase-Kosten, Rückerstattungen, Chargebacks, Marketing, App-Store-Provisionen.

## 3) Formel

- `Stripe-Gebühr = (Preis * Prozent) + 0,25`
- `Nettoerlös pro Zahlung = Preis - Stripe-Gebühr`

## 4) Nettoerlös pro Plan

### Einzel monatlich (11,99 €)

- Standardkarte: Gebühr `0,43 €` -> Netto `11,56 €`
- Premiumkarte: Gebühr `0,48 €` -> Netto `11,51 €`

### Einzel jährlich (99,00 €)

- Standardkarte: Gebühr `1,74 €` -> Netto `97,27 €`
- Premiumkarte: Gebühr `2,13 €` -> Netto `96,87 €`
- Effektiv pro Monat netto:
  - Standard: `8,11 €`
  - Premium: `8,07 €`

### Studio monatlich (79,00 €)

- Standardkarte: Gebühr `1,44 €` -> Netto `77,57 €`
- Premiumkarte: Gebühr `1,75 €` -> Netto `77,25 €`
- Effektiv netto pro Nutzer (9 Nutzer):
  - Standard: `8,62 € / Monat`
  - Premium: `8,58 € / Monat`

### Studio jährlich (790,00 €)

- Standardkarte: Gebühr `12,10 €` -> Netto `777,90 €`
- Premiumkarte: Gebühr `15,26 €` -> Netto `774,74 €`
- Effektiv pro Monat netto:
  - Standard: `64,83 €`
  - Premium: `64,56 €`
- Effektiv netto pro Nutzer (9 Nutzer):
  - Standard: `7,20 € / Monat`
  - Premium: `7,17 € / Monat`

## 5) Beispielrechnungen (nur Stripe abgezogen)

### Szenario A: 100x Einzel monatlich (Standardkarten)

- Umsatz: `1.199,00 €`
- Stripe: `42,99 €`
- Nettoerlös: `1.156,01 €`

### Szenario B: 20x Studio monatlich (Standardkarten)

- Umsatz: `1.580,00 €`
- Stripe: `28,70 €`
- Nettoerlös: `1.551,30 €`

## 6) Was ist hier als "Gewinn" zu verstehen?

In dieser Datei ist mit "Gewinn" der **Deckungsbeitrag nach Stripe** gemeint:

- `Deckungsbeitrag = Umsatz - Stripe-Gebühren`

Der echte Unternehmensgewinn ergibt sich erst nach Abzug weiterer Kosten (Infrastruktur, Steuern, Support, Marketing, etc.).
