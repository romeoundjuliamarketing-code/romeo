# Sparring Group Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 1-on-1 sparring chat with per-sparring group chats, accessible via a chat button on the map.

**Architecture:** Three new DB tables (`sparring_group_messages`, `sparring_chat_settings`, `sparring_chat_reads`) back three new hooks. Two new screens (list + chat) navigate as NativeStack modals. A floating button on `SparringMapView` opens the list with an unread badge. Old `SparringChatScreen` and `useSparringChat` are deleted.

**Tech Stack:** React Native, Supabase Postgres + Realtime, expo-image-picker, expo-file-system, base64-arraybuffer, @expo/vector-icons

---

## File Map

### New
- `supabase/migrations/20260602140000_add_sparring_group_chat.sql`
- `src/hooks/useSparringChatSettings.ts`
- `src/hooks/useSparringGroupChat.ts`
- `src/hooks/useSparringChatList.ts`
- `src/components/chat/UnreadBadge.tsx`
- `src/components/chat/GroupMessageBubble.tsx`
- `src/components/chat/ChatImagePicker.tsx`
- `src/components/chat/SparringChatListItem.tsx`
- `src/screens/SparringChatListScreen.tsx`
- `src/screens/SparringGroupChatScreen.tsx`

### Modified
- `src/types/database.types.ts` — add 3 table types + convenience exports
- `src/navigation/types.ts` — replace SparringChat with SparringGroupChat + SparringChatList
- `src/navigation/RootNavigator.tsx` — register new screens, remove old
- `src/components/sparring/SparringMapView.types.ts` — add `totalUnread` + `onChatPress` props
- `src/components/sparring/SparringMapView.ios.tsx` — add chat button
- `src/components/sparring/SparringMapView.android.tsx` — add chat button
- `src/screens/SparringMapScreen.tsx` — wire totalUnread + onChatPress
- `src/hooks/useSparringActions.ts` — auto-create `sparring_chat_settings` on createSparring
- `src/components/sparring/SparringDetailSheet.tsx` — remove 1-on-1 chat links
- `src/components/sparring/SparringParticipantsList.tsx` — remove `onPressChat` prop

### Deleted
- `src/screens/SparringChatScreen.tsx`
- `src/hooks/useSparringChat.ts`

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260602140000_add_sparring_group_chat.sql`

- [ ] **Schreibe die Migration**

```sql
-- sparring_chat_settings: per-sparring media toggle, owned by organizer
CREATE TABLE sparring_chat_settings (
  sparring_id   uuid PRIMARY KEY REFERENCES open_sparrings(id) ON DELETE CASCADE,
  media_enabled boolean NOT NULL DEFAULT false
);

ALTER TABLE sparring_chat_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member reads settings" ON sparring_chat_settings
  FOR SELECT USING (
    auth.uid() = (SELECT created_by FROM open_sparrings WHERE id = sparring_id)
    OR EXISTS (
      SELECT 1 FROM sparring_signups
      WHERE sparring_id = sparring_chat_settings.sparring_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "organizer inserts settings" ON sparring_chat_settings
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT created_by FROM open_sparrings WHERE id = sparring_id)
  );

CREATE POLICY "organizer updates settings" ON sparring_chat_settings
  FOR UPDATE USING (
    auth.uid() = (SELECT created_by FROM open_sparrings WHERE id = sparring_id)
  );

-- sparring_group_messages: the group chat messages
CREATE TABLE sparring_group_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sparring_id uuid        NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  sender_id   uuid        NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  content     text,
  image_url   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_or_image CHECK (content IS NOT NULL OR image_url IS NOT NULL)
);

CREATE INDEX sparring_group_messages_sparring_idx
  ON sparring_group_messages (sparring_id, created_at);

ALTER TABLE sparring_group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member reads messages" ON sparring_group_messages
  FOR SELECT USING (
    auth.uid() = (SELECT created_by FROM open_sparrings WHERE id = sparring_id)
    OR EXISTS (
      SELECT 1 FROM sparring_signups
      WHERE sparring_id = sparring_group_messages.sparring_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "member inserts message" ON sparring_group_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND (
      auth.uid() = (SELECT created_by FROM open_sparrings WHERE id = sparring_id)
      OR EXISTS (
        SELECT 1 FROM sparring_signups
        WHERE sparring_id = sparring_group_messages.sparring_id
          AND user_id = auth.uid()
      )
    )
    AND (
      SELECT scheduled_at + (duration_min || ' minutes')::interval
      FROM open_sparrings WHERE id = sparring_id
    ) > now()
    AND (
      image_url IS NULL
      OR EXISTS (
        SELECT 1 FROM sparring_chat_settings
        WHERE sparring_id = sparring_group_messages.sparring_id
          AND media_enabled = true
      )
    )
  );

-- sparring_chat_reads: tracks per-user last-read timestamp for unread counts
CREATE TABLE sparring_chat_reads (
  user_id      uuid        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  sparring_id  uuid        NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sparring_id)
);

ALTER TABLE sparring_chat_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user manages own reads" ON sparring_chat_reads
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Führe die Migration aus**

```bash
# Via Supabase MCP (apply_migration mit name "add_sparring_group_chat")
# Oder via CLI:
$HOME/.local/share/supabase/supabase db push --project-ref lkgrnuwtnifnmghthbog
```

- [ ] **Commit**

```bash
git add supabase/migrations/20260602140000_add_sparring_group_chat.sql
git commit -m "feat(db): add sparring group chat tables and RLS"
```

---

## Task 2: database.types.ts

**Files:**
- Modify: `src/types/database.types.ts`

- [ ] **Füge die drei Tabellen-Typen ein** — direkt nach dem `sparring_messages`-Block (nach Zeile ~449):

```ts
      sparring_chat_settings: {
        Row: {
          sparring_id:   string
          media_enabled: boolean
        }
        Insert: {
          sparring_id:    string
          media_enabled?: boolean
        }
        Update: {
          sparring_id?:   string
          media_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'sparring_chat_settings_sparring_id_fkey'
            columns: ['sparring_id']
            isOneToOne: true
            referencedRelation: 'open_sparrings'
            referencedColumns: ['id']
          },
        ]
      }
      sparring_group_messages: {
        Row: {
          id:          string
          sparring_id: string
          sender_id:   string
          content:     string | null
          image_url:   string | null
          created_at:  string
        }
        Insert: {
          id?:         string
          sparring_id: string
          sender_id:   string
          content?:    string | null
          image_url?:  string | null
          created_at?: string
        }
        Update: {
          id?:          string
          sparring_id?: string
          sender_id?:   string
          content?:     string | null
          image_url?:   string | null
          created_at?:  string
        }
        Relationships: [
          {
            foreignKeyName: 'sparring_group_messages_sparring_id_fkey'
            columns: ['sparring_id']
            isOneToOne: false
            referencedRelation: 'open_sparrings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sparring_group_messages_sender_id_fkey'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      sparring_chat_reads: {
        Row: {
          user_id:      string
          sparring_id:  string
          last_read_at: string
        }
        Insert: {
          user_id:       string
          sparring_id:   string
          last_read_at?: string
        }
        Update: {
          user_id?:      string
          sparring_id?:  string
          last_read_at?: string
        }
        Relationships: []
      }
```

- [ ] **Füge Convenience-Exporte am Ende der Datei ein** (nach der `SparringMessage`-Zeile):

```ts
export type SparringGroupMessage       = Database['public']['Tables']['sparring_group_messages']['Row']
export type SparringGroupMessageInsert = Database['public']['Tables']['sparring_group_messages']['Insert']
export type SparringChatSettings       = Database['public']['Tables']['sparring_chat_settings']['Row']
export type SparringChatReads          = Database['public']['Tables']['sparring_chat_reads']['Row']
```

- [ ] **tsc prüfen**

```bash
npx tsc --noEmit
```
Erwartet: 0 Fehler

- [ ] **Commit**

```bash
git add src/types/database.types.ts
git commit -m "feat(types): add sparring group chat table types"
```

---

## Task 3: useSparringChatSettings

**Files:**
- Create: `src/hooks/useSparringChatSettings.ts`

- [ ] **Erstelle den Hook**

```ts
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export interface UseSparringChatSettings {
  mediaEnabled:  boolean;
  loading:       boolean;
  toggleMedia:   () => Promise<void>;
}

export function useSparringChatSettings(
  sparringId:  string,
  isOrganizer: boolean,
): UseSparringChatSettings {
  const { user } = useAuth();
  const [mediaEnabled, setMediaEnabled] = useState(false);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('sparring_chat_settings')
        .select('media_enabled')
        .eq('sparring_id', sparringId)
        .maybeSingle();
      if (!cancelled) {
        setMediaEnabled(data?.media_enabled ?? false);
        setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [sparringId]);

  const toggleMedia = useCallback(async () => {
    if (!isOrganizer || user === null) return;
    const next = !mediaEnabled;
    setMediaEnabled(next);
    await supabase
      .from('sparring_chat_settings')
      .update({ media_enabled: next })
      .eq('sparring_id', sparringId);
  }, [isOrganizer, mediaEnabled, sparringId, user]);

  return { mediaEnabled, loading, toggleMedia };
}
```

- [ ] **tsc prüfen**

```bash
npx tsc --noEmit
```
Erwartet: 0 Fehler

- [ ] **Commit**

```bash
git add src/hooks/useSparringChatSettings.ts
git commit -m "feat(hooks): add useSparringChatSettings"
```

---

## Task 4: useSparringGroupChat

**Files:**
- Create: `src/hooks/useSparringGroupChat.ts`

- [ ] **Erstelle den Hook**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { SparringGroupMessage } from '../types/database.types';

export interface GroupMessageWithSender extends SparringGroupMessage {
  senderName: string | null;
}

export interface UseSparringGroupChat {
  messages:    GroupMessageWithSender[];
  loading:     boolean;
  sending:     boolean;
  isReadOnly:  boolean;
  sendText:    (content: string) => Promise<void>;
  sendImage:   (localUri: string) => Promise<void>;
  markRead:    () => Promise<void>;
}

function computeIsReadOnly(scheduledAt: string, durationMin: number): boolean {
  return new Date(scheduledAt).getTime() + durationMin * 60_000 < Date.now();
}

export function useSparringGroupChat(
  sparringId:  string,
  scheduledAt: string,
  durationMin: number,
): UseSparringGroupChat {
  const { user } = useAuth();
  const [messages, setMessages] = useState<GroupMessageWithSender[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isReadOnly = computeIsReadOnly(scheduledAt, durationMin);

  const loadMessages = useCallback(async () => {
    const { data: rows } = await supabase
      .from('sparring_group_messages')
      .select('*')
      .eq('sparring_id', sparringId)
      .order('created_at', { ascending: true });

    const senderIds = [...new Set((rows ?? []).map((r) => r.sender_id))];
    const { data: profiles } = senderIds.length > 0
      ? await supabase.from('profiles').select('id, name').in('id', senderIds)
      : { data: [] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.name]));

    const enriched: GroupMessageWithSender[] = (rows ?? []).map((row) => ({
      id:          row.id,
      sparring_id: row.sparring_id,
      sender_id:   row.sender_id,
      content:     row.content,
      image_url:   row.image_url,
      created_at:  row.created_at,
      senderName:  nameMap.get(row.sender_id) ?? null,
    }));
    setMessages(enriched);
    setLoading(false);
  }, [sparringId]);

  const markRead = useCallback(async () => {
    if (user === null) return;
    await supabase.from('sparring_chat_reads').upsert(
      { user_id: user.id, sparring_id: sparringId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,sparring_id' },
    );
  }, [sparringId, user]);

  useEffect(() => {
    void loadMessages();
    void markRead();

    channelRef.current = supabase
      .channel(`sparring-group-chat-${sparringId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sparring_group_messages', filter: `sparring_id=eq.${sparringId}` },
        async () => {
          await loadMessages();
          await markRead();
        },
      )
      .subscribe();

    return () => {
      if (channelRef.current !== null) {
        void supabase.removeChannel(channelRef.current);
      }
    };
  }, [sparringId, loadMessages, markRead]);

  const sendText = useCallback(async (content: string) => {
    if (user === null || isReadOnly) return;
    setSending(true);
    await supabase.from('sparring_group_messages').insert({
      sparring_id: sparringId,
      sender_id:   user.id,
      content,
    });
    setSending(false);
  }, [isReadOnly, sparringId, user]);

  const sendImage = useCallback(async (localUri: string) => {
    if (user === null || isReadOnly) return;
    setSending(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const ext      = localUri.split('.').pop() ?? 'jpg';
      const filename = `${sparringId}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filename, decode(base64), { contentType: `image/${ext}` });

      if (uploadError !== null || uploadData === null) {
        console.warn('[useSparringGroupChat] image upload error', uploadError);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('chat-images')
        .getPublicUrl(uploadData.path);

      await supabase.from('sparring_group_messages').insert({
        sparring_id: sparringId,
        sender_id:   user.id,
        image_url:   urlData.publicUrl,
      });
    } finally {
      setSending(false);
    }
  }, [isReadOnly, sparringId, user]);

  return { messages, loading, sending, isReadOnly, sendText, sendImage, markRead };
}
```

- [ ] **tsc prüfen**

```bash
npx tsc --noEmit
```
Erwartet: 0 Fehler

- [ ] **Commit**

```bash
git add src/hooks/useSparringGroupChat.ts
git commit -m "feat(hooks): add useSparringGroupChat"
```

---

## Task 5: useSparringChatList

**Files:**
- Create: `src/hooks/useSparringChatList.ts`

- [ ] **Erstelle den Hook**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export interface SparringChatEntry {
  sparringId:       string;
  sparringTitle:    string;
  scheduledAt:      string;
  durationMin:      number;
  isOrganizer:      boolean;
  lastMessageText:  string | null;
  lastMessageAt:    string | null;
  unreadCount:      number;
}

export interface UseSparringChatList {
  chats:        SparringChatEntry[];
  totalUnread:  number;
  loading:      boolean;
  refetch:      () => Promise<void>;
}

export function useSparringChatList(): UseSparringChatList {
  const { user } = useAuth();
  const [chats,   setChats]   = useState<SparringChatEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    if (user === null) return;
    setLoading(true);

    // Sparrings where user is organizer or has signed up and chat settings exist
    const [signupsRes, organizerRes] = await Promise.all([
      supabase
        .from('sparring_signups')
        .select('sparring_id')
        .eq('user_id', user.id),
      supabase
        .from('open_sparrings')
        .select('id, title, scheduled_at, duration_min, created_by')
        .eq('created_by', user.id),
    ]);

    const signupIds = (signupsRes.data ?? []).map((r) => r.sparring_id);

    // Fetch sparring details for signed-up sparrings
    const signupSparrings = signupIds.length > 0
      ? (await supabase
          .from('open_sparrings')
          .select('id, title, scheduled_at, duration_min, created_by')
          .in('id', signupIds)).data ?? []
      : [];

    // Merge + deduplicate
    const allSparrings = [
      ...(organizerRes.data ?? []),
      ...signupSparrings.filter(
        (s) => !(organizerRes.data ?? []).some((o) => o.id === s.id),
      ),
    ];

    // Only those with chat settings
    const sparringIds = allSparrings.map((s) => s.id);
    if (sparringIds.length === 0) {
      setChats([]);
      setLoading(false);
      return;
    }

    const [settingsRes, lastMsgRes, readsRes] = await Promise.all([
      supabase
        .from('sparring_chat_settings')
        .select('sparring_id')
        .in('sparring_id', sparringIds),
      supabase
        .from('sparring_group_messages')
        .select('sparring_id, content, image_url, created_at')
        .in('sparring_id', sparringIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('sparring_chat_reads')
        .select('sparring_id, last_read_at')
        .eq('user_id', user.id)
        .in('sparring_id', sparringIds),
    ]);

    const withSettings = new Set((settingsRes.data ?? []).map((r) => r.sparring_id));
    const reads        = new Map((readsRes.data ?? []).map((r) => [r.sparring_id, r.last_read_at]));

    // Last message per sparring
    const lastMsgs = new Map<string, { content: string | null; image_url: string | null; created_at: string }>();
    for (const msg of (lastMsgRes.data ?? [])) {
      if (!lastMsgs.has(msg.sparring_id)) {
        lastMsgs.set(msg.sparring_id, { content: msg.content, image_url: msg.image_url, created_at: msg.created_at });
      }
    }

    // Unread counts: count messages newer than last_read_at
    const unreadMap = new Map<string, number>();
    for (const msg of (lastMsgRes.data ?? [])) {
      const lastRead = reads.get(msg.sparring_id) ?? '1970-01-01';
      if (msg.created_at > lastRead) {
        unreadMap.set(msg.sparring_id, (unreadMap.get(msg.sparring_id) ?? 0) + 1);
      }
    }

    const entries: SparringChatEntry[] = allSparrings
      .filter((s) => withSettings.has(s.id))
      .map((s) => {
        const last       = lastMsgs.get(s.id) ?? null;
        const unread     = unreadMap.get(s.id) ?? 0;
        const lastText   = last?.content ?? (last?.image_url !== null ? 'Bild' : null);
        return {
          sparringId:      s.id,
          sparringTitle:   s.title,
          scheduledAt:     s.scheduled_at,
          durationMin:     s.duration_min,
          isOrganizer:     s.created_by === user.id,
          lastMessageText: lastText ?? null,
          lastMessageAt:   last?.created_at ?? null,
          unreadCount:     unread,
        };
      })
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

    setChats(entries);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();

    channelRef.current = supabase
      .channel('sparring-chat-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sparring_group_messages' }, () => {
        void load();
      })
      .subscribe();

    return () => {
      if (channelRef.current !== null) {
        void supabase.removeChannel(channelRef.current);
      }
    };
  }, [load]);

  const totalUnread = chats.reduce((sum, c) => sum + c.unreadCount, 0);

  return { chats, totalUnread, loading, refetch: load };
}
```

- [ ] **tsc prüfen**

```bash
npx tsc --noEmit
```
Erwartet: 0 Fehler

- [ ] **Commit**

```bash
git add src/hooks/useSparringChatList.ts
git commit -m "feat(hooks): add useSparringChatList"
```

---

## Task 6: Chat-Komponenten

**Files:**
- Create: `src/components/chat/UnreadBadge.tsx`
- Create: `src/components/chat/GroupMessageBubble.tsx`
- Create: `src/components/chat/ChatImagePicker.tsx`
- Create: `src/components/chat/SparringChatListItem.tsx`

- [ ] **UnreadBadge.tsx**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  count: number;
}

export default function UnreadBadge({ count }: Props) {
  if (count === 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{count > 99 ? '99+' : String(count)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth:        18,
    height:          18,
    borderRadius:    9,
    backgroundColor: colors.deleteRed,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 4,
  },
  text: {
    fontSize:   11,
    fontWeight: '700',
    color:      colors.card,
  },
});
```

- [ ] **GroupMessageBubble.tsx**

```tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import type { GroupMessageWithSender } from '../../hooks/useSparringGroupChat';

interface Props {
  message:   GroupMessageWithSender;
  isOwn:     boolean;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export default function GroupMessageBubble({ message, isOwn }: Props) {
  return (
    <View style={[styles.row, isOwn && styles.rowOwn]}>
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        {!isOwn && (
          <Text style={styles.sender}>{message.senderName ?? 'Unbekannt'}</Text>
        )}
        {message.image_url !== null && (
          <Image
            source={{ uri: message.image_url }}
            style={styles.image}
            resizeMode="cover"
          />
        )}
        {message.content !== null && (
          <Text style={[styles.content, isOwn && styles.contentOwn]}>
            {message.content}
          </Text>
        )}
        <Text style={[styles.time, isOwn && styles.timeOwn]}>{formatTime(message.created_at)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical:    4,
    alignItems:         'flex-start',
  },
  rowOwn: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth:          '75%',
    borderRadius:      16,
    padding:           12,
    backgroundColor:   colors.card,
    shadowColor:       colors.dark,
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.08,
    shadowRadius:      2,
  },
  bubbleOwn: {
    backgroundColor: colors.accentBlue,
  },
  bubbleOther: {
    backgroundColor: colors.card,
  },
  sender: {
    fontSize:     12,
    fontWeight:   '600',
    color:        colors.accentBlue,
    marginBottom:  4,
  },
  image: {
    width:        220,
    height:       160,
    borderRadius: 8,
    marginBottom:  4,
  },
  content: {
    fontSize:  15,
    color:     colors.text,
    lineHeight: 21,
  },
  contentOwn: {
    color: colors.card,
  },
  time: {
    fontSize:  11,
    color:     colors.textSecondary,
    marginTop:  4,
    alignSelf: 'flex-end',
  },
  timeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
});
```

- [ ] **ChatImagePicker.tsx**

```tsx
import React from 'react';
import { TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface Props {
  onImageSelected: (localUri: string) => void;
  disabled:        boolean;
}

export default function ChatImagePicker({ onImageSelected, disabled }: Props) {
  async function pick() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Berechtigung benötigt', 'Bitte erlaube den Zugriff auf deine Fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality:    0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0]!.uri;
      onImageSelected(uri);
    }
  }

  return (
    <TouchableOpacity
      style={[styles.btn, disabled && styles.btnDisabled]}
      onPress={() => { void pick(); }}
      disabled={disabled}
    >
      <Ionicons name="image-outline" size={22} color={disabled ? colors.textSecondary : colors.accentBlue} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width:          40,
    height:         40,
    alignItems:     'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
});
```

- [ ] **SparringChatListItem.tsx**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import UnreadBadge from './UnreadBadge';
import type { SparringChatEntry } from '../../hooks/useSparringChatList';

interface Props {
  item:    SparringChatEntry;
  onPress: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function SparringChatListItem({ item, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.left}>
        <Text style={styles.title} numberOfLines={1}>{item.sparringTitle}</Text>
        <Text style={styles.date}>{formatDate(item.scheduledAt)}</Text>
        {item.lastMessageText !== null && (
          <Text style={styles.preview} numberOfLines={1}>{item.lastMessageText}</Text>
        )}
      </View>
      <UnreadBadge count={item.unreadCount} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 24,
    paddingVertical:   16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: {
    flex: 1,
    gap:   4,
  },
  title: {
    fontSize:   16,
    fontWeight: '600',
    color:      colors.text,
  },
  date: {
    fontSize: 13,
    color:    colors.textSecondary,
  },
  preview: {
    fontSize: 13,
    color:    colors.textSecondary,
  },
});
```

- [ ] **tsc prüfen**

```bash
npx tsc --noEmit
```
Erwartet: 0 Fehler

- [ ] **Commit**

```bash
git add src/components/chat/
git commit -m "feat(components): add UnreadBadge, GroupMessageBubble, ChatImagePicker, SparringChatListItem"
```

---

## Task 7: SparringChatListScreen

**Files:**
- Create: `src/screens/SparringChatListScreen.tsx`

- [ ] **Erstelle den Screen**

```tsx
import React from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { useSparringChatList } from '../hooks/useSparringChatList';
import SparringChatListItem from '../components/chat/SparringChatListItem';
import type { RootStackParamList } from '../navigation/types';
import type { SparringChatEntry } from '../hooks/useSparringChatList';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SparringChatListScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { chats, loading } = useSparringChatList();

  const active   = chats.filter((c) => new Date(c.scheduledAt).getTime() + c.durationMin * 60_000 >= Date.now());
  const archived = chats.filter((c) => new Date(c.scheduledAt).getTime() + c.durationMin * 60_000 < Date.now());

  function openChat(item: SparringChatEntry) {
    navigation.navigate('SparringGroupChat', {
      sparringId:    item.sparringId,
      sparringTitle: item.sparringTitle,
      scheduledAt:   item.scheduledAt,
      durationMin:   item.durationMin,
      isOrganizer:   item.isOrganizer,
    });
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Sparring-Chats</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      ) : (
        <FlatList
          data={active}
          keyExtractor={(item) => item.sparringId}
          renderItem={({ item }) => (
            <SparringChatListItem item={item} onPress={() => openChat(item)} />
          )}
          ListHeaderComponent={active.length > 0 ? <Text style={styles.sectionLabel}>Aktiv</Text> : null}
          ListFooterComponent={
            archived.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>Archiv</Text>
                {archived.map((item) => (
                  <SparringChatListItem key={item.sparringId} item={item} onPress={() => openChat(item)} />
                ))}
              </>
            ) : null
          }
          ListEmptyComponent={
            archived.length === 0 ? (
              <Text style={styles.empty}>Noch keine Sparring-Chats.</Text>
            ) : null
          }
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 24,
    paddingVertical:   16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    flex:       1,
    textAlign:  'center',
    fontSize:   18,
    fontWeight: '700',
    color:      colors.text,
  },
  headerSpacer: {
    width: 24,
  },
  loader: {
    marginTop: 48,
  },
  list: {
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize:          13,
    fontWeight:        '600',
    color:             colors.textSecondary,
    paddingHorizontal: 24,
    paddingTop:        16,
    paddingBottom:     8,
    textTransform:     'uppercase',
    letterSpacing:     0.5,
  },
  empty: {
    textAlign:  'center',
    marginTop:  48,
    color:      colors.textSecondary,
    fontSize:   15,
  },
});
```

- [ ] **tsc prüfen**

```bash
npx tsc --noEmit
```
Erwartet: Fehler wegen fehlendem `SparringGroupChat` in navigation/types.ts — wird in Task 9 behoben.

- [ ] **Commit**

```bash
git add src/screens/SparringChatListScreen.tsx
git commit -m "feat(screens): add SparringChatListScreen"
```

---

## Task 8: SparringGroupChatScreen

**Files:**
- Create: `src/screens/SparringGroupChatScreen.tsx`

- [ ] **Erstelle den Screen (mit eingebettetem SparringChatSettingsSheet)**

```tsx
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { useSparringGroupChat } from '../hooks/useSparringGroupChat';
import { useSparringChatSettings } from '../hooks/useSparringChatSettings';
import GroupMessageBubble from '../components/chat/GroupMessageBubble';
import ChatImagePicker from '../components/chat/ChatImagePicker';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import type { GroupMessageWithSender } from '../hooks/useSparringGroupChat';

type Props = NativeStackScreenProps<RootStackParamList, 'SparringGroupChat'>;

export default function SparringGroupChatScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<Props['route']>();
  const { user }   = useAuth();

  const { sparringId, sparringTitle, scheduledAt, durationMin, isOrganizer } = params;

  const { messages, loading, sending, isReadOnly, sendText, sendImage } =
    useSparringGroupChat(sparringId, scheduledAt, durationMin);
  const { mediaEnabled, toggleMedia } =
    useSparringChatSettings(sparringId, isOrganizer);

  const [inputText,       setInputText]       = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const listRef = useRef<FlatList<GroupMessageWithSender>>(null);

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', {
      weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  async function handleSend() {
    const text = inputText.trim();
    if (text.length === 0 || sending) return;
    setInputText('');
    await sendText(text);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{sparringTitle}</Text>
          <Text style={styles.headerSub}>{formatDate(scheduledAt)}</Text>
        </View>
        {isOrganizer ? (
          <TouchableOpacity
            onPress={() => setSettingsVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {/* Messages */}
      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <GroupMessageBubble
              message={item}
              isOwn={user?.id === item.sender_id}
            />
          )}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Read-only banner or input */}
      {isReadOnly ? (
        <View style={[styles.readOnlyBanner, { paddingBottom: insets.bottom + 8 }]}>
          <Text style={styles.readOnlyText}>Dieses Sparring hat stattgefunden.</Text>
        </View>
      ) : (
        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
          {mediaEnabled && (
            <ChatImagePicker
              onImageSelected={(uri) => { void sendImage(uri); }}
              disabled={sending}
            />
          )}
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Nachricht..."
            placeholderTextColor={colors.textSecondary}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => { void handleSend(); }}
            blurOnSubmit
          />
          <TouchableOpacity
            style={[styles.sendBtn, (inputText.trim().length === 0 || sending) && styles.sendBtnDisabled]}
            onPress={() => { void handleSend(); }}
            disabled={inputText.trim().length === 0 || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color={colors.card} />
              : <Ionicons name="send" size={18} color={colors.card} />
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Settings Sheet */}
      {settingsVisible && (
        <TouchableOpacity
          style={styles.settingsOverlay}
          activeOpacity={1}
          onPress={() => setSettingsVisible(false)}
        >
          <TouchableOpacity
            style={[styles.settingsSheet, { paddingBottom: insets.bottom + 16 }]}
            activeOpacity={1}
          >
            <View style={styles.settingsHandleRow}>
              <View style={styles.settingsHandle} />
            </View>
            <Text style={styles.settingsTitle}>Chat-Einstellungen</Text>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Bilder und Videos erlauben</Text>
              <Switch
                value={mediaEnabled}
                onValueChange={() => { void toggleMedia(); }}
                trackColor={{ false: colors.border, true: colors.accentBlue }}
                thumbColor={colors.card}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingBottom:     12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor:   colors.background,
    gap:               12,
  },
  headerCenter: {
    flex: 1,
    gap:   2,
  },
  headerTitle: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.text,
  },
  headerSub: {
    fontSize: 12,
    color:    colors.textSecondary,
  },
  headerSpacer: {
    width: 24,
  },
  loader: {
    marginTop: 48,
  },
  messageList: {
    paddingVertical: 8,
  },
  readOnlyBanner: {
    paddingHorizontal: 24,
    paddingTop:        16,
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    alignItems:        'center',
  },
  readOnlyText: {
    fontSize:  14,
    color:     colors.textSecondary,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    paddingHorizontal: 8,
    paddingTop:        8,
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    backgroundColor:   colors.background,
    gap:               8,
  },
  input: {
    flex:            1,
    minHeight:       40,
    maxHeight:       120,
    backgroundColor: colors.card,
    borderRadius:    20,
    paddingHorizontal: 16,
    paddingVertical:   10,
    fontSize:        15,
    color:           colors.text,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  sendBtn: {
    width:          40,
    height:         40,
    borderRadius:   20,
    backgroundColor: colors.accentBlue,
    alignItems:     'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent:  'flex-end',
  },
  settingsSheet: {
    backgroundColor:      colors.background,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal:    24,
    paddingTop:           8,
  },
  settingsHandleRow: {
    alignItems:    'center',
    paddingBottom: 16,
  },
  settingsHandle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.border,
  },
  settingsTitle: {
    fontSize:     18,
    fontWeight:   '700',
    color:        colors.text,
    marginBottom: 16,
  },
  settingsRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingsLabel: {
    fontSize: 15,
    color:    colors.text,
  },
});
```

- [ ] **tsc prüfen**

```bash
npx tsc --noEmit
```
Erwartet: Fehler wegen fehlendem `SparringGroupChat` in navigation/types.ts — wird in Task 9 behoben.

- [ ] **Commit**

```bash
git add src/screens/SparringGroupChatScreen.tsx
git commit -m "feat(screens): add SparringGroupChatScreen with embedded settings sheet"
```

---

## Task 9: Navigation

**Files:**
- Modify: `src/navigation/types.ts`
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] **types.ts: ersetze `SparringChat` durch zwei neue Einträge**

Finde den Block mit `SparringChat` (ca. Zeile 40–44) und ersetze ihn:

```ts
  SparringChatList: undefined;
  SparringGroupChat: {
    sparringId:    string;
    sparringTitle: string;
    scheduledAt:   string;
    durationMin:   number;
    isOrganizer:   boolean;
  };
```

- [ ] **RootNavigator.tsx: importiere neue Screens, entferne alten**

Finde den Import von `SparringChatScreen` und ersetze ihn:
```ts
import SparringChatListScreen   from '../screens/SparringChatListScreen';
import SparringGroupChatScreen  from '../screens/SparringGroupChatScreen';
```

Finde die `<Stack.Screen name="SparringChat" .../>` Zeile und ersetze sie durch:
```tsx
<Stack.Screen name="SparringChatList"  component={SparringChatListScreen}  />
<Stack.Screen name="SparringGroupChat" component={SparringGroupChatScreen} />
```

- [ ] **tsc prüfen**

```bash
npx tsc --noEmit
```
Erwartet: 0 Fehler (oder nur noch Fehler aus Task 10–12)

- [ ] **Commit**

```bash
git add src/navigation/types.ts src/navigation/RootNavigator.tsx
git commit -m "feat(nav): replace SparringChat with SparringChatList + SparringGroupChat"
```

---

## Task 10: Chat-Button auf der Map

**Files:**
- Modify: `src/components/sparring/SparringMapView.types.ts`
- Modify: `src/components/sparring/SparringMapView.ios.tsx`
- Modify: `src/components/sparring/SparringMapView.android.tsx`
- Modify: `src/screens/SparringMapScreen.tsx`

- [ ] **SparringMapView.types.ts: zwei neue Props**

```ts
export interface SparringMapViewProps {
  sparrings:       SparringWithMeta[];
  studioMarkers:   StudioMapMarker[];
  mode:            'sparrings' | 'studios';
  onSparringPress: (s: SparringWithMeta) => void;
  onStudioPress:   (st: StudioMapMarker) => void;
  totalUnread:     number;
  onChatPress:     () => void;
}
```

- [ ] **SparringMapView.ios.tsx: Chat-Button hinzufügen**

Füge `totalUnread` und `onChatPress` zur Destrukturierung der Props hinzu:
```ts
export default function SparringMapView({
  sparrings,
  studioMarkers,
  mode,
  onSparringPress,
  onStudioPress,
  totalUnread,
  onChatPress,
}: SparringMapViewProps) {
```

Füge den Chat-Button innerhalb von `<View style={styles.root}>` direkt vor dem schließenden `</View>` ein (nach dem `zoomSliderOuter`):
```tsx
{mode === 'sparrings' && (
  <TouchableOpacity style={styles.chatBtn} onPress={onChatPress} activeOpacity={0.85}>
    <Ionicons name="chatbubbles-outline" size={22} color={colors.card} />
    {totalUnread > 0 && (
      <View style={styles.chatBtnBadge}>
        <Text style={styles.chatBtnBadgeText}>
          {totalUnread > 99 ? '99+' : String(totalUnread)}
        </Text>
      </View>
    )}
  </TouchableOpacity>
)}
```

Füge `TouchableOpacity` und `Text` zu den React Native Imports hinzu.

Füge die Styles hinzu:
```ts
  chatBtn: {
    position:        'absolute',
    bottom:          32,
    left:            16,
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: colors.dark,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     colors.dark,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.25,
    shadowRadius:    6,
  },
  chatBtnBadge: {
    position:        'absolute',
    top:             -2,
    right:           -2,
    minWidth:        18,
    height:          18,
    borderRadius:    9,
    backgroundColor: colors.deleteRed,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 3,
  },
  chatBtnBadgeText: {
    fontSize:   10,
    fontWeight: '700',
    color:      colors.card,
  },
```

- [ ] **SparringMapView.android.tsx: gleiche Änderungen**

Identische Props-Destrukturierung, Chat-Button-JSX und Styles wie iOS, mit denselben Imports (`TouchableOpacity`, `Text`).

- [ ] **SparringMapScreen.tsx: Hook + Props verdrahten**

Importiere `useSparringChatList` und `useNavigation`:
```ts
import { useSparringChatList } from '../hooks/useSparringChatList';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
```

Im Screen-Body ergänze:
```ts
const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
const { totalUnread } = useSparringChatList();
```

In der `<SparringMapView ...>`-Komponente füge hinzu:
```tsx
totalUnread={totalUnread}
onChatPress={() => navigation.navigate('SparringChatList')}
```

- [ ] **tsc prüfen**

```bash
npx tsc --noEmit
```
Erwartet: 0 Fehler (oder nur noch Fehler aus Task 11–12)

- [ ] **Commit**

```bash
git add src/components/sparring/SparringMapView.types.ts \
        src/components/sparring/SparringMapView.ios.tsx \
        src/components/sparring/SparringMapView.android.tsx \
        src/screens/SparringMapScreen.tsx
git commit -m "feat(map): add chat button with unread badge to SparringMapView"
```

---

## Task 11: Auto-create chat settings bei Sparring-Erstellung

**Files:**
- Modify: `src/hooks/useSparringActions.ts`

- [ ] **Nach dem `open_sparrings`-INSERT, chat settings anlegen**

Finde in `useSparringActions.ts` den Block (ca. Zeile 107–121):
```ts
    const { error } = await supabase.from('open_sparrings').insert({
      ...
    });
    return { error: error?.message ?? null };
```

Ersetze ihn durch:
```ts
    const { data: newSparring, error } = await supabase
      .from('open_sparrings')
      .insert({
        studio_id:    params.studioId !== undefined ? studioId : (params.isAtStudio === true ? (params.atStudioId ?? null) : null),
        is_at_studio: params.studioId !== undefined ? true : (params.isAtStudio === true),
        created_by:   user.id,
        title:        params.title,
        discipline:   params.discipline,
        address:      resolvedAddress,
        lat,
        lng,
        scheduled_at: params.scheduledAt,
        duration_min: params.durationMin,
        max_slots:    params.maxSlots,
        notes:        params.notes.trim() || null,
      })
      .select('id')
      .single();

    if (error !== null || newSparring === null) {
      return { error: error?.message ?? 'Sparring konnte nicht erstellt werden.' };
    }

    await supabase
      .from('sparring_chat_settings')
      .insert({ sparring_id: newSparring.id });

    return { error: null };
```

- [ ] **tsc prüfen**

```bash
npx tsc --noEmit
```
Erwartet: 0 Fehler (oder nur noch Fehler aus Task 12)

- [ ] **Commit**

```bash
git add src/hooks/useSparringActions.ts
git commit -m "feat(hooks): auto-create sparring_chat_settings on sparring creation"
```

---

## Task 12: Alten Code entfernen

**Files:**
- Delete: `src/screens/SparringChatScreen.tsx`
- Delete: `src/hooks/useSparringChat.ts`
- Modify: `src/components/sparring/SparringDetailSheet.tsx`
- Modify: `src/components/sparring/SparringParticipantsList.tsx`

- [ ] **Dateien löschen**

```bash
rm src/screens/SparringChatScreen.tsx
rm src/hooks/useSparringChat.ts
```

- [ ] **SparringDetailSheet.tsx: 1-zu-1-Chat-Links entfernen**

Entferne den Block mit `onPressChat` in `SparringParticipantsList` (der Callback der auf `SparringChat` navigiert).

Entferne den Block "Schreibe an Organisator"-Button (ca. Zeilen 189–206):
```tsx
{currentUserId !== null && currentUserId !== sparring.created_by && sparring.is_signed_up === true && (
  <TouchableOpacity
    style={styles.chatBtn}
    ...
  >
    ...
  </TouchableOpacity>
)}
```

Entferne den `navigation`-Import und `useNavigation`-Aufruf wenn nach dem Entfernen nicht mehr verwendet.

Entferne die `chatBtn`- und `chatBtnText`-Styles.

- [ ] **SparringParticipantsList.tsx: `onPressChat`-Prop entfernen**

Entferne `onPressChat?` aus dem Interface und der Destrukturierung.
Entferne den `onPressChat`-Aufruf und das Chat-Icon im Render.

- [ ] **tsc prüfen**

```bash
npx tsc --noEmit
```
Erwartet: 0 Fehler

- [ ] **Commit**

```bash
git add -A
git commit -m "feat(cleanup): remove 1-on-1 sparring chat, wire up group chat everywhere"
```

---

## Task 13: Storage Bucket anlegen

- [ ] **Bucket `chat-images` anlegen**

Im Supabase Dashboard unter **Storage → New bucket**:
- Name: `chat-images`
- Public: **Ja** (öffentliche Lese-URL für Bildinhalte)

Oder per MCP-Tool `execute_sql`:
```sql
-- Dieser SQL-Befehl legt den Bucket NICHT an (Storage ist kein SQL).
-- Muss im Dashboard erfolgen: Storage → New Bucket → "chat-images" → public = true
```

- [ ] **Commit (nur falls config-Datei vorhanden)**

```bash
git add -A
git commit -m "feat: chat-images storage bucket (created in dashboard)"
```

---

## Task 14: Abschluss-Check

- [ ] **Vollständiger tsc-Lauf**

```bash
npx tsc --noEmit
```
Erwartet: 0 Fehler

- [ ] **Manuelle Smoke-Tests**
  - Neues Sparring erstellen → `sparring_chat_settings`-Zeile in DB prüfen
  - Einem Sparring beitreten → Chat in Liste sichtbar
  - Nachricht senden → erscheint bei allen Teilnehmern (Realtime)
  - Chat schließen + öffnen → Unread-Badge verschwindet
  - Organisator aktiviert Bilder → Bild-Button erscheint
  - Bild senden → erscheint inline im Chat
  - Nach Sparring-Ablauf: Eingabefeld ersetzt durch Banner
  - Unread-Badge auf Map-Button aktualisiert sich live

- [ ] **Commit**

```bash
git add -A
git commit -m "feat(sparring): sparring group chat complete"
```
