# Fighter Profile — Design Spec

**Datum:** 2026-06-08  
**Status:** Genehmigt  
**Phase:** 1 — Profil für Sparring-Kontext (kein Scouting, kein Matching)

---

## Ziel

Kämpfer, die sich für ein Sparring verabreden, sollen vor dem Treffen wissen, mit wem sie es zu tun haben. Das Profil ist kein Matching-Tool — es ist eine Visitenkarte, die beim Antippen eines Sparringspartners erscheint.

End-Goal (spätere Phase): öffentliche URL / QR-Code, damit Profile auch ausserhalb der App geteilt werden können.

---

## Scope

**In Phase 1:**
- Neue Profilfelder in `profiles`
- `is_amateur` Flag in `fight_records`
- Redesign `PublicProfileScreen`
- Neue editierbare Cards in `ProfilScreen`
- QR-Code / Share via `profile_code`
- Avatar prominent in Hero

**Explizit nicht in Phase 1:**
- Foto-Upload (`fight_photos`) — Storage-Kalkulation nötig (max 3 Fotos à ~400KB ≈ 600 User im Free-Tier; siehe Obsidian Offene-Punkte)
- Video-Upload (zu teuer, direkte Uploads)
- Video-Links
- `available_for_sparring` Toggle (gehört zu Matching, nicht zu Profil)
- Organisations-/Promoter-Rolle

---

## Datenmodell

### Neue Spalten in `profiles`

| Spalte | Typ | Nullable | Beschreibung |
|---|---|---|---|
| `nickname` | `text` | ja | Kampfname, z.B. "The Hammer" |
| `weight_class` | `text` | ja | Gewichtsklasse (Lightweight, Welterweight, …) |
| `weight_kg` | `numeric` | ja | Aktuelles Kampfgewicht |
| `nationality` | `text` | ja | ISO-Ländercode, z.B. "DE", "AT" |
| `hometown` | `text` | ja | Öffentliche Heimatstadt (getrennt von `address`) |
| `bio` | `text` | ja | Freitext, max 300 Zeichen |
| `instagram_url` | `text` | ja | Instagram-Profillink |

### Änderung `fight_records`

- Neue Spalte: `is_amateur boolean default false`
- Erlaubt getrennte Anzeige von Profi- und Amateurrekord (wie Sherdog/BoxRec)

### Keine neuen Tabellen in Phase 1

---

## PublicProfileScreen — Struktur

Scrollbarer Screen, von oben nach unten:

1. **Hero**
   - Grosses Avatar-Bild (zentriert, immer sichtbar)
   - `Name` + `"Kampfname"` in einer Zeile
   - Verified-Badge direkt neben dem Namen
   - `profile_code` als kleines graues Tag, tappbar zum Kopieren

2. **Stats-Chips** (horizontal, 4 Stück)
   - Gewichtsklasse · Stance · Grösse · "seit YYYY"

3. **Bio**
   - Freitext, max 300 Zeichen
   - Nur angezeigt wenn befüllt

4. **Kampfrekord**
   - Drei grosse Zahlen: W — L — D
   - Darunter klein: KO/TKO · Sub · Entscheidung
   - Tab-Toggle "Profi / Amateur" wenn beide vorhanden

5. **Info-Zeile**
   - Nationalität (Flagge + Text) · Heimatstadt · Disciplines als Chips · Studio/Team

6. **Social**
   - Instagram-Icon-Button — öffnet Instagram extern
   - Nur angezeigt wenn `instagram_url` gesetzt

7. **QR-Code / Teilen** (Header-Button oben rechts)
   - Bottom Sheet mit: QR-Code, `profile_code` Text, System-Teilen-Button
   - Bibliothek: `react-native-qrcode-svg` (kostenlos, kein API-Key)

---

## ProfilScreen — eigenes Profil bearbeiten

Neue editierbare Card **"Kämpferprofil"**:
- Kampfname (Textfeld)
- Nationalität (Textfeld)
- Heimatstadt (Textfeld)
- Gewicht kg (Zahlenfeld)
- Gewichtsklasse (Picker)
- Bio (Textarea, Zeichenzähler bis 300)
- Instagram URL (Textfeld)

---

## Neue Hooks

| Hook | Zweck |
|---|---|
| `usePublicProfile(profileCode)` | Erweiterter Fetch: alle Profilfelder + fight_records (mit is_amateur) |

---

## Neue / geänderte Dateien

**Neue Dateien:**
- `src/hooks/usePublicProfile.ts`
- `src/components/profil/FighterProfileCard.tsx`

**Geänderte Dateien:**
- `src/screens/PublicProfileScreen.tsx` — komplett neu strukturiert
- `src/screens/ProfilScreen.tsx` — neue Card eingebaut
- `src/components/profil/FightRecordCard.tsx` — Amateur/Profi-Toggle
- `src/types/database.types.ts` — neue Felder

**Neue Migrationen:**
- `..._add_fighter_profile_fields.sql`
- `..._add_fight_record_amateur.sql`

---

## Offene Punkte / Phase 2

- Öffentliche Web-URL per `profile_code` (ohne App zugänglich)
- Foto-Upload: max 3 Fotos, ~400KB komprimiert → ~600 User im Supabase Free-Tier; eigener Bucket `fight-photos`, Upload-Pattern wie Avatare (`expo-file-system` + `base64-arraybuffer`)
- Organisations-/Promoter-Rolle für Scouting
- `available_for_sparring` Toggle wenn Matching-Feature kommt
