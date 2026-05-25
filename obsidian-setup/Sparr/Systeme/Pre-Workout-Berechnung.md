# Pre-Workout Berechnung

Dokumentiert wie die personalisierten Zahlen in den Pre-Workout-Notifications berechnet werden.
Grundlage: Sportphysiologie-Wissen, erarbeitet mit Gemini (2026-05-23).

---

## Datenbasis aus `profiles`

| Feld | Verwendung |
|---|---|
| `weight_kg` | Basis für alle Berechnungen |
| `height_cm` | Nicht direkt genutzt (via TDEE in nutritionEngine) |
| `age` | Nicht direkt genutzt (via TDEE in nutritionEngine) |

---

## Berechnungen pro Notification-Slot

### T-4h: Letzte schwere Mahlzeit

Keine personalisierten Zahlen — rein informativer Hinweis.
Inhalt: Fette und Ballaststoffe ab jetzt weglassen.

---

### T-2h: Letzte leichte Mahlzeit

**Kohlenhydrate (Ziel: Glykogenspeicher auffüllen)**
```
carbsGrams = Math.round(weight_kg * 1.2)
```
Basis: 1.0–1.5 g/kg Körpergewicht, Mitte 1.2 g/kg.
Für 80 kg → 96 g Kohlenhydrate.

**Protein (Muskelschutz, anti-kataboler Effekt)**
```
proteinGrams = Math.round(weight_kg * 0.35)
```
Basis: 0.3–0.4 g/kg, Mitte 0.35 g/kg.
Für 80 kg → 28 g Protein.

**Beispiel-Notification-Text (80 kg):**
> "Letzte Mahlzeit jetzt: ~96 g Kohlenhydrate + ~28 g Protein. Z.B. 200 g Reis + 150 g Hühnchen."

---

### T-1h: Koffein + schnelle Carbs + Elektrolyte

**Schnelle Kohlenhydrate (sofort verfügbar, kein Insulincrash)**
```
quickCarbsGrams = Math.round(weight_kg * 0.5)
```
Basis: 0.4–0.6 g/kg, Mitte 0.5 g/kg. Nur schnell verdauliche Quellen (Banane, Reiswaffel, Datteln).
Für 80 kg → 40 g schnelle Carbs (≈ 1 Banane + 1 Reiswaffel).

**Hydration mit Elektrolyten**
```
waterMl = Math.round(weight_kg * 6 / 50) * 50   // auf 50 ml runden
```
Basis: 5–7 ml/kg, Mitte 6 ml/kg. Plus Prise Salz (Natrium hält Wasser im Muskel).
Für 80 kg → 500 ml Wasser mit Prise Salz.

**Beispiel-Notification-Text (80 kg):**
> "Jetzt: ~40 g schnelle Carbs (Banane + Reiswaffel) + 500 ml Wasser mit Prise Salz."

---

### T-30min: Keine Nahrung mehr

Keine personalisierten Zahlen.
Inhalt: Equipment packen, dehnen, mental einstimmen. Kein Essen mehr.

---

## Warum diese Werte

**Glykogen ist der Primärtreibstoff im Kampfsport.**
MMA/Grappling ist glykolytisch — explosive Movements verbrennen fast ausschließlich Kohlenhydrate.
Leere Glykogenspeicher = Einbruch in Runde 3.

**Natrium ist wichtiger als reines Wasser.**
Reines Wasser vor dem Training schwemmt Elektrolyte aus → Krämpfe, niedrigeres Blutvolumen, höherer Puls.
Jedes ml Wasser braucht das passende Natrium um im Muskel zu wirken.

**Kein Fett/Ballaststoffe ab T-4h.**
Verdauung von Fetten leitet Blut in den Magen-Darm-Trakt (Vampir-Effekt).
Beim Grappling drückt Körpergewicht auf den Magen → Übelkeit, Sodbrennen, Atemnot.

**Koffein: ZNS anknipsen, nicht abschießen.**
Blockiert Adenosin, erhöht Dopamin + Adrenalin. Verbessert Reaktionsschnelligkeit und Schlagkraft.
Überdosis → Verkrampfung, hoher Sauerstoffverbrauch, schlechtes Sparring.

---

## Implementierung

Berechnung findet in `src/hooks/useNotifications.ts` statt — beim Schedulen der Notifications,
nachdem das User-Profil aus Supabase geladen wurde.

Hilfsfunktion (intern, kein Export):
```ts
function calcPreWorkoutValues(weightKg: number): {
  carbsGrams: number;
  proteinGrams: number;
  quickCarbsGrams: number;
  waterMl: number;
} {
  return {
    carbsGrams: Math.round(weightKg * 1.2),
    proteinGrams: Math.round(weightKg * 0.35),
    quickCarbsGrams: Math.round(weightKg * 0.5),
    waterMl: Math.round((weightKg * 6) / 50) * 50,
  };
}
```
