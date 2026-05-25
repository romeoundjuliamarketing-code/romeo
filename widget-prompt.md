# iOS Home Screen Widget – Wassertracking

Baue ein iOS Home Screen Widget (Small + Medium) für das Wassertracking.
Das Widget liest Daten aus einem shared App Group UserDefaults Container,
den die App nach jedem Wasser-Update beschreibt.

---

## Betroffene Dateien

1. `package.json` — 2 neue Pakete installieren
2. `app.json` → umbenennen + umwandeln in `app.config.js`
3. `src/hooks/useWaterTracking.ts` — nach jedem `addWater` in SharedGroupPreferences schreiben
4. `targets/water-widget/WaterWidget.swift` — neue Datei, SwiftUI Widget
5. `targets/water-widget/Info.plist` — neue Datei, Widget Extension Plist

Kein anderer Code wird angefasst.

---

## Schritt 1: Pakete installieren

```bash
npx expo install react-native-widget-extension
npx expo install react-native-shared-group-preferences
```

---

## Schritt 2: app.json → app.config.js

Lösche `app.json`. Erstelle `app.config.js` mit exakt diesem Inhalt
(alle bisherigen Felder aus app.json übernehmen, nur das Format ändern
und die neuen Einträge ergänzen):

```js
module.exports = {
  expo: {
    name: "Sparr",
    slug: "sparr",
    scheme: "sparr",
    version: "1.0.5",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0A0A0A",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.kombat.app",
      requireFullScreen: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription:
          "Sparr zeigt dir Sparring-Partner in deiner Nähe.",
      },
      // App Group – shared container between app and widget
      entitlements: {
        "com.apple.security.application-groups": ["group.com.kombat.app"],
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    assetBundlePatterns: ["assets/**"],
    plugins: [
      "expo-secure-store",
      "@react-native-community/datetimepicker",
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Sparr zeigt dir Sparring-Partner in deiner Nähe.",
        },
      ],
      [
        "react-native-widget-extension",
        {
          // folder that holds the Swift widget files
          targetName: "WaterWidget",
          bundleIdentifier: "com.kombat.app.WaterWidget",
          deploymentTarget: "16.0",
          appGroupIdentifier: "group.com.kombat.app",
          entitlements: {
            "com.apple.security.application-groups": ["group.com.kombat.app"],
          },
        },
      ],
    ],
    extra: {
      eas: {
        projectId: "9811826e-5835-47ff-9c96-8fb7a14cdab3",
      },
    },
  },
};
```

---

## Schritt 3: useWaterTracking.ts erweitern

Füge am Anfang der Datei diesen Import hinzu (nach den bestehenden Imports):

```ts
import SharedGroupPreferences from 'react-native-shared-group-preferences';
```

Füge diese Hilfsfunktion direkt nach den Konstanten ein
(nach `const WATER_GOAL_POINTS = 5;`):

```ts
const APP_GROUP = 'group.com.kombat.app';

async function syncToWidget(amountMl: number, goalMl: number): Promise<void> {
  // Write current water state to the shared App Group container.
  // The iOS widget reads from this same container.
  try {
    await SharedGroupPreferences.setItem('water_amount_ml', amountMl, APP_GROUP);
    await SharedGroupPreferences.setItem('water_goal_ml', goalMl, APP_GROUP);
    await SharedGroupPreferences.setItem(
      'water_date',
      new Date().toISOString().split('T')[0],
      APP_GROUP,
    );
  } catch {
    // Widget sync is best-effort — never block the main flow
  }
}
```

Am Ende der `addWater` Funktion, direkt vor `setLoading(false)`,
füge diesen Aufruf ein:

```ts
await syncToWidget(nextAmount, goalMl);
```

Außerdem: Am Ende von `loadTodayWater`, direkt nachdem `setAmountMl`,
`setHydrationModeState` und `setGoalMl` gesetzt wurden, füge ein:

```ts
void syncToWidget(data?.amount_ml ?? 0, dynamicGoalMl);
```

Das sorgt dafür, dass das Widget auch beim App-Start auf den aktuellen
Stand gebracht wird, nicht nur nach dem Hinzufügen von Wasser.

---

## Schritt 4: Widget Swift-Datei erstellen

Erstelle den Ordner `targets/WaterWidget/` und darin die Datei
`targets/WaterWidget/WaterWidget.swift` mit diesem Inhalt:

```swift
import WidgetKit
import SwiftUI

// MARK: - Data model

struct WaterEntry: TimelineEntry {
    let date: Date
    let amountMl: Int
    let goalMl: Int

    var progress: Double {
        guard goalMl > 0 else { return 0 }
        return min(Double(amountMl) / Double(goalMl), 1.0)
    }

    var amountFormatted: String {
        String(format: "%.2f", Double(amountMl) / 1000).replacingOccurrences(of: ".", with: ",") + "L"
    }

    var goalFormatted: String {
        String(format: "%.2f", Double(goalMl) / 1000).replacingOccurrences(of: ".", with: ",") + "L"
    }
}

// MARK: - Provider

struct WaterProvider: TimelineProvider {
    private let appGroup = "group.com.kombat.app"

    func placeholder(in context: Context) -> WaterEntry {
        WaterEntry(date: Date(), amountMl: 1800, goalMl: 3000)
    }

    func getSnapshot(in context: Context, completion: @escaping (WaterEntry) -> Void) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WaterEntry>) -> Void) {
        let entry = loadEntry()
        // Refresh every 15 minutes, or when the app writes new data
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextRefresh))
        completion(timeline)
    }

    private func loadEntry() -> WaterEntry {
        let defaults = UserDefaults(suiteName: appGroup)
        let amount = defaults?.integer(forKey: "water_amount_ml") ?? 0
        let goal   = defaults?.integer(forKey: "water_goal_ml")   ?? 3000
        return WaterEntry(date: Date(), amountMl: amount, goalMl: goal)
    }
}

// MARK: - Bottle illustration

struct ThermosBottleView: View {
    var progress: Double

    var body: some View {
        GeometryReader { geo in
            let w      = geo.size.width
            let h      = geo.size.height
            let bodyH  = h * 0.76
            let capH   = h * 0.09
            let neckH  = h * 0.05
            let shoulH = h * 0.07
            let stackH = capH + neckH + shoulH + bodyH

            // Center the entire stack vertically
            let topPad = (h - stackH) / 2

            VStack(spacing: 0) {
                Spacer().frame(height: topPad)

                // Screw cap
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(.label))
                    .frame(width: w * 0.52, height: capH)

                // Neck connector (no radius — hard shoulder)
                Rectangle()
                    .fill(Color(.label))
                    .frame(width: w * 0.40, height: neckH)

                // Shoulder
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color(.label).opacity(0.72))
                    .frame(width: w * 0.78, height: shoulH)

                // Body
                ZStack(alignment: .bottom) {
                    // Background
                    RoundedRectangle(cornerRadius: 7)
                        .fill(Color(.systemBackground))
                        .overlay(
                            RoundedRectangle(cornerRadius: 7)
                                .stroke(Color(.systemGray4), lineWidth: 0.75)
                        )

                    // Water fill
                    if progress > 0 {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color(red: 0.29, green: 0.56, blue: 0.85))
                            .frame(height: bodyH * CGFloat(progress))
                            .clipShape(RoundedRectangle(cornerRadius: 7))
                    }

                    // Shine stripe
                    HStack {
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(Color.white.opacity(0.22))
                            .frame(width: 3, height: bodyH * 0.44)
                            .padding(.leading, w * 0.18)
                            .padding(.bottom, bodyH * 0.28)
                        Spacer()
                    }

                    // Bottom ring
                    RoundedRectangle(cornerRadius: 7)
                        .fill(Color(.systemGray5))
                        .frame(height: 4)
                        .padding(.horizontal, 2)
                }
                .frame(width: w, height: bodyH)

                Spacer()
            }
        }
    }
}

// MARK: - Small widget view

struct WaterWidgetSmallView: View {
    var entry: WaterEntry

    var body: some View {
        VStack(spacing: 6) {
            ThermosBottleView(progress: entry.progress)
                .frame(width: 38, height: 76)

            Text(entry.amountFormatted)
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(.primary)

            Text("\(Int(entry.progress * 100))%")
                .font(.system(size: 11))
                .foregroundColor(.secondary)
        }
        .padding(12)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

// MARK: - Medium widget view

struct WaterWidgetMediumView: View {
    var entry: WaterEntry

    var body: some View {
        HStack(spacing: 16) {
            ThermosBottleView(progress: entry.progress)
                .frame(width: 40, height: 88)

            VStack(alignment: .leading, spacing: 5) {
                Text("Wasser")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.secondary)
                    .textCase(.none)

                Text(entry.amountFormatted)
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(.primary)

                Text("von \(entry.goalFormatted)")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)

                // Progress bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color(.systemGray5))
                            .frame(height: 3)
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color(red: 0.29, green: 0.56, blue: 0.85))
                            .frame(
                                width: geo.size.width * CGFloat(entry.progress),
                                height: 3
                            )
                    }
                }
                .frame(height: 3)

                if entry.amountMl >= entry.goalMl {
                    Text("Tagesziel erreicht")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(Color(red: 0.29, green: 0.56, blue: 0.85))
                }
            }
        }
        .padding(16)
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

// MARK: - Widget + Bundle

struct WaterWidget: Widget {
    let kind: String = "WaterWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WaterProvider()) { entry in
            switch WidgetInfo.family {
            case .systemSmall:
                WaterWidgetSmallView(entry: entry)
            default:
                WaterWidgetMediumView(entry: entry)
            }
        }
        .configurationDisplayName("Wassertracking")
        .description("Zeigt deinen täglichen Wasserstand.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// Helper to read widget family inside the view hierarchy
private struct WidgetInfo {
    @Environment(\.widgetFamily) static var family: WidgetFamily
}

@main
struct WaterWidgetBundle: WidgetBundle {
    var body: some Widget {
        WaterWidget()
    }
}
```

---

## Schritt 5: Info.plist für Widget Extension

Erstelle `targets/WaterWidget/Info.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
  </dict>
</dict>
</plist>
```

---

## Schritt 6: TypeScript-Fehler prüfen

```bash
npx tsc --noEmit
```

Behebe alle Fehler bevor du weitermachst.

---

## Schritt 7: Build

Das Widget läuft nicht in Expo Go — es braucht einen nativen Build:

```bash
# Development Build (zum Testen auf eigenem Gerät)
eas build --profile development --platform ios

# Oder für den App Store
eas build --profile production --platform ios
```

Beim ersten Build wird EAS automatisch:
- Die App Group `group.com.kombat.app` im Apple Developer Portal anlegen
- Die Widget Extension Bundle ID `com.kombat.app.WaterWidget` registrieren
- Die Entitlements für beide Targets setzen

---

## Regeln

- Keine Emojis in UI-Text.
- Keine neuen Farben — das Widget nutzt SwiftUI Semantic Colors
  (`Color(.label)`, `Color(.systemBackground)`, `Color(.systemGray4/5)`)
  damit es automatisch in Dark Mode funktioniert.
- Keine Änderungen an anderen Dateien außer den oben genannten.
- `any` ist verboten — alle Swift-Typen müssen explizit sein.
