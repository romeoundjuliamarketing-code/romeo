# In-App Purchase Setup — iOS + Android + RevenueCat

**Ziel:** Einen einmaligen Kauf (€15, Map-Badge-Boost) in deiner Sparr-App
verkaufen, der auf iOS über den App Store und auf Android über Google Play
abgewickelt wird. RevenueCat sitzt in der Mitte und vereinheitlicht beide
Stores.

---

## Überblick: Wie die drei Teile zusammenhängen

App Store Connect und Google Play Console sind die Stores — sie wickeln die
Zahlung ab und geben dir das Geld. RevenueCat ist ein Dienst, der zwischen
deiner App und beiden Stores sitzt. Er normalisiert die unterschiedlichen
Store-APIs zu einer einheitlichen SDK-API, die du in deinem React-Native-Code
einmal implementierst. Ohne RevenueCat müsstest du StoreKit (iOS) und
Google Play Billing (Android) separat bauen und pflegen.

Der Fluss ist immer:
App → RevenueCat SDK → Store (Apple / Google) → Zahlung → Store bestätigt
an RevenueCat → RevenueCat-Webhook oder direkter SDK-Callback an deine App.

---

## Teil 1 — App Store Connect (iOS)

### 1.1 App-Eintrag prüfen

Geh auf https://appstoreconnect.apple.com und öffne deine Sparr-App. Stelle
sicher, dass die Bundle ID mit der in deinem Expo-Projekt übereinstimmt
(in `app.json` unter `expo.ios.bundleIdentifier`).

### 1.2 In-App Purchase anlegen

Navigiere in deinem App-Eintrag zu "In-App-Käufe" (linke Seitenleiste).
Klicke auf das Plus-Symbol und wähle den Typ.

Für den Map-Badge-Boost ist der richtige Typ "Verbrauchsartikel"
(Consumable). Das bedeutet: Der Kauf kann mehrfach getätigt werden (z.B.
Badge nach 30 Tagen erneut kaufen). Wenn du willst, dass der Badge dauerhaft
ist und nur einmal gekauft werden kann, wähle stattdessen
"Nicht-verbrauchsartikel" (Non-Consumable).

Fülle folgende Felder aus:

- Referenzname: "Map Badge Boost" (nur intern sichtbar)
- Produktkennung (Product ID): Wähle ein konsistentes Schema, z.B.
  `com.deinebundle.sparr.mapbadge_30d`
  Diese ID musst du dir merken — sie kommt in RevenueCat und im Code vor.
- Preis: Wähle die Preisstufe, die €15 am nächsten kommt. Apple arbeitet
  mit fixen Preisstufen. Tier 13 entspricht aktuell €15,99 in der
  Eurozone — das ist die nächstmögliche Option zu €15,00.
- Lokalisierung: Füge mindestens Deutsch und Englisch hinzu.
  Displayname z.B. "Map-Highlight (30 Tage)", kurze Beschreibung.

Speichere das Produkt. Es hat jetzt den Status "Vorbereitet zur Einreichung"
— das ist korrekt, es muss nicht sofort eingereicht werden.

### 1.3 Sandbox-Tester anlegen

Um den Kauf testen zu können ohne echtes Geld zu zahlen, brauchst du einen
Sandbox-Account. Gehe in App Store Connect zu "Benutzer und Zugriff" →
"Sandbox-Tester" → Neuer Tester. Nutze eine E-Mail-Adresse, die kein echtes
Apple-ID-Konto ist. Auf dem Testgerät (iPhone/Simulator) loggst du dich
mit diesem Account ein, wenn du einen Kauf testest.

---

## Teil 2 — Google Play Console (Android)

### 2.1 App-Eintrag prüfen

Gehe auf https://play.google.com/console und öffne deine Sparr-App. Die
Package Name muss mit `expo.android.package` in deiner `app.json`
übereinstimmen.

### 2.2 In-App-Produkt anlegen

Navigiere zu "Monetarisierung" → "Produkte" → "In-App-Produkte" →
"Produkt erstellen".

Fülle aus:
- Produkt-ID: Nimm dieselbe ID wie bei Apple, also
  `com.deinebundle.sparr.mapbadge_30d`. RevenueCat erlaubt pro Store
  unterschiedliche IDs, aber gleiche IDs halten es einfach.
- Name: "Map Badge Boost"
- Beschreibung: kurz auf Deutsch und Englisch
- Status: "Aktiv" setzen (wichtig — ohne Aktiv-Status wird das Produkt
  nicht ausgeliefert)
- Preis: €15,00 eintragen. Google lässt beliebige Preise zu, keine
  fixen Stufen wie Apple.

Speichere das Produkt.

### 2.3 Wichtige Einschränkung bei Google

Google liefert In-App-Produkte nur aus, wenn die App mindestens einmal
über den Play Store veröffentlicht wurde (auch im Internal Testing Track
reicht das). Wenn deine App noch nie hochgeladen wurde, musst du zuerst
eine APK/AAB hochladen und den Internal Testing Track aktivieren, bevor
du Käufe testen kannst.

Testkonten für Google: Gehe in der Play Console zu "Monetarisierung" →
"Tester" und füge deine Gmail-Adresse hinzu. Käufe dieser Accounts werden
nicht tatsächlich abgerechnet.

---

## Teil 3 — RevenueCat einrichten

### 3.1 Account und App anlegen

Gehe auf https://app.revenuecat.com. Falls du noch kein Projekt hast, lege
eines an. Innerhalb des Projekts legst du zwei Apps an — eine für iOS
und eine für Android.

Für die iOS-App:
- Name: "Sparr iOS"
- Store: App Store
- Bundle ID: exakt deine iOS Bundle ID aus `app.json`
- App Store Connect API Key: dazu gleich mehr

Für die Android-App:
- Name: "Sparr Android"
- Store: Google Play
- Package Name: deine Android Package aus `app.json`
- Google Play JSON-Credentials: dazu gleich mehr

### 3.2 App Store Connect API Key für RevenueCat

RevenueCat braucht Zugriff auf App Store Connect, um Käufe zu verifizieren.

Gehe in App Store Connect zu "Benutzer und Zugriff" → "Integrationen" →
"In-App-Kauf". Dort findest du "App Store Connect API" — erzeuge einen
neuen Schlüssel mit der Rolle "App Manager". Lade die .p8-Datei herunter
und kopiere die Key ID sowie die Issuer ID.

Diese drei Werte (Key ID, Issuer ID, .p8-Datei-Inhalt) trägst du in
RevenueCat unter deiner iOS-App-Konfiguration ein.

### 3.3 Google Play Service Account für RevenueCat

Gehe in der Google Play Console zu "Setup" → "API-Zugriff". Verknüpfe
dort dein Google Cloud Projekt (falls noch nicht geschehen). Erstelle
dann einen Service Account mit den Berechtigungen "Finanzdaten anzeigen"
und "Bestellungen und Abonnements verwalten".

Lade den JSON-Schlüssel des Service Accounts herunter und trage ihn in
RevenueCat unter deiner Android-App-Konfiguration ein.

### 3.4 Produkte in RevenueCat importieren

Navigiere in RevenueCat zu deinem Projekt → "Produkte" → "Neues Produkt".

Füge für iOS ein:
- Store: App Store
- Produkt-ID: `com.deinebundle.sparr.mapbadge_30d`
- Typ: Consumable (oder Non-Consumable, je nach deiner Entscheidung)

Füge für Android dasselbe ein, nur mit Store: Google Play.

### 3.5 Offering und Package anlegen

Offerings sind Pakete, die du deiner App präsentierst. In deinem Fall
brauchst du ein einziges Offering mit einem einzigen Package.

Gehe zu "Offerings" → "Neues Offering erstellen":
- Identifier: `map_badge` (diesen String rufst du später im Code ab)
- Beschreibung: "Map Badge Boost"

Innerhalb dieses Offerings legst du ein Package an:
- Package Identifier: `$rc_consumable` (RevenueCat-Standard für
  Einmalkäufe) oder ein eigener String wie `map_badge_30d`
- Weise dem Package die iOS- und Android-Produkte zu, die du in
  Schritt 3.4 angelegt hast.

### 3.6 RevenueCat API Keys für deine App

Gehe in RevenueCat zu "API Keys". Du brauchst:
- Den "Public (App)" Key für iOS
- Den "Public (App)" Key für Android

Diese Keys kommen in deine `.env`-Datei:

```
REVENUECAT_IOS_API_KEY=appl_xxxxxxxxxxxxxxxxxxxx
REVENUECAT_ANDROID_API_KEY=goog_xxxxxxxxxxxxxxxxxxxx
```

Und in deine `app.config.js` / `expo-constants`-Config, damit sie im
App-Code über `Constants.expoConfig.extra` abrufbar sind — nie direkt
als String im Code.

---

## Teil 4 — Verbindung im App-Code

### 4.1 RevenueCat SDK initialisieren

In deiner App muss RevenueCat beim Start einmal initialisiert werden —
typischerweise in `App.tsx` oder dem Root-Component, bevor irgendein
Screen gerendert wird.

Das SDK `react-native-purchases` liest automatisch heraus, ob es auf iOS
oder Android läuft, und verwendet den entsprechenden API Key. Du rufst
`Purchases.configure()` einmal auf und gibst den passenden Key mit.

Da du Expo verwendest, musst du `expo-build-properties` oder einen Custom
Dev Build nutzen — `react-native-purchases` funktioniert nicht in Expo Go,
weil es nativen Code enthält. Das ist eine wichtige Einschränkung:
Für IAP-Tests brauchst du einen Development Build (früher: "bare workflow"
oder `expo run:ios` / `expo run:android`).

### 4.2 Offering abrufen und Kauf starten

Im Code rufst du das Offering über seine ID ab (`map_badge`), holst das
Package heraus und übergibst es an `Purchases.purchasePackage()`. Das SDK
öffnet automatisch den nativen Store-Dialog von Apple bzw. Google. Nach
einer erfolgreichen Zahlung gibt das SDK ein `CustomerInfo`-Objekt zurück,
aus dem du den Kauf-Status lesen kannst.

### 4.3 Kauf-Status sichern

Verlasse dich nicht allein auf den Client-Callback. Nutze einen
RevenueCat-Webhook, der nach erfolgreichem Kauf eine Supabase Edge Function
(oder einen beliebigen HTTP-Endpoint) aufruft und dort den Badge in der
Datenbank aktiviert. Alternativ — und einfacher — kannst du nach
erfolgreichem `purchasePackage()`-Callback direkt eine Supabase RPC
aufrufen, die den Badge aktiviert. Dieser Ansatz ist für ein kleines
Produkt ausreichend, solange die RPC serverseitig prüft, ob der Nutzer
wirklich einen gültigen Kauf hat (Receipt-Verification über RevenueCat API).

---

## Teil 5 — Testen

### iOS

Baue die App mit `expo run:ios` auf einem physischen iPhone oder Simulator.
Logge dich im Gerät mit dem Sandbox-Tester-Account aus Schritt 1.3 ein
(Einstellungen → App Store → Account → abmelden, dann beim ersten Kauf
mit dem Sandbox-Account anmelden). Starte den Kauf in der App — es öffnet
sich der native Apple-Dialog mit dem Hinweis "Sandbox-Umgebung".

### Android

Baue mit `expo run:android` und stelle sicher, dass die APK über den
Internal Testing Track des Play Store installiert wurde (nicht direkt
per USB-Install, da Google Play Billing sonst nicht verfügbar ist).
Logge dich mit dem Test-Gmail-Account aus Schritt 2.3 ein.

### RevenueCat Dashboard

Im RevenueCat Dashboard unter "Customer Lookup" kannst du nach deiner
Test-User-ID suchen und siehst in Echtzeit, ob der Kauf erkannt wurde.
Das ist das verlässlichste Debugging-Tool.

---

## Kurzübersicht: Was du wo einträgst

| Was                        | Wo eingetragen                          |
|----------------------------|-----------------------------------------|
| Product ID                 | App Store Connect + Google Play Console |
| Product ID                 | RevenueCat → Produkte                   |
| Offering "map_badge"       | RevenueCat → Offerings                  |
| App Store API Key (.p8)    | RevenueCat → iOS App-Config             |
| Google Service Account JSON| RevenueCat → Android App-Config         |
| RevenueCat Public Keys     | Deine .env Datei                        |
| .env Keys                  | app.config.js → extra                   |
| `Purchases.configure()`    | App.tsx (einmal beim Start)             |
| `purchasePackage()`        | useMapBadgePurchase Hook                |

---

## Häufige Fehler

RevenueCat zeigt "Product not found": Die Product ID in RevenueCat stimmt
nicht exakt mit der ID in App Store Connect / Google Play überein. Prüfe
auf Leerzeichen und Groß-/Kleinschreibung.

Kauf-Dialog erscheint nicht auf Android: Die App wurde nicht über den
Play Store installiert. Direkte APK-Installs umgehen Google Play Billing.

"Cannot make payments" auf iOS: Das Testgerät hat Käufe deaktiviert
(Familienfreigabe / Screen Time-Einschränkungen) oder du bist nicht mit
dem Sandbox-Account eingeloggt.

RevenueCat-Callback kommt, aber Supabase RPC schlägt fehl: Prüfe ob die
RLS-Policy der Tabelle den Schreibzugriff für den eingeloggten User erlaubt.

Expo Go funktioniert nicht: `react-native-purchases` benötigt native
Module. Zwingend Development Build oder `expo run:ios/android` verwenden.
