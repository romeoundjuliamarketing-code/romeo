# UI-Performance: Gruppenchats + Performance-Regeln — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Beide Gruppenchats (Sparring + Event) laden paginiert, verlieren keine Nachrichten, halten die Leseposition, scrollen ohne konkurrierende Befehle und rendern beim Tippen nicht mehr die Nachrichtenliste neu. Dazu kommen dauerhafte UI-Performance-Regeln für künftige Änderungen.

**Architecture:** Fehleranfällige Logik (Merge/Dedupe/Sortierung, Gruppierungs-Flags in invertierter Reihenfolge, Scroll-Entscheidung) wandert als pure Funktionen nach `src/utils/chatMessages.ts` und bekommt Tests. Die Hooks abonnieren Realtime *vor* dem ersten Laden und führen alles über `mergeMessages` zusammen. Die Screens nutzen eine invertierte `FlatList` mit `maintainVisibleContentPosition` statt `scrollToEnd` in `onContentSizeChange`. Das Eingabefeld wird zu einer eigenen Komponente mit lokalem State.

**Tech Stack:** RN 0.83.6, Expo 55.0.27, React 19.2.0, FlatList (keine FlashList/Legend-List installiert), Reanimated 4.2.1, supabase-js 2.100.0. React Compiler ist installiert (`babel-plugin-react-compiler` 1.0.0), aber **nicht aktiviert** (kein `experiments.reactCompiler` in `app.config.js`). Memoisierung muss also bei Bedarf manuell erfolgen.

**Spec:** die Nutzeranfrage vom 2026-09-25 (UI-Performance-Audit) im Chat. Audit-Befunde unten.

## Global Constraints

- Keine neuen Bibliotheken (kein FlashList, kein expo-image, kein keyboard-controller). Kein Aktivieren des React Compilers in diesem Plan.
- Keine Schema-/RPC-/Policy-Änderung (Supabase-Contract mit sparrapp.com bleibt unberührt).
- CLAUDE.md-Regeln: kein Inline-`style={{}}` für neue Styles (bestehende `paddingBottom: insets.bottom + 8` bleiben), Abstände in 8er-Schritten, Farben nur aus `colors.ts`, keine Emojis, Ionicons, UI-Texte Deutsch mit echten Umlauten, Kommentare Englisch, `any` verboten.
- Tests nur in `src/utils/*.test.ts` (jest `testMatch`), kein `import type` in Test-Dateien.
- Bestehende uncommittete Nutzeränderungen erhalten; nur die im jeweiligen Task genannten Dateien anfassen. Commits nur mit expliziten Pfaden (`git add <path>`), nie `git add -A`.
- Nach jeder Codeänderung `npx tsc --noEmit`.
- Bubble-Darstellung (`GroupMessageBubble`, `EventMessageBubble`), Farben und Texte bleiben optisch unverändert.

## Audit-Befunde (Grundlage)

Legende: **[C]** = durch Code belegtes Risiko, **[V]** = unbestätigte Vermutung. Nichts davon ist gemessen, weil kein Gerät oder Profiler in dieser Session läuft.

| # | Ort | Befund | Klasse |
|---|---|---|---|
| 1 | `useSparringGroupChat.ts` / `useEventGroupChat.ts` `loadMessages` | Lädt den **gesamten** Verlauf ohne `limit`. Kein Nachladen älterer Nachrichten. | C |
| 2 | beide Hooks, `useEffect` | `loadMessages()` und `subscribe()` laufen parallel. `setMessages(enriched)` **überschreibt** den State. Eine Realtime-Nachricht, die nach dem Query-Snapshot, aber vor der Antwort eintrifft, geht bis zum erneuten Öffnen verloren. | C |
| 3 | beide Hooks, INSERT-Handler | `await` auf den Profil-Fetch, danach Append ohne Sortierung. Zwei schnell hintereinander eintreffende Nachrichten eines neuen Absenders können in falscher Reihenfolge landen. | C |
| 4 | beide Hooks | Kein Nachholen nach Reconnect oder App-Vordergrund. Nachrichten, die während eines Socket-Abbruchs gesendet wurden, fehlen. | C (Nachholen fehlt) / V (wie oft realtime-js die Verbindung wirklich verliert) |
| 5 | `AuthContext` liefert bei jedem Auth-Event (auch `TOKEN_REFRESHED`) ein neues `user`-Objekt. `useEventGroupChat.loadMessages` und beide `markRead` hängen von `user` ab. | Bei jedem Token-Refresh wird der Channel abgebaut, neu aufgebaut und der **komplette Verlauf neu geladen**. | C |
| 6 | beide Screens | `inputText` liegt im Screen-State, und `renderItem` ist eine Inline-Arrow-Funktion. Jeder Tastendruck rendert den Screen neu, `FlatList` bekommt ein neues `renderItem`, und alle gemounteten Zellen berechnen `isSameDay`/`new Date` erneut. `GroupMessageBubble` ist zwar `memo`, aber die Fragment-Zelle und `ChatDateSeparator` nicht. | C (Arbeit pro Tastendruck) / V (ob spürbar) |
| 7 | beide Screens | Nicht invertierte Liste mit `scrollToEnd` in `onContentSizeChange`. Beim Öffnen eines langen Chats wächst der Inhalt in Batches, und jeder Batch löst ein animiertes `scrollToEnd` aus. Auch Tastatur-Layout und Bild-/Nachrichtenänderungen lösen `scrollToEnd` aus: konkurrierende Scrollbefehle. | C |
| 8 | beide Screens | Kommt eine Nachricht, während der Nutzer nach oben gescrollt hat, gibt es keinen Hinweis. Die Nachricht ist unsichtbar. | C |
| 9 | `GroupMessageBubble` Bild | Feste 220×160 → vorhersehbare Höhe, OK. Kein Disk-Cache (RN `Image`). | V (kein Handlungsbedarf ohne Messung) |
| 10 | Android: `KeyboardAvoidingView behavior={undefined}` unter Edge-to-Edge (SDK 55) | Eingabe könnte von der Tastatur verdeckt werden. | V → Geräteprüfung, in diesem Plan keine Änderung |

**Bestandsaufnahme außerhalb der Chats** (Haiku sammelt die Fundstellen, Opus verifiziert sie im Code). Ergebnis: **kein Handlungsbedarf ohne Messung**.
- `WaterBottleCard.tsx:87` `useNativeDriver: false` für `height` (300 ms, nur bei Tap). Eine Layout-Prop ist nativ nicht treibbar, kurz und selten. OK.
- `LayoutAnimation` in `ErnaehrungScreen`, `HeroSection`, `WorkoutCategoryRows`: Auf- und Zuklappen, einmalig pro Tap. Kein Befund, nur beim Gerätetest beobachten.
- `TimerScreen.tsx:46`, `useRoundTimer.ts:23`: `setInterval` mit setState im Tick-Takt (`TICK_MS`), nicht pro Frame. OK.
- `WorkoutHistoryScreen`: `ScrollView`+`map` über `weeks.slice(-MAX_WEEKS)`, also beschränkt. OK. `FeaturedFightersRow` und `StudioCoachesSection` sind kleine Studiolisten. [V] unkritisch.
- Alle 4 `FlatList` haben `keyExtractor`. `Animated.loop` gibt es nicht.

## Review Focus

1. **Leerer Chat:** `messages = []` → Empty-State lesbar (nicht kopfüber in der invertierten Liste), kein `onEndReached`-Loop. → Test in Task 1 (`computeLayoutFlags` auf `[]`), manuelle Prüfung in Task 4.
2. **Gleicher Zeitstempel / Realtime vor Initial-Load:** Dieselbe ID aus Insert-Antwort und Realtime darf nie doppelt erscheinen, und die Reihenfolge ist stabil. → Tests in Task 1.
3. **Genau eine Seite (50) vorhanden:** `hasMore` wird nach dem nächsten, leeren Nachladen `false`. Es gibt keine Endlosschleife. → Test `hasMoreAfterPage` in Task 1.
4. **Eigene Nachricht senden, während nach oben gescrollt:** Die Liste springt ans Ende, es erscheint kein Hinweis. → Test in Task 1 (`decideScrollOnNewest`).
5. **Tag-Wechsel an Seitengrenze:** Der Datumstrenner erscheint über der ältesten Nachricht des Tages, auch nach dem Nachladen. → Test in Task 1.

---

### Task 1: Pure Chat-Logik + Tests

**Files:**
- Create: `src/utils/chatMessages.ts`
- Test: `src/utils/chatMessages.test.ts`

**Interfaces:**
- Produces:
  - `interface ChatRow { id: string; created_at: string }`
  - `mergeMessages<T extends ChatRow>(existing: T[], incoming: T[]): T[]`: aufsteigend nach Zeit, dedupliziert per `id` (vorhandene Zeile gewinnt, kein Remount). Gibt die `existing`-Referenz zurück, wenn sich nichts ändert.
  - `CHAT_PAGE_SIZE = 50`
  - `hasMoreAfterPage(pageLength: number): boolean`
  - `interface LayoutFlags { showDateSeparator: boolean; isFirstInGroup: boolean; isLastInGroup: boolean }`
  - `computeLayoutFlags<T extends ChatRow>(newestFirst: T[], index: number, sameGroup: (a: T, b: T) => boolean): LayoutFlags`
  - `type ScrollDecision = 'none' | 'scrollToLatest' | 'showHint'`
  - `decideScrollOnNewest(args: { prevNewestId: string | null; newestId: string | null; newestIsOwn: boolean; nearLatest: boolean }): ScrollDecision`

- [ ] **Step 1: Failing Tests schreiben**

```ts
import {
  mergeMessages, hasMoreAfterPage, CHAT_PAGE_SIZE,
  computeLayoutFlags, decideScrollOnNewest,
} from './chatMessages';

type Row = { id: string; created_at: string; sender: string };
const r = (id: string, created_at: string, sender = 'a'): Row => ({ id, created_at, sender });
const same = (a: Row, b: Row) => a.sender === b.sender;

describe('mergeMessages', () => {
  it('dedupes by id and keeps ascending order', () => {
    const existing = [r('1', '2026-09-25T10:00:00Z'), r('2', '2026-09-25T10:01:00Z')];
    const merged = mergeMessages(existing, [r('2', '2026-09-25T10:01:00Z'), r('3', '2026-09-25T10:00:30Z')]);
    expect(merged.map((m) => m.id)).toEqual(['1', '3', '2']);
  });
  it('keeps a realtime row that arrived before the initial page', () => {
    const realtimeFirst = [r('9', '2026-09-25T12:00:00Z')];
    const page = [r('7', '2026-09-25T11:00:00Z'), r('8', '2026-09-25T11:30:00Z')];
    expect(mergeMessages(realtimeFirst, page).map((m) => m.id)).toEqual(['7', '8', '9']);
  });
  it('orders equal timestamps by id deterministically', () => {
    const merged = mergeMessages([r('b', '2026-09-25T10:00:00Z')], [r('a', '2026-09-25T10:00:00Z')]);
    expect(merged.map((m) => m.id)).toEqual(['a', 'b']);
  });
  it('treats different ISO offsets as the same instant', () => {
    const merged = mergeMessages(
      [r('x', '2026-09-25T12:00:00+02:00')],
      [r('y', '2026-09-25T10:30:00+00:00')],
    );
    expect(merged.map((m) => m.id)).toEqual(['x', 'y']);
  });
  it('returns the same reference when nothing is new', () => {
    const existing = [r('1', '2026-09-25T10:00:00Z')];
    expect(mergeMessages(existing, [r('1', '2026-09-25T10:00:00Z')])).toBe(existing);
    expect(mergeMessages(existing, [])).toBe(existing);
  });
});

describe('hasMoreAfterPage', () => {
  it('is true only for a full page', () => {
    expect(hasMoreAfterPage(CHAT_PAGE_SIZE)).toBe(true);
    expect(hasMoreAfterPage(CHAT_PAGE_SIZE - 1)).toBe(false);
    expect(hasMoreAfterPage(0)).toBe(false);
  });
});

describe('computeLayoutFlags (newest-first list)', () => {
  // Visual order top->bottom: 1 (day 1), 2, 3 (day 2, other sender), 4
  const newestFirst = [
    r('4', '2026-09-25T10:05:00', 'b'),
    r('3', '2026-09-25T10:00:00', 'b'),
    r('2', '2026-09-24T09:01:00', 'a'),
    r('1', '2026-09-24T09:00:00', 'a'),
  ];
  it('marks date separator above the oldest message of each day', () => {
    const flags = newestFirst.map((_, i) => computeLayoutFlags(newestFirst, i, same).showDateSeparator);
    expect(flags).toEqual([false, true, false, true]);
  });
  it('groups consecutive messages of the same sender on the same day', () => {
    expect(computeLayoutFlags(newestFirst, 3, same)).toEqual({ showDateSeparator: true, isFirstInGroup: true, isLastInGroup: false });
    expect(computeLayoutFlags(newestFirst, 2, same)).toEqual({ showDateSeparator: false, isFirstInGroup: false, isLastInGroup: true });
    expect(computeLayoutFlags(newestFirst, 1, same)).toEqual({ showDateSeparator: true, isFirstInGroup: true, isLastInGroup: false });
    expect(computeLayoutFlags(newestFirst, 0, same)).toEqual({ showDateSeparator: false, isFirstInGroup: false, isLastInGroup: true });
  });
  it('splits a group across a day boundary even for the same sender', () => {
    const list = [r('2', '2026-09-25T00:01:00', 'a'), r('1', '2026-09-24T23:59:00', 'a')];
    expect(computeLayoutFlags(list, 1, same).isLastInGroup).toBe(true);
    expect(computeLayoutFlags(list, 0, same).isFirstInGroup).toBe(true);
  });
  it('handles a single message', () => {
    const one = [r('1', '2026-09-25T10:00:00')];
    expect(computeLayoutFlags(one, 0, same)).toEqual({ showDateSeparator: true, isFirstInGroup: true, isLastInGroup: true });
  });
});

describe('decideScrollOnNewest', () => {
  const base = { prevNewestId: 'a', newestId: 'b', newestIsOwn: false, nearLatest: true };
  it('does nothing when the newest message did not change (e.g. older page loaded)', () => {
    expect(decideScrollOnNewest({ ...base, newestId: 'a' })).toBe('none');
  });
  it('does nothing on the initial load', () => {
    expect(decideScrollOnNewest({ ...base, prevNewestId: null })).toBe('none');
  });
  it('lets the list follow natively when the reader is near the latest message', () => {
    expect(decideScrollOnNewest(base)).toBe('none');
  });
  it('shows a hint for incoming messages while reading older ones', () => {
    expect(decideScrollOnNewest({ ...base, nearLatest: false })).toBe('showHint');
  });
  it('always reveals the user\'s own message', () => {
    expect(decideScrollOnNewest({ ...base, nearLatest: false, newestIsOwn: true })).toBe('scrollToLatest');
  });
});
```

- [ ] **Step 2: Laufen lassen, muss scheitern**

Run: `npx jest src/utils/chatMessages.test.ts`
Expected: FAIL `Cannot find module './chatMessages'`

- [ ] **Step 3: Implementieren**

```ts
// Pure helpers for chat message lists (merge, paging, layout flags, scroll decisions).
import { isSameDay } from './chatDate';

export interface ChatRow {
  id:         string;
  created_at: string;
}

export const CHAT_PAGE_SIZE = 50;

function compareRows(a: ChatRow, b: ChatRow): number {
  const diff = Date.parse(a.created_at) - Date.parse(b.created_at);
  if (diff !== 0) return diff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Merges rows ascending by time, deduped by id (an already present row wins, no remount). */
export function mergeMessages<T extends ChatRow>(existing: T[], incoming: T[]): T[] {
  const known = new Set(existing.map((m) => m.id));
  const fresh: T[] = [];
  for (const m of incoming) {
    if (!known.has(m.id)) { known.add(m.id); fresh.push(m); }
  }
  // Nothing new: keep the existing array so memoized cells do not re-render.
  if (fresh.length === 0) return existing;
  return [...existing, ...fresh].sort(compareRows);
}

export function hasMoreAfterPage(pageLength: number): boolean {
  return pageLength >= CHAT_PAGE_SIZE;
}

export interface LayoutFlags {
  showDateSeparator: boolean;
  isFirstInGroup:    boolean;
  isLastInGroup:     boolean;
}

/**
 * Flags for a cell of an inverted (newest-first) list. "Visually above" is index + 1,
 * "visually below" is index - 1.
 */
export function computeLayoutFlags<T extends ChatRow>(
  newestFirst: T[],
  index:       number,
  sameGroup:   (a: T, b: T) => boolean,
): LayoutFlags {
  const item  = newestFirst[index];
  const above = index + 1 < newestFirst.length ? newestFirst[index + 1] : null;
  const below = index > 0 ? newestFirst[index - 1] : null;
  const day   = (m: T) => new Date(m.created_at);

  const showDateSeparator = above === null || !isSameDay(day(above), day(item));
  const isFirstInGroup    = showDateSeparator || above === null || !sameGroup(above, item);
  const isLastInGroup     =
    below === null || !sameGroup(item, below) || !isSameDay(day(item), day(below));

  return { showDateSeparator, isFirstInGroup, isLastInGroup };
}

export type ScrollDecision = 'none' | 'scrollToLatest' | 'showHint';

/**
 * Decides what to do when the list's newest message changes. Near the latest message the
 * list follows natively (maintainVisibleContentPosition.autoscrollToTopThreshold), so JS
 * issues no competing scroll command.
 */
export function decideScrollOnNewest(args: {
  prevNewestId: string | null;
  newestId:     string | null;
  newestIsOwn:  boolean;
  nearLatest:   boolean;
}): ScrollDecision {
  const { prevNewestId, newestId, newestIsOwn, nearLatest } = args;
  if (prevNewestId === null || newestId === null || newestId === prevNewestId) return 'none';
  if (nearLatest) return 'none';
  return newestIsOwn ? 'scrollToLatest' : 'showHint';
}
```

- [ ] **Step 4: Tests grün**

Run: `npx jest src/utils/chatMessages.test.ts && npx tsc --noEmit`
Expected: PASS, tsc ohne Fehler

- [ ] **Step 5: Commit**

```bash
git add src/utils/chatMessages.ts src/utils/chatMessages.test.ts
git commit -m "feat(chat): pure Merge-/Layout-/Scroll-Logik fuer Gruppenchats"
```

---

### Task 2: Hooks: Paginierung, race-freies Laden, Nachholen, stabile Abhängigkeiten

**Files:**
- Modify: `src/hooks/useSparringGroupChat.ts` (ganzer Lade-/Subscribe-Teil)
- Modify: `src/hooks/useEventGroupChat.ts` (analog)

**Interfaces:**
- Consumes: `mergeMessages`, `CHAT_PAGE_SIZE`, `hasMoreAfterPage` aus Task 1.
- Produces (beide Hooks, zusätzlich zu den bestehenden Feldern): `loadingOlder: boolean`, `hasMore: boolean`, `loadOlder: () => Promise<void>`.

Änderungen am Beispiel `useSparringGroupChat`. Für `useEventGroupChat` identisch mit Tabelle `event_messages`, Filter `event_id`, Sender-Feld `user_id` und ohne `sendImage`.

- [ ] **Step 1: Sender-Anreicherung als Funktion (lokal im Hook)**

```ts
// Resolves names/avatars for unknown senders and caches them in refs.
const enrichRows = useCallback(async (rows: SparringGroupMessage[]): Promise<GroupMessageWithSender[]> => {
  const missing = [...new Set(rows.map((r) => r.sender_id))].filter((id) => !senderNamesRef.current.has(id));
  if (userId !== null && !senderNamesRef.current.has(userId)) missing.push(userId);
  if (missing.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url').in('id', missing);
    for (const p of profiles ?? []) {
      senderNamesRef.current.set(p.id, p.name);
      senderAvatarsRef.current.set(p.id, p.avatar_url ?? null);
    }
    // Remember unresolved ids too, so we do not refetch them for every message.
    for (const id of missing) if (!senderNamesRef.current.has(id)) senderNamesRef.current.set(id, null);
  }
  return rows.map((row) => ({
    ...row,
    senderName:      senderNamesRef.current.get(row.sender_id) ?? null,
    senderAvatarUrl: senderAvatarsRef.current.get(row.sender_id) ?? null,
  }));
}, [userId]);
```

mit `const userId = user?.id ?? null;` (Befund 5: Abhängigkeit auf die stabile ID statt auf das Objekt).

- [ ] **Step 2: Seitenweises Laden + Nachholen**

```ts
const [loadingOlder, setLoadingOlder] = useState(false);
const [hasMore,      setHasMore]      = useState(false);
const messagesRef = useRef<GroupMessageWithSender[]>([]);
useEffect(() => { messagesRef.current = messages; }, [messages]);

const fetchRows = useCallback(async (opts: { before?: string; after?: string }) => {
  let q = supabase.from('sparring_group_messages').select('*').eq('sparring_id', sparringId);
  if (opts.after !== undefined) {
    // Catch-up after reconnect/foreground: everything newer than what we show.
    q = q.gt('created_at', opts.after).order('created_at', { ascending: true }).limit(CHAT_PAGE_SIZE * 4);
    const { data } = await q;
    return data ?? [];
  }
  if (opts.before !== undefined) q = q.lt('created_at', opts.before);
  const { data } = await q.order('created_at', { ascending: false }).limit(CHAT_PAGE_SIZE);
  return (data ?? []).reverse();
}, [sparringId]);

const addRows = useCallback(async (rows: SparringGroupMessage[]) => {
  if (rows.length === 0) return;
  const enriched = await enrichRows(rows);
  setMessages((prev) => mergeMessages(prev, enriched));
}, [enrichRows]);

const loadOlder = useCallback(async () => {
  const oldest = messagesRef.current[0];
  if (oldest === undefined || loadingOlder || !hasMore) return;
  setLoadingOlder(true);
  const rows = await fetchRows({ before: oldest.created_at });
  await addRows(rows);
  setHasMore(hasMoreAfterPage(rows.length));
  setLoadingOlder(false);
}, [addRows, fetchRows, hasMore, loadingOlder]);

const catchUp = useCallback(async () => {
  const newest = messagesRef.current[messagesRef.current.length - 1];
  if (newest === undefined) return;
  await addRows(await fetchRows({ after: newest.created_at }));
}, [addRows, fetchRows]);
```

- [ ] **Step 3: Effect: erst abonnieren, dann laden; Reconnect + Vordergrund**

```ts
useEffect(() => {
  let joinedOnce = false;
  const channel = supabase
    .channel(`sparring-group-chat-${sparringId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sparring_group_messages', filter: `sparring_id=eq.${sparringId}` },
      (payload) => {
        const newRow = payload.new as unknown as SparringGroupMessage;
        if (!newRow?.id) return;
        // Merge (sorted + deduped) instead of append: out-of-order profile lookups stay ordered.
        void addRows([newRow]).then(() => markRead());
      },
    )
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      // Re-join after a socket drop: fetch what we missed.
      if (joinedOnce) void catchUp();
      joinedOnce = true;
    });
  channelRef.current = channel;

  // Initial page after subscribing; merge keeps any realtime row that raced ahead.
  void (async () => {
    const rows = await fetchRows({});
    await addRows(rows);
    setHasMore(hasMoreAfterPage(rows.length));
    setLoading(false);
  })();
  void markRead();

  const appSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') void catchUp();
  });

  return () => {
    appSub.remove();
    void supabase.removeChannel(channel);
  };
}, [sparringId, addRows, catchUp, fetchRows, markRead]);
```

`markRead` bekommt `[sparringId, userId]` als Deps und prüft `userId === null`. `AppState` aus `react-native` importieren. `sendText` führt die Insert-Antwort per `setMessages((prev) => mergeMessages(prev, [{ ...newRow, senderName, senderAvatarUrl }]))` zusammen. `loadMessages` entfällt. Wichtig: `sparringId` ändert sich pro Screen-Instanz nicht. Ein Wechsel würde alten State mischen. Deshalb bei einem `sparringId`-Wechsel `messagesRef`, State und `hasMore` am Effect-Anfang zurücksetzen:

```ts
setMessages([]); setLoading(true); setHasMore(false);
```

(als erste Zeilen im Effect).

- [ ] **Step 4: Rückgabe erweitern**

`UseSparringGroupChat` bekommt `loadingOlder: boolean; hasMore: boolean; loadOlder: () => Promise<void>;`. Diese Felder werden zurückgegeben.

- [ ] **Step 5: Prüfen**

Run: `npx tsc --noEmit && npx jest`
Expected: grün. Zusätzlich per `grep -n "\[.*user[,\]]" src/hooks/useSparringGroupChat.ts src/hooks/useEventGroupChat.ts` sicherstellen, dass kein Dependency-Array mehr `user` (Objekt) enthält.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSparringGroupChat.ts src/hooks/useEventGroupChat.ts
git commit -m "fix(chat): Paginierung, race-freies Laden, Nachholen nach Reconnect"
```

---

### Task 3: Eingabefeld isolieren (`ChatComposer`)

**Files:**
- Create: `src/components/chat/ChatComposer.tsx`
- Modify: `src/screens/SparringGroupChatScreen.tsx` (Input-Row + `handleSend`)
- Modify: `src/screens/EventGroupChatScreen.tsx` (Input-Row + `handleSend`)

**Interfaces:**
- Produces: `ChatComposer` Props `{ sending: boolean; bottomInset: number; onSend: (text: string) => Promise<boolean>; leading?: React.ReactNode }`. Gibt `onSend` `true` zurück, wird das Feld geleert.

- [ ] **Step 1: Komponente**

```tsx
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface Props {
  sending:     boolean;
  bottomInset: number;
  onSend:      (text: string) => Promise<boolean>;
  leading?:    React.ReactNode;
}

// Owns the draft text so keystrokes re-render only this row, not the message list.
export default function ChatComposer({ sending, bottomInset, onSend, leading }: Props) {
  const [text, setText] = useState('');
  const disabled = text.trim().length === 0 || sending;

  async function submit() {
    const trimmed = text.trim();
    if (trimmed.length === 0 || sending) return;
    if (await onSend(trimmed)) setText('');
  }

  return (
    <View style={[styles.inputRow, { paddingBottom: bottomInset + 8 }]}>
      {leading}
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Nachricht..."
        placeholderTextColor={colors.textSecondary}
        multiline
        returnKeyType="send"
        onSubmitEditing={() => { void submit(); }}
        blurOnSubmit
      />
      <TouchableOpacity
        style={[styles.sendBtn, disabled && styles.sendBtnDisabled]}
        onPress={() => { void submit(); }}
        disabled={disabled}
      >
        {sending
          ? <ActivityIndicator size="small" color={colors.card} />
          : <Ionicons name="send" size={18} color={colors.card} />}
      </TouchableOpacity>
    </View>
  );
}
```

`styles`: `inputRow`, `input`, `sendBtn` und `sendBtnDisabled` 1:1 aus `EventGroupChatScreen.tsx` (Zeilen ca. 304–337) kopieren. Vorher mit `diff` prüfen, dass die Sparring-Variante identisch ist. Weicht sie ab, die Sparring-Werte übernehmen und die Abweichung im Commit notieren. `React.memo` ist nicht nötig: Der Screen rendert beim Tippen nicht mehr neu.

- [ ] **Step 2: Screens umstellen**

Sparring:
```tsx
async function handleSend(text: string): Promise<boolean> {
  const verdict = checkText(text, bannedWords);
  if (!verdict.ok) {
    Alert.alert('Nachricht blockiert', filterErrorMessage(verdict.category));
    return false;
  }
  const { error } = await sendText(text);
  if (error === null) requestScrollToLatest();   // from Task 4
  return error === null;
}
...
<ChatComposer
  sending={sending}
  bottomInset={insets.bottom}
  onSend={handleSend}
  leading={mediaEnabled ? <ChatImagePicker onImageSelected={(uri) => { void sendImage(uri); }} disabled={sending} /> : null}
/>
```
Event: analog ohne Filter und ohne `leading`. `inputText`/`setInputText`, `TextInput` und die entfernten Styles aus beiden Screens löschen (nur die jetzt ungenutzten). `requestScrollToLatest` kommt aus Task 4. Wird Task 3 vor Task 4 umgesetzt, diese Zeile erst in Task 4 ergänzen.

- [ ] **Step 3: Prüfen**

Run: `npx tsc --noEmit`
Expected: keine Fehler, keine ungenutzten Imports (`TextInput` etc. entfernen).

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/ChatComposer.tsx src/screens/SparringGroupChatScreen.tsx src/screens/EventGroupChatScreen.tsx
git commit -m "perf(chat): Eingabe-State in ChatComposer isoliert"
```

---

### Task 4: Invertierte Liste, Leseposition, Nachladen, Hinweis „Neue Nachrichten“

**Files:**
- Create: `src/hooks/useChatListScroll.ts`
- Create: `src/components/chat/NewMessagesPill.tsx`
- Modify: `src/screens/SparringGroupChatScreen.tsx` (FlatList-Block)
- Modify: `src/screens/EventGroupChatScreen.tsx` (FlatList-Block)

**Interfaces:**
- Consumes: `computeLayoutFlags`, `decideScrollOnNewest` (Task 1); `loadOlder`, `hasMore`, `loadingOlder` (Task 2).
- Produces: `useChatListScroll<T extends ChatRow>(newestFirst: T[], isOwn: (m: T) => boolean)` → `{ listRef: React.RefObject<FlatList<T> | null>; onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void; showHint: boolean; scrollToLatest: () => void; requestScrollToLatest: () => void }`.

- [ ] **Step 1: Hook**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { decideScrollOnNewest, type ChatRow } from '../utils/chatMessages';

// In an inverted list offset 0 is the latest message.
const NEAR_LATEST_PX = 80;

export function useChatListScroll<T extends ChatRow>(newestFirst: T[], isOwn: (m: T) => boolean) {
  const listRef       = useRef<FlatList<T>>(null);
  const nearLatestRef = useRef(true);
  const prevNewestRef = useRef<string | null>(null);
  const forceRef      = useRef(false);
  const [showHint, setShowHint] = useState(false);

  const scrollToLatest = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setShowHint(false);
  }, []);

  // Own send: reveal it on the next newest-change, regardless of scroll position.
  const requestScrollToLatest = useCallback(() => { forceRef.current = true; }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const near = e.nativeEvent.contentOffset.y < NEAR_LATEST_PX;
    nearLatestRef.current = near;
    if (near) setShowHint(false);
  }, []);

  const newest = newestFirst[0] ?? null;
  useEffect(() => {
    const decision = decideScrollOnNewest({
      prevNewestId: prevNewestRef.current,
      newestId:     newest?.id ?? null,
      newestIsOwn:  forceRef.current || (newest !== null && isOwn(newest)),
      nearLatest:   nearLatestRef.current,
    });
    prevNewestRef.current = newest?.id ?? null;
    if (decision === 'scrollToLatest') { forceRef.current = false; scrollToLatest(); }
    else if (decision === 'showHint') setShowHint(true);
    else if (newest !== null && forceRef.current) forceRef.current = false;
    // isOwn is a stable per-screen predicate; only newest changes matter here.
  }, [newest?.id, scrollToLatest]);

  return { listRef, onScroll, showHint, scrollToLatest, requestScrollToLatest };
}
```

- [ ] **Step 2: Pill**

```tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export default function NewMessagesPill({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.pill} onPress={onPress} accessibilityRole="button">
      <Ionicons name="arrow-down" size={16} color={colors.card} />
      <Text style={styles.label}>Neue Nachrichten</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute', alignSelf: 'center', bottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24,
    backgroundColor: colors.accentBlue,
  },
  label: { color: colors.card, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
```

Den Font-Namen vorher per `grep -rn "fontFamily" src/components/chat | head -3` prüfen und den im Projekt verwendeten Namen übernehmen.

- [ ] **Step 3: Screens: FlatList ersetzen (Sparring; Event analog mit `user_id`, ohne `is_system`)**

```tsx
const newestFirst = useMemo(() => [...messages].reverse(), [messages]);
const isOwnMsg = useCallback((m: GroupMessageWithSender) => m.sender_id === user?.id, [user?.id]);
const { listRef, onScroll, showHint, scrollToLatest, requestScrollToLatest } =
  useChatListScroll(newestFirst, isOwnMsg);

const sameGroup = useCallback(
  (a: GroupMessageWithSender, b: GroupMessageWithSender) =>
    a.sender_id === b.sender_id && !a.is_system && !b.is_system,
  [],
);

const renderItem = useCallback(({ item, index }: ListRenderItemInfo<GroupMessageWithSender>) => {
  const f = computeLayoutFlags(newestFirst, index, sameGroup);
  return (
    <>
      {f.showDateSeparator && <ChatDateSeparator label={chatDateLabel(item.created_at)} />}
      <GroupMessageBubble message={item} isOwn={user?.id === item.sender_id}
        isFirstInGroup={f.isFirstInGroup} isLastInGroup={f.isLastInGroup} />
    </>
  );
}, [newestFirst, sameGroup, user?.id]);
```

Im invertierten Rendering steht die Fragment-Reihenfolge „Separator, dann Bubble“ visuell ebenfalls korrekt: Separator oben, Bubble darunter. Die Zelle wird als Ganzes gespiegelt, ihr Inhalt nicht.

```tsx
<View style={styles.listWrap}>
  <FlatList
    ref={listRef}
    inverted
    data={newestFirst}
    keyExtractor={(m) => m.id}
    renderItem={renderItem}
    contentContainerStyle={styles.messageList}
    onScroll={onScroll}
    scrollEventThrottle={100}
    maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 80 }}
    onEndReached={() => { if (hasMore) void loadOlder(); }}
    onEndReachedThreshold={0.5}
    ListFooterComponent={loadingOlder ? <ActivityIndicator style={styles.olderLoader} color={colors.accentBlue} /> : null}
    keyboardDismissMode="interactive"
    keyboardShouldPersistTaps="handled"
  />
  {showHint && <NewMessagesPill onPress={scrollToLatest} />}
</View>
```

Styles: `listWrap: { flex: 1 }` und `olderLoader: { paddingVertical: 16 }`. `messageList`-Padding prüfen: In einer invertierten Liste sind `paddingTop`/`paddingBottom` visuell vertauscht, deshalb die Werte tauschen. `onContentSizeChange` und `isNearBottomRef` entfernen, ebenso `isNearBottomRef.current = true` in `handleSend`. `ListEmptyComponent` (Event): visuell im Simulator prüfen, ob der Text richtig herum steht. Steht er kopfüber, den Container mit `transform: [{ scaleY: -1 }]` im StyleSheet versehen.

- [ ] **Step 4: Prüfen**

Run: `npx tsc --noEmit && npx jest`
Expected: grün.

Danach im iOS-Simulator (`npx expo run:ios`) und im Android-Emulator (`npx expo run:android`) je einen Chat öffnen und prüfen:
1. Öffnen startet unten, ohne sichtbares Nachscrollen.
2. Hochscrollen bis Anfang: Spinner oben, ältere Seite erscheint, der sichtbare Text springt nicht.
3. Nach oben gescrollt, zweiter Account sendet: Pill erscheint, kein Springen. Tap auf die Pill: nach unten.
4. Unten stehend, zweiter Account sendet: Liste folgt.
5. Eigene Nachricht senden, während nach oben gescrollt: springt nach unten.
6. Tastatur öffnen und schließen: letzte Nachricht bleibt sichtbar.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useChatListScroll.ts src/components/chat/NewMessagesPill.tsx src/screens/SparringGroupChatScreen.tsx src/screens/EventGroupChatScreen.tsx
git commit -m "perf(chat): invertierte Liste, Nachladen mit Leseposition, Hinweis auf neue Nachrichten"
```

---

### Task 5: Regeln für künftige Änderungen

**Files:**
- Create: `docs/ui-performance.md`
- Modify: `CLAUDE.md` (neuer kurzer Abschnitt nach „Kritische Fallstricke“)

- [ ] **Step 1: `docs/ui-performance.md`** mit diesen Abschnitten (knapp, keine Audit-Berichte):
  1. **Wann prüfen:** Textänderung → nichts. Chat/Liste/Animation/Sheet/geteilter State/Hook mit Realtime → gezielte Szenarien unten.
  2. **Regeln Listen/Chats:** FlatList mit stabilem `keyExtractor`. Nie `ScrollView` + `.map` über unbeschränkte DB-Daten. Chats invertiert + paginiert (`CHAT_PAGE_SIZE`). Merge immer über `mergeMessages`. Realtime *vor* Initial-Load abonnieren. Nach Reconnect/Vordergrund nachholen. Deps auf `user?.id`, nie auf `user`. Kein `scrollToEnd` in `onContentSizeChange`.
  3. **Regeln Eingabe:** Draft-State in eigener Komponente (`ChatComposer`-Muster), nicht im Screen mit großer Liste.
  4. **Regeln Animation:** zeitkritisch über Reanimated (UI-Thread) oder `useNativeDriver: true` für transform/opacity. `useNativeDriver: false` nur für Layout-Props mit Begründung. Kein setState pro Frame. Bei neuen Dauer-/Eingangsanimationen `useReducedMotion()` (Reanimated) respektieren.
  5. **Memoisierung:** React Compiler ist nicht aktiv. `memo`/`useCallback` gezielt für Listen-Zellen und deren Props, nicht pauschal.
  6. **Bilder:** feste Abmessungen in Listen. Keine Bibliothek ohne Messung einführen.
  7. **Prüfszenarien** (vor/nach, Release-Build, echtes Gerät inkl. älterem Android): die sieben Szenarien aus dem Auftrag, jeweils mit dem Werkzeug. Perf Monitor (Dev-Menü) für JS-/UI-FPS und einzelne Einbrüche. Android: `adb shell dumpsys gfxinfo <package> framestats` für Jank-Frames. iOS: Instruments „Animation Hitches“. Langsames Netz: iOS Network Link Conditioner / Android-Emulator `Cellular → Network type: EDGE`.
  8. **Agenten-/Modellstrategie:** Haiku = eng begrenzte Fundstellensuche (Explore, `model: haiku`), nie Architekturentscheidung oder Freigabe. Sonnet = Ursachenanalyse, Implementierung, gezielte Prüfung. Opus = bereichsübergreifende oder ungeklärte Ursachen, Koordination, Abschlussreview. Klein = inline. Befunde vor Änderung im Code verifizieren. Keine parallelen Edits derselben Datei.

- [ ] **Step 2: CLAUDE.md-Abschnitt** (max. ca. 6 Zeilen):

```markdown
## UI-Performance
Vor Arbeit an Chats, Listen, Animationen, Sheets oder geteiltem State `docs/ui-performance.md` lesen
und die dort passenden Prüfszenarien durchführen (Umfang nach Änderung: Textänderung = keine).
Kernregeln: Listen virtualisiert + paginiert, Chat-Merge über `src/utils/chatMessages.ts`, Draft-State
nicht im Listen-Screen, zeitkritische Animationen auf dem UI-Thread, keine setState pro Frame.
tsc/jest belegen keine flüssige Darstellung. Laufzeit nur per Release-Build auf Gerät bewerten.
```

- [ ] **Step 3: Commit**

```bash
git add docs/ui-performance.md CLAUDE.md
git commit -m "docs: UI-Performance-Regeln und Pruefszenarien"
```

Achtung: `CLAUDE.md` hat eventuell uncommittete Nutzeränderungen. Vorher `git diff CLAUDE.md` prüfen. Falls vorhanden, nur den eigenen Abschnitt per `git add -p` stagen oder den Commit für CLAUDE.md dem Nutzer überlassen.

---

### Task 6: Abschluss-Verifikation + Vault

- [ ] `npx tsc --noEmit && npx jest`: Ausgabe festhalten.
- [ ] Review des Branch-Diffs (nur Task-Dateien) durch einen frischen Reviewer.
- [ ] Vault: `Dev-Log/2026-09-25.md` (anhängen mit `---`, falls der Eintrag schon existiert) und `Offene-Punkte.md` (Befund 10 Android-Tastatur, offene Geräteszenarien, Folge-Plan Animationen/Listen).
- [ ] Abschlussbericht an den Nutzer mit konkreten Geräteschritten (Szenarien aus `docs/ui-performance.md`).
