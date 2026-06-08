# 2026-04-22 – Bundle ID Korrektur

## Problem

`app.json` hatte `bundleIdentifier: "kombat.app"` gesetzt, aber in App Store Connect war die App mit `com.kombat.app` registriert. RevenueCat schlug mit "Bundle ID mismatch" fehl.

## Ursache

Bundle ID wurde ursprünglich falsch in `app.json` eingetragen.

## Lösung

`app.json` korrigiert: `"bundleIdentifier": "com.kombat.app"`

Danach neuer EAS Development Build nötig, da Bundle ID in der nativen Schicht steckt und sich nicht per JS-Update ändern lässt.

## Lessons Learned

Bundle ID muss an drei Stellen übereinstimmen:
1. `app.json` → `ios.bundleIdentifier`
2. App Store Connect → App-Einstellungen
3. RevenueCat → Apps & providers → Bundle ID
