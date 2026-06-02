# Sparring Group Chat — Design Spec
**Datum:** 2026-06-02

## Zusammenfassung

Ersetzt das bestehende 1-zu-1-Chat-System (`sparring_messages`) durch Gruppen-Chats pro Sparring. Jedes Sparring hat einen Gruppen-Kanal, in dem alle Teilnehmer und der Organisator schreiben können. Zugang über einen Chat-Button auf der Sparrings-Map. Bilder/Videos inline, aber nur wenn der Organisator sie freischaltet. Nach dem Sparring-Termin wird der Chat read-only.

---

## 1. Datenmodell

### `sparring_chat_settings`
```sql
sparring_id    uuid PRIMARY KEY REFERENCES open_sparrings(id) ON DELETE CASCADE
media_enabled  boolean NOT NULL DEFAULT false
```
- Wird beim Erstellen eines Sparrings client-seitig angelegt (INSERT in `createSparring`-Flow).
- RLS: Jeder Teilnehmer/Organisator darf lesen. Nur Organisator darf `media_enabled` updaten.

### `sparring_group_messages`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
sparring_id uuid NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE
sender_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
content     text          -- nullable wenn Bild
image_url   text          -- nullable wenn Text
created_at  timestamptz NOT NULL DEFAULT now()
```
- RLS Lesen: User ist Organisator (`created_by = auth.uid()`) ODER hat aktiven Signup (`sparring_signups`).
- RLS Schreiben (INSERT): Gleiche Bedingung + Sparring noch nicht abgelaufen (`scheduled_at + duration_min * interval '1 minute' > now()`).
- Bilder: INSERT nur erlaubt wenn `media_enabled = true` in `sparring_chat_settings` (geprüft via RPC oder Policy mit Subquery).

### `sparring_chat_reads`
```sql
user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE
sparring_id  uuid REFERENCES open_sparrings(id) ON DELETE CASCADE
last_read_at timestamptz NOT NULL DEFAULT now()
PRIMARY KEY (user_id, sparring_id)
```
- RLS: User liest/schreibt nur eigene Zeile.
- Unread-Count: `COUNT(*) FROM sparring_group_messages WHERE sparring_id = ? AND created_at > last_read_at`.

### Altlast
Die Tabelle `sparring_messages` bleibt in der DB erhalten, wird aber aus allen Screens, Hooks und der Navigation vollständig entfernt.

---

## 2. Navigation & Screens

### Chat-Button auf der Map
- Position: unten links in `SparringMapView`, nur im `sparrings`-Mode sichtbar.
- Runder Button 48×48px, Icon `chatbubbles-outline`.
- `UnreadBadge` (rote Zahl) wenn Gesamt-Unread > 0.
- Öffnet `SparringChatList` als Modal.

### `SparringChatListScreen` (neu)
- Liste aller Sparrings bei denen `auth.uid()` Organisator oder Teilnehmer ist.
- Pro Eintrag (`SparringChatListItem`): Titel, Datum, letzte Nachricht (Preview), Unread-Badge.
- Sortierung: aktive Sparrings oben, abgelaufene in Sektion "Archiv" darunter.
- Tippen → navigiert zu `SparringGroupChat`.

### `SparringGroupChatScreen` (ersetzt `SparringChatScreen`)
- Header: Sparring-Titel + Datum. Settings-Icon (nur Organisator).
- Nachrichten-Liste: Realtime via Supabase Channel (`sparring_group_messages:sparring_id=eq.<id>`).
- Eingabezeile: Textfeld + Senden-Button + optionaler Bild-Button (nur wenn `media_enabled = true`).
- Read-only-Banner wenn `scheduled_at + duration_min < now()`: "Dieses Sparring hat stattgefunden." — Eingabezeile wird ausgeblendet.
- `markRead()` wird beim Öffnen und beim Empfangen neuer Nachrichten aufgerufen (UPSERT in `sparring_chat_reads`).

### `SparringChatSettingsSheet` (neu, Bottom Sheet innerhalb des Chat-Screens)
- Kein eigener Stack-Screen — wird als Modal-State im `SparringGroupChatScreen` gerendert.
- Einzige Einstellung: Toggle "Bilder & Videos erlauben".
- Nur der Organisator kann das Sheet öffnen.

### Navigation
Beide neuen Screens (`SparringChatList`, `SparringGroupChat`) als NativeStack-Modals im bestehenden `AppStack` in `RootNavigator.tsx`. Bestehender `SparringChat`-Eintrag in `types.ts` wird durch `SparringGroupChat` ersetzt. `SparringChatList` bekommt keine Params.

---

## 3. Komponenten & Hooks

### Hooks

**`useSparringGroupChat(sparringId: string)`**
- Lädt Nachrichtenhistorie, abonniert Realtime-Channel.
- Exportiert: `messages`, `loading`, `sending`, `isReadOnly`, `mediaEnabled`, `sendText(content)`, `sendImage(localUri)`, `markRead()`.
- `isReadOnly`: `scheduledAt + durationMin < now()`.
- `sendImage`: Upload via `expo-file-system` + `base64-arraybuffer` → Bucket `chat-images` → speichert `image_url` in `sparring_group_messages`.

**`useSparringChatList()`**
- Lädt alle Sparrings des Users mit letzter Nachricht + Unread-Count.
- Realtime-Subscription auf `sparring_group_messages` für Live-Badge-Updates.
- Exportiert: `chats: SparringChatEntry[]`, `totalUnread: number`, `loading`.

**`useSparringChatSettings(sparringId: string, isOrganizer: boolean)`**
- Lädt `media_enabled`, exportiert `mediaEnabled`, `toggleMedia()` (nur wenn `isOrganizer`).

### Komponenten

**`GroupMessageBubble`**
- Zeigt Text oder Bild (via `Image`), Absender-Name + Uhrzeit.
- Eigene Nachrichten rechtsbündig (anderer Hintergrund), fremde linksbündig mit Name.

**`ChatImagePicker`**
- Wrapper um `expo-image-picker` (`launchImageLibraryAsync`).
- Gibt `localUri` zurück, Upload-Logik liegt im Hook.

**`SparringChatListItem`**
- Eine Zeile: Titel, Datum, letzte Nachricht Preview (max. 1 Zeile), `UnreadBadge`.

**`UnreadBadge`**
- Wiederverwendbar: runder roter Kreis mit weißer Zahl. Props: `count: number`. Versteckt bei `count === 0`.

---

## 4. Bildupload

- Supabase Storage Bucket `chat-images` (public read, authenticated write).
- Upload-Methode: identisch mit Avatar-Upload (`expo-file-system` + `base64-arraybuffer`) — kein `fetch().blob()`.
- Dateiname: `<sparringId>/<messageId>.<ext>`.
- Maximalgröße: 10 MB (client-seitig geprüft vor Upload).
- Nur erlaubt wenn `media_enabled = true` — client-seitig geprüft (Bild-Button ausgeblendet) + server-seitig via RLS-Policy.

---

## 5. Read-only nach Sparring

- Bedingung: `new Date(scheduledAt).getTime() + durationMin * 60_000 < Date.now()`.
- Im Hook berechnet und als `isReadOnly: boolean` exponiert.
- Im Screen: Eingabezeile wird durch Banner ersetzt ("Dieses Sparring hat stattgefunden.").
- RLS-Policy auf INSERT in `sparring_group_messages` prüft dieselbe Bedingung serverseitig.

---

## 6. Entfernte Teile

- `src/screens/SparringChatScreen.tsx` — wird gelöscht
- `src/hooks/useSparringChat.ts` — wird gelöscht
- Navigation-Param `SparringChat` in `types.ts` — wird durch `SparringGroupChat` ersetzt
- Chat-Link-Buttons in `SparringDetailSheet` und `SparringParticipantsList` — werden entfernt oder auf neuen Screen umgeleitet

---

## 7. Migrationen

1. `sparring_chat_settings` — Tabelle + RLS
2. `sparring_group_messages` — Tabelle + Index + RLS
3. `sparring_chat_reads` — Tabelle + RLS
4. Storage Bucket `chat-images` (manuell im Dashboard oder via CLI)
