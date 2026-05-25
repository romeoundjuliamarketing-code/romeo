# Widget: Interaktive +250ml / +500ml Buttons

Füge interaktive Buttons in das Medium-Widget ein, die Wasser direkt vom
Homescreen hinzufügen. Nutzt iOS 17 App Intents.

Datenfluss: Widget-Button → App Group UserDefaults → Widget refresht sofort.
Beim nächsten App-Öffnen synct useWaterTracking den Unterschied zu Supabase.

Betroffene Dateien:
- `widgets/WaterWidget/WaterWidget.swift`
- `src/hooks/useWaterTracking.ts`

---

## Schritt 1: WaterWidget.swift anpassen

### 1a — Import ergänzen

Füge am Anfang der Datei hinzu (nach `import SwiftUI`):

```swift
import AppIntents
```

### 1b — AddWaterIntent hinzufügen

Füge diesen Block direkt nach den Imports ein, vor `WaterEntry`:

```swift
// MARK: - App Intent

struct AddWaterIntent: AppIntent {
    static var title: LocalizedStringResource = "Wasser hinzufügen"
    static var description = IntentDescription("Fügt Wasser zum Tagesziel hinzu.")

    @Parameter(title: "Menge in ml")
    var amountMl: Int

    init() { self.amountMl = 250 }
    init(amountMl: Int) { self.amountMl = amountMl }

    func perform() async throws -> some IntentResult {
        let appGroup = "group.com.kombat.app"
        guard let defaults = UserDefaults(suiteName: appGroup) else {
            return .result()
        }
        let current = defaults.integer(forKey: "water_amount_ml")
        let goal    = defaults.integer(forKey: "water_goal_ml")
        let goalMl  = goal > 0 ? goal : 3000
        let newAmount = min(current + amountMl, goalMl)

        defaults.set(newAmount, forKey: "water_amount_ml")

        // Track how much was added while app was closed, so the app can sync to Supabase
        let existing = defaults.integer(forKey: "water_pending_sync_ml")
        defaults.set(existing + amountMl, forKey: "water_pending_sync_ml")

        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
```

### 1c — Entry View mit korrektem family-Switch ersetzen

Ersetze den bestehenden `WaterWidget`-Body (die StaticConfiguration closure)
so, dass eine separate EntryView den family-Switch übernimmt.

Füge diese View ein (vor `WaterWidget`):

```swift
// MARK: - Entry View (family switch)

struct WaterWidgetEntryView: View {
    var entry: WaterEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            WaterWidgetSmallView(entry: entry)
        default:
            WaterWidgetMediumView(entry: entry)
        }
    }
}
```

Ändere im `WaterWidget`-Struct die StaticConfiguration closure:

```swift
// Vorher:
StaticConfiguration(kind: kind, provider: WaterProvider()) { entry in
    switch WidgetInfo.family {
    case .systemSmall:
        WaterWidgetSmallView(entry: entry)
    default:
        WaterWidgetMediumView(entry: entry)
    }
}

// Nachher:
StaticConfiguration(kind: kind, provider: WaterProvider()) { entry in
    WaterWidgetEntryView(entry: entry)
}
```

Lösche außerdem den `WidgetInfo`-Helper-Struct (der `static var family` trick
ist kein gültiges SwiftUI-Pattern und wird nicht mehr gebraucht).

### 1d — Buttons in WaterWidgetMediumView ergänzen

Füge in `WaterWidgetMediumView` direkt nach dem Progress-Bar Block
(nach dem `GeometryReader`) diese Button-Row ein:

```swift
// Button row — only visible in medium widget
HStack(spacing: 8) {
    Button(intent: AddWaterIntent(amountMl: 250)) {
        Text("+250 ml")
            .font(.system(size: 12, weight: .medium))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color(red: 0.29, green: 0.56, blue: 0.85).opacity(0.15))
            )
            .foregroundColor(Color(red: 0.29, green: 0.56, blue: 0.85))
    }
    .buttonStyle(.plain)

    Button(intent: AddWaterIntent(amountMl: 500)) {
        Text("+500 ml")
            .font(.system(size: 12, weight: .medium))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color(red: 0.29, green: 0.56, blue: 0.85).opacity(0.15))
            )
            .foregroundColor(Color(red: 0.29, green: 0.56, blue: 0.85))
    }
    .buttonStyle(.plain)
}
.padding(.top, 2)
```

---

## Schritt 2: useWaterTracking.ts — Pending Sync beim App-Öffnen

In `loadTodayWater`, direkt nachdem `setAmountMl`, `setHydrationModeState`
und `setGoalMl` gesetzt wurden (also kurz vor `setLoading(false)`),
füge diesen Block ein:

```ts
// Sync water that was added via the widget while the app was closed
try {
  const rawPending = await SharedGroupPreferences.getItem(
    'water_pending_sync_ml',
    APP_GROUP,
  );
  const pendingMl = typeof rawPending === 'number' && rawPending > 0 ? rawPending : 0;

  if (pendingMl > 0 && user !== null) {
    // The widget already wrote the correct total — use it as source of truth
    const rawWidget = await SharedGroupPreferences.getItem('water_amount_ml', APP_GROUP);
    const widgetTotal =
      typeof rawWidget === 'number' && rawWidget > 0
        ? rawWidget
        : (data?.amount_ml ?? 0) + pendingMl;

    // Only sync if the widget value is higher than what Supabase has
    if (widgetTotal > (data?.amount_ml ?? 0)) {
      await supabase.from('water_logs').upsert(
        { user_id: user.id, date: today, amount_ml: widgetTotal },
        { onConflict: 'user_id,date' },
      );

      // Award goal points if goal was crossed via widget
      const prevAmount = data?.amount_ml ?? 0;
      if (prevAmount < dynamicGoalMl && widgetTotal >= dynamicGoalMl) {
        await supabase.rpc('add_workout_points', {
          p_user_id: user.id,
          p_date: today,
          p_points: WATER_GOAL_POINTS,
        });
        onGoalReached?.();
      }

      if (!cancelled) {
        setAmountMl(widgetTotal);
      }
    }

    // Clear the pending flag regardless
    await SharedGroupPreferences.setItem('water_pending_sync_ml', 0, APP_GROUP);
  }
} catch {
  // Widget sync is best-effort — never block the main flow
}
```

---

## Schritt 3: TypeScript prüfen

```bash
npx tsc --noEmit
```

---

## Schritt 4: Neu bauen

```bash
rm -rf ios && npx expo run:ios
```

---

## Regeln

- Keine Emojis.
- Keine neuen Libraries.
- Keine Änderungen außerhalb der zwei genannten Dateien.
- `any` ist verboten.
- Der Sync-Block ist best-effort — Fehler werden gecatcht und nie nach oben
  propagiert.
