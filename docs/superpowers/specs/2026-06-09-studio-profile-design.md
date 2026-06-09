# Studio-Profil Design Spec

**Datum:** 2026-06-09  
**Feature:** Studio-Teamprofil auf der Map

---

## Kontext

Studios (= Teams) sind Marker auf der `SparringMapScreen`. Beim Tippen auf einen Marker öffnet sich `StudioMapDetailSheet` (Quick Preview), dahinter liegt `StudioDetailScreen` (Vollprofil). Beide Screens sind aktuell minimal — Name, Stadt, Adresse, Probetraining-CTA, Stundenplan, Mitgliedschaftspläne. Kein visuelles Branding, keine Disziplinen, keine Präsentation des Teams.

---

## Ziel

Studios sollen ein attraktives, editierbares Profil haben das:
- Ihr visuelles Branding zeigt (Banner + Avatar)
- Ihre Kampfdisziplinen kommuniziert
- Herausragende Kämpfer präsentiert (Featured Fighters)
- Einen kurzen Beschreibungstext enthält
- Im Quick-Sheet bereits Disziplinen zeigt

---

## Datenmodell

### Neue Spalten auf `studios`

| Spalte | Typ | Beschreibung |
|---|---|---|
| `description` | `text \| null` | "Über uns"-Text, max. 300 Zeichen |
| `banner_url` | `text \| null` | Vollbreite Banner-Bild URL |
| `avatar_url` | `text \| null` | Studio-Avatar URL |
| `disciplines` | `text[]` | Array von Disziplin-Strings |

### Neue Tabelle `studio_featured_fighters`

| Spalte | Typ |
|---|---|
| `id` | `uuid` PK default `gen_random_uuid()` |
| `studio_id` | `uuid` FK → `studios.id` ON DELETE CASCADE |
| `user_id` | `uuid` FK → `profiles.id` ON DELETE CASCADE |
| `added_at` | `timestamptz` default `now()` |
| UNIQUE | `(studio_id, user_id)` |

RLS:
- SELECT: alle authentifizierten User
- INSERT: nur Studio-Owner (`studios.owner_user_id = auth.uid()`)
- DELETE: Studio-Owner ODER der betroffene Kämpfer selbst (`user_id = auth.uid()`)

### Storage

Bucket `studio-assets` (public):
- `{studioId}/banner.jpg` — Banner
- `{studioId}/avatar.jpg` — Studio-Avatar

---

## UI — StudioDetailScreen (Ansatz B: Scrollende Sektionen)

```
┌─────────────────────────────────┐
│  [Banner — volle Breite, 200px] │  ← ImageBackground, dark-Fallback
│  [Edit-Icon]  (nur für Owner)   │
│                                 │
├──┤Avatar 72px├───────────────────┤  ← −36px overlap über Banner-Unterkante
│  Studio Name (xl, bold)         │
│  City  ·  Adresse               │
└─────────────────────────────────┘
  [Boxen] [BJJ] [MMA] →            ← DisciplineChips, horizontal scroll

─────────────────────────────────────
  ÜBER UNS
  "Wir trainieren Boxer..."        ← nur wenn description nicht null

─────────────────────────────────────
  FEATURED FIGHTERS
  [Card] [Card] [Card] →           ← horizontale Row, → PublicProfile

─────────────────────────────────────
  [Probetraining buchen] / Status  ← bestehendes CTA

─────────────────────────────────────
  STUNDENPLAN                      ← besteht bereits

─────────────────────────────────────
  MITGLIEDSCHAFT                   ← besteht bereits
```

---

## UI — StudioMapDetailSheet (Quick Preview)

Unterhalb des bestehenden Header-Rows (Name + Stadt + Adresse) wird eine `DisciplineChips`-Row eingefügt — read-only, max. 3 Chips sichtbar.

---

## UI — StudioProfileEditScreen (Owner only)

Neuer modaler Screen, Einstieg über Edit-Icon im Hero des `StudioDetailScreen`.

Sektionen:
1. **Banner-Upload** — Tap auf Banner-Bereich, `launchImageLibraryAsync` aspect 16:9
2. **Avatar-Upload** — Tap auf Avatar, aspect 1:1
3. **Disziplinen** — Toggle-Chips aus vordefinierter Liste (Boxen, Kickboxen, Muay Thai, BJJ, Wrestling, MMA, Grappling, Judo, K-1, Freistil)
4. **Über uns** — Textarea, max. 300 Zeichen, Zeichenzähler
5. **Featured Fighters** — Liste aktuell gepinnter Kämpfer + Entfernen-Button; Plus-Button öffnet Member-Suchmodal
6. **Speichern-Button** (bottom, sticky)

---

## Kämpfer-Selbstentfernung

Im `FeaturedFightersRow`: wenn `card.userId === currentUserId`, zeigt die Karte ein "X"-Button. Tippen ruft `removeFighter(studioId, userId)` auf dem `useFeaturedFighters` Hook auf.

---

## Nicht in diesem Feature

- Trainer/Coaches-Sektion
- Studio-Galerie
- Kontaktdaten (Website, Instagram)
- Disziplin-Filter auf der Map
