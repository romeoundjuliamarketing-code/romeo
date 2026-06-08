# Sparring Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow each sparring participant to chat 1:1 with the organizer of a sparring; fix hardcoded max-slots limitation for user-mode sparring creation.

**Architecture:** New `sparring_messages` table stores direct messages between any participant and the organizer, scoped by sparring. A `useSparringChat` hook loads history and subscribes to Supabase Realtime for live updates. `SparringChatScreen` is the shared UI for both sides (participant writes to organizer; organizer opens any participant's thread from a conversation list in the detail sheet).

**Tech Stack:** React Native + Expo SDK 55, Supabase Postgres + Realtime (free tier), TypeScript strict, `@expo/vector-icons` (Ionicons), `src/theme/colors.ts`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create (SQL) | `supabase/migrations/20260525100000_sparring_messages.sql` | `sparring_messages` table + RLS + indexes |
| Modify | `src/types/database.types.ts` | Add `sparring_messages` table type + `SparringMessage` convenience type |
| Create | `src/hooks/useSparringChat.ts` | Load messages, send, Realtime subscription, mark read, unread count |
| Create | `src/screens/SparringChatScreen.tsx` | Chat UI (shared for participant and organizer) |
| Modify | `src/navigation/types.ts` | Add `SparringChat` route params |
| Modify | `src/navigation/RootNavigator.tsx` | Register `SparringChatScreen` |
| Modify | `src/components/sparring/SparringDetailSheet.tsx` | Participant: "Organisator schreiben" button; Organizer: conversation list with unread badges |
| Modify | `src/components/sparring/CreateSparringSheet.tsx` | Show max-slots field in user mode (remove hardcoded `10`) |

---

## Task 1: Fix max-slots in user mode

**Files:**
- Modify: `src/components/sparring/CreateSparringSheet.tsx`

- [ ] **Step 1: Show the max-slots input in user mode**

The user-mode form currently hides the "Max. Plätze" field (it's inside `{!isUserMode && ...}`). Add it as a standalone field in user mode. Find the block:

```tsx
          {isUserMode && (
            <>
              <Text style={styles.label}>Ort</Text>
              ...address inputs...
            </>
          )}
```

After that block (before `<Text style={styles.label}>Kampfsport</Text>`), add:

```tsx
          {isUserMode && (
            <>
              <Text style={styles.label}>Max. Plätze</Text>
              <TextInput
                style={styles.input}
                value={maxSlots}
                onChangeText={setMaxSlots}
                keyboardType="numeric"
                placeholderTextColor={colors.textSecondary}
              />
            </>
          )}
```

- [ ] **Step 2: Remove hardcoded slots in handleCreate**

Find:
```typescript
    const slots = isUserMode ? 10 : parseInt(maxSlots, 10);
```

Replace with:
```typescript
    const slots = parseInt(maxSlots, 10);
```

- [ ] **Step 3: Add validation for user mode**

The existing validation block for `isUserMode` only checks address. Add slots check:

Find:
```typescript
    if (isUserMode) {
      if (address.trim().length === 0) {
        Alert.alert('Ort fehlt', 'Bitte gib einen Ort oder eine Adresse ein.');
        return;
      }
    } else {
```

Replace with:
```typescript
    if (isUserMode) {
      if (address.trim().length === 0) {
        Alert.alert('Ort fehlt', 'Bitte gib einen Ort oder eine Adresse ein.');
        return;
      }
      const slotsUser = parseInt(maxSlots, 10);
      if (isNaN(slotsUser) || slotsUser < 1) {
        Alert.alert('Ungültige Plätze', 'Bitte gib mindestens 1 Platz ein.');
        return;
      }
    } else {
```

- [ ] **Step 4: Run type check**

```bash
cd /Users/romeogeorgiadis/strikeforce && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/sparring/CreateSparringSheet.tsx
git commit -m "feat(sparring): allow custom max slots in user mode"
```

---

## Task 2: DB Migration – sparring_messages

**Files:**
- Create: `supabase/migrations/20260525100000_sparring_messages.sql`

- [ ] **Step 1: Create migration file**

```sql
-- sparring_messages: 1:1 messages between a sparring participant and the organizer
CREATE TABLE sparring_messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sparring_id  uuid        NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  sender_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content      text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sparring_messages ENABLE ROW LEVEL SECURITY;

-- Sender or recipient can read their own messages
CREATE POLICY "Conversation participants can read" ON sparring_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
  );

-- Anyone signed up for the sparring can send (not to themselves)
CREATE POLICY "Signed-up users can send" ON sparring_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND auth.uid() <> recipient_id
    AND (
      -- Either sender is signed up
      EXISTS (
        SELECT 1 FROM sparring_signups
        WHERE sparring_id = sparring_messages.sparring_id
          AND user_id = auth.uid()
      )
      -- Or sender is the organizer
      OR EXISTS (
        SELECT 1 FROM open_sparrings
        WHERE id = sparring_messages.sparring_id
          AND created_by = auth.uid()
      )
    )
  );

-- Allow marking messages as read (only recipient can update read_at)
CREATE POLICY "Recipient can mark read" ON sparring_messages
  FOR UPDATE USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Indexes for common queries
CREATE INDEX ON sparring_messages (sparring_id, sender_id, recipient_id);
CREATE INDEX ON sparring_messages (recipient_id, read_at) WHERE read_at IS NULL;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use the Supabase MCP tool `apply_migration` with:
- `project_id`: `lkgrnuwtnifnmghthbog`
- `name`: `sparring_messages`
- `query`: (content of the file above)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260525100000_sparring_messages.sql
git commit -m "feat(db): add sparring_messages table with RLS and Realtime"
```

---

## Task 3: Update database.types.ts

**Files:**
- Modify: `src/types/database.types.ts`

- [ ] **Step 1: Add sparring_messages table type**

After the `sparring_ratings` table block, before `user_reports`, add:

```typescript
      sparring_messages: {
        Row: {
          id:           string
          sparring_id:  string
          sender_id:    string
          recipient_id: string
          content:      string
          read_at:      string | null
          created_at:   string
        }
        Insert: {
          id?:          string
          sparring_id:  string
          sender_id:    string
          recipient_id: string
          content:      string
          read_at?:     string | null
          created_at?:  string
        }
        Update: {
          id?:          string
          sparring_id?: string
          sender_id?:   string
          recipient_id?: string
          content?:     string
          read_at?:     string | null
          created_at?:  string
        }
        Relationships: [
          {
            foreignKeyName: 'sparring_messages_sparring_id_fkey'
            columns: ['sparring_id']
            isOneToOne: false
            referencedRelation: 'open_sparrings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sparring_messages_sender_id_fkey'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sparring_messages_recipient_id_fkey'
            columns: ['recipient_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
```

- [ ] **Step 2: Add convenience type at the bottom**

After `export type ReportReason = ...`, add:

```typescript
export type SparringMessage = Database['public']['Tables']['sparring_messages']['Row']
export type SparringMessageInsert = Database['public']['Tables']['sparring_messages']['Insert']
```

- [ ] **Step 3: Run type check + commit**

```bash
cd /Users/romeogeorgiadis/strikeforce && npx tsc --noEmit
git add src/types/database.types.ts
git commit -m "feat(types): add sparring_messages table type"
```

---

## Task 4: useSparringChat hook

**Files:**
- Create: `src/hooks/useSparringChat.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { SparringMessage } from '../types/database.types';

interface UseSparringChatResult {
  messages:      SparringMessage[];
  loading:       boolean;
  sending:       boolean;
  sendMessage:   (content: string) => Promise<{ error: string | null }>;
  unreadCount:   number;
  markAllRead:   () => Promise<void>;
}

export function useSparringChat(
  sparringId:  string,
  otherUserId: string,
): UseSparringChatResult {
  const { user } = useAuth();

  const [messages,  setMessages]  = useState<SparringMessage[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load message history for this conversation
  const loadMessages = useCallback(async () => {
    if (user === null) return;

    const { data } = await supabase
      .from('sparring_messages')
      .select('*')
      .eq('sparring_id', sparringId)
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),` +
        `and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`,
      )
      .order('created_at', { ascending: true });

    setMessages(data ?? []);
    setLoading(false);
  }, [sparringId, otherUserId, user]);

  useEffect(() => {
    if (user === null) return;

    void loadMessages();

    // Subscribe to new messages in this conversation via Realtime
    const channel = supabase
      .channel(`sparring_chat_${sparringId}_${user.id}_${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'sparring_messages',
          filter: `sparring_id=eq.${sparringId}`,
        },
        (payload) => {
          const row = payload.new as SparringMessage;
          // Only append messages that belong to this conversation
          const isOurs =
            (row.sender_id === user.id    && row.recipient_id === otherUserId) ||
            (row.sender_id === otherUserId && row.recipient_id === user.id);
          if (isOurs) {
            setMessages((prev) => [...prev, row]);
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sparringId, otherUserId, user, loadMessages]);

  const sendMessage = useCallback(
    async (content: string): Promise<{ error: string | null }> => {
      if (user === null) return { error: 'Nicht eingeloggt' };
      if (content.trim().length === 0) return { error: 'Nachricht darf nicht leer sein' };

      setSending(true);
      const { error } = await supabase.from('sparring_messages').insert({
        sparring_id:  sparringId,
        sender_id:    user.id,
        recipient_id: otherUserId,
        content:      content.trim(),
      });
      setSending(false);

      return { error: error?.message ?? null };
    },
    [sparringId, otherUserId, user],
  );

  const markAllRead = useCallback(async () => {
    if (user === null) return;
    await supabase
      .from('sparring_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sparring_id',  sparringId)
      .eq('sender_id',    otherUserId)
      .eq('recipient_id', user.id)
      .is('read_at', null);
  }, [sparringId, otherUserId, user]);

  // Unread = messages sent by otherUser to me with no read_at
  const unreadCount = messages.filter(
    (m) => m.sender_id === otherUserId && m.read_at === null,
  ).length;

  return { messages, loading, sending, sendMessage, unreadCount, markAllRead };
}
```

- [ ] **Step 2: Run type check + commit**

```bash
cd /Users/romeogeorgiadis/strikeforce && npx tsc --noEmit
git add src/hooks/useSparringChat.ts
git commit -m "feat(hooks): add useSparringChat with Realtime subscription"
```

---

## Task 5: Navigation wiring

**Files:**
- Modify: `src/navigation/types.ts`
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Add SparringChat to RootStackParamList**

In `src/navigation/types.ts`, after `PublicProfile: {...};`, add:

```typescript
  SparringChat: {
    sparringId:        string;
    otherUserId:       string;
    otherUserName:     string;
    organizerUserId:   string;
  };
```

- [ ] **Step 2: Create placeholder screen + register in RootNavigator**

Create placeholder `src/screens/SparringChatScreen.tsx`:

```typescript
import React from 'react';
import { View } from 'react-native';
export default function SparringChatScreen(): React.ReactElement {
  return <View />;
}
```

In `src/navigation/RootNavigator.tsx`, add import:
```typescript
import SparringChatScreen from '../screens/SparringChatScreen';
```

Add screen after `PublicProfile`:
```tsx
<AppStack.Screen name="SparringChat" component={SparringChatScreen} />
```

- [ ] **Step 3: Run type check + commit**

```bash
cd /Users/romeogeorgiadis/strikeforce && npx tsc --noEmit
git add src/navigation/types.ts src/navigation/RootNavigator.tsx src/screens/SparringChatScreen.tsx
git commit -m "feat(nav): register SparringChat route"
```

---

## Task 6: SparringChatScreen

**Files:**
- Modify (replace placeholder): `src/screens/SparringChatScreen.tsx`

- [ ] **Step 1: Write the full screen**

```typescript
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import { useSparringChat } from '../hooks/useSparringChat';
import { useAuth } from '../context/AuthContext';
import type { SparringMessage } from '../types/database.types';

type NavProp    = NativeStackNavigationProp<RootStackParamList, 'SparringChat'>;
type RoutePropT = RouteProp<RootStackParamList, 'SparringChat'>;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function SparringChatScreen(): React.ReactElement {
  const navigation = useNavigation<NavProp>();
  const { params }  = useRoute<RoutePropT>();
  const { sparringId, otherUserId, otherUserName } = params;

  const { user } = useAuth();
  const { messages, loading, sending, sendMessage, markAllRead } =
    useSparringChat(sparringId, otherUserId);

  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<SparringMessage>>(null);

  // Mark messages as read when screen opens
  useEffect(() => {
    void markAllRead();
  }, [markAllRead]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  async function handleSend(): Promise<void> {
    if (draft.trim().length === 0) return;
    const text = draft.trim();
    setDraft('');
    await sendMessage(text);
  }

  function renderMessage({ item, index }: { item: SparringMessage; index: number }): React.ReactElement {
    const isOwn      = item.sender_id === user?.id;
    const prevItem   = index > 0 ? messages[index - 1] : null;
    const showDate   = prevItem === null ||
      formatDate(item.created_at) !== formatDate(prevItem.created_at);

    return (
      <>
        {showDate && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>{formatDate(item.created_at)}</Text>
          </View>
        )}
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>
            {item.content}
          </Text>
          <Text style={[styles.bubbleTime, isOwn && styles.bubbleTimeOwn]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerName} numberOfLines={1}>{otherUserName}</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.centerLoader}>
            <ActivityIndicator size="large" color={colors.accentBlue} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Noch keine Nachrichten. Schreib etwas!</Text>
            }
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Nachricht..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={1000}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (draft.trim().length === 0 || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={draft.trim().length === 0 || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator size="small" color={colors.card} />
              : <Ionicons name="send" size={18} color={colors.card} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: colors.background },
  flex:      { flex: 1 },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderBottomWidth:  1,
    borderBottomColor: colors.border,
    backgroundColor:   colors.card,
  },
  headerName: {
    flex:       1,
    textAlign:  'center',
    fontSize:   16,
    fontWeight: '700',
    color:      colors.text,
    marginHorizontal: 8,
  },
  headerRight: { width: 24 },
  centerLoader: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  messageList: {
    padding:    16,
    gap:         8,
    flexGrow:    1,
    justifyContent: 'flex-end',
  },
  dateSeparator: {
    alignItems:    'center',
    marginVertical: 8,
  },
  dateSeparatorText: {
    fontSize:   11,
    color:      colors.textSecondary,
    fontWeight: '500',
  },
  bubble: {
    maxWidth:          '80%',
    backgroundColor:   colors.card,
    borderRadius:      16,
    paddingHorizontal: 16,
    paddingVertical:   8,
    alignSelf:         'flex-start',
    gap:                4,
  },
  bubbleOwn: {
    alignSelf:       'flex-end',
    backgroundColor: colors.accentBlue,
  },
  bubbleText:    { fontSize: 15, color: colors.text },
  bubbleTextOwn: { color: colors.card },
  bubbleTime:    { fontSize: 11, color: colors.textSecondary, textAlign: 'right' },
  bubbleTimeOwn: { color: 'rgba(255,255,255,0.65)' },
  emptyText: {
    textAlign:  'center',
    color:      colors.textSecondary,
    fontSize:   14,
    marginTop:  40,
  },
  inputBar: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    gap:                8,
    padding:           16,
    borderTopWidth:     1,
    borderTopColor:    colors.border,
    backgroundColor:   colors.card,
  },
  input: {
    flex:              1,
    backgroundColor:   colors.background,
    borderRadius:      24,
    paddingHorizontal: 16,
    paddingVertical:    8,
    fontSize:          15,
    color:             colors.text,
    maxHeight:         120,
  },
  sendBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: colors.accentBlue,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.accentBlueMuted,
  },
});
```

- [ ] **Step 2: Run type check + commit**

```bash
cd /Users/romeogeorgiadis/strikeforce && npx tsc --noEmit
git add src/screens/SparringChatScreen.tsx
git commit -m "feat: add SparringChatScreen with Realtime messaging"
```

---

## Task 7: Wire SparringDetailSheet

**Files:**
- Modify: `src/components/sparring/SparringDetailSheet.tsx`

Context: `SparringDetailSheet` already has `useNavigation` and `currentUserId` from Task 11 of the previous plan.

Two new behaviours to add:
1. **Participant view** (currentUser is NOT the organizer, IS signed up): Show "Schreibe an Organisator" button below the participants list
2. **Organizer view** (currentUser IS the organizer): Show a "Nachrichten" section below the participants list, listing each participant who has sent at least one message, with unread count badge

For the organizer view, we need to load conversation summaries. Keep it simple: the organizer sees each signed-up participant as a potential conversation; on tap, open the chat (even if no messages yet).

- [ ] **Step 1: Add imports**

After the existing imports in `SparringDetailSheet.tsx`, add:

```typescript
import { ScrollView } from 'react-native';
```

(Note: check if ScrollView is already imported — if yes, skip.)

- [ ] **Step 2: Add the "Schreibe an Organisator" button for participants**

In the JSX, after `<SparringParticipantsList ... />`, add:

```tsx
        {/* Participant: button to contact organizer */}
        {currentUserId !== null && currentUserId !== sparring.created_by && sparring.is_signed_up && (
          <TouchableOpacity
            style={styles.chatBtn}
            activeOpacity={0.8}
            onPress={() => {
              onClose();
              navigation.navigate('SparringChat', {
                sparringId:      sparring.id,
                otherUserId:     sparring.created_by,
                otherUserName:   'Organisator',
                organizerUserId: sparring.created_by,
              });
            }}
          >
            <Ionicons name="chatbubble-outline" size={18} color={colors.accentBlue} />
            <Text style={styles.chatBtnText}>Schreibe an Organisator</Text>
          </TouchableOpacity>
        )}

        {/* Organizer: button to see all participant conversations */}
        {isCreator && (
          <TouchableOpacity
            style={styles.chatBtn}
            activeOpacity={0.8}
            onPress={() => {
              // Organizer opens a view of all participants — for now navigate to first participant
              // Full conversation list is in SparringChatScreen when otherUserId is empty sentinel
              // Simple approach: we list all participants inline (see SparringParticipantsList)
              // The organizer taps a participant name in the participants list to open chat
              // So just show a hint text here
            }}
          >
            <Ionicons name="chatbubbles-outline" size={18} color={colors.accentBlue} />
            <Text style={styles.chatBtnText}>Nachrichten der Teilnehmer</Text>
          </TouchableOpacity>
        )}
```

Wait — the better approach for the organizer is to reuse `SparringParticipantsList` with an extra `onPressProfile` behaviour that navigates to chat instead of profile. But that would require conditional navigation logic.

**Cleaner approach:** Add a separate prop `onPressParticipantChat?: (userId: string, name: string) => void` to `SparringParticipantsList`. When provided (organizer view), tapping a participant opens chat instead of profile. When not provided, tapping opens profile as before.

- [ ] **Step 3: Update SparringParticipantsList to support chat navigation**

In `src/components/sparring/SparringParticipantsList.tsx`, update Props:

```typescript
interface Props {
  sparringId:          string;
  currentUserId:       string | null;
  sparringScheduledAt: string;
  onPressProfile:      (userId: string) => void;
  onPressChat?:        (userId: string, name: string) => void;
}
```

Update destructuring to include `onPressChat`.

In the row `onPress`, change to:
```typescript
onPress={() => {
  if (onPressChat !== undefined) {
    onPressChat(p.userId, p.name ?? 'Unbekannt');
  } else {
    onPressProfile(p.userId);
  }
}}
```

When `onPressChat` is provided, show a `chatbubble-outline` icon on the right instead of just the arrow:

```tsx
{onPressChat !== undefined && (
  <Ionicons name="chatbubble-outline" size={18} color={colors.accentBlue} />
)}
```

- [ ] **Step 4: Wire organizer chat in SparringDetailSheet**

Pass `onPressChat` to `SparringParticipantsList` when the current user is the organizer:

```tsx
<SparringParticipantsList
  sparringId={sparring.id}
  currentUserId={currentUserId}
  sparringScheduledAt={sparring.scheduled_at}
  onPressProfile={handlePressProfile}
  onPressChat={isCreator ? (userId, name) => {
    onClose();
    navigation.navigate('SparringChat', {
      sparringId:      sparring.id,
      otherUserId:     userId,
      otherUserName:   name,
      organizerUserId: sparring.created_by,
    });
  } : undefined}
/>
```

- [ ] **Step 5: Add button styles**

In `StyleSheet.create` in `SparringDetailSheet.tsx`, add:

```typescript
  chatBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:             8,
    paddingVertical: 12,
    borderTopWidth:  1,
    borderTopColor:  colors.border,
  },
  chatBtnText: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.accentBlue,
  },
```

- [ ] **Step 6: Run type check + commit**

```bash
cd /Users/romeogeorgiadis/strikeforce && npx tsc --noEmit
git add src/components/sparring/SparringDetailSheet.tsx src/components/sparring/SparringParticipantsList.tsx
git commit -m "feat(sparring): wire chat buttons in detail sheet for participants and organizer"
```

---

## Task 8: Final type check + Obsidian log

- [ ] **Step 1: Full type check**

```bash
cd /Users/romeogeorgiadis/strikeforce && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Update Obsidian**

Append to `/Users/romeogeorgiadis/Documents/Obsidian Vault/02 Projekte/Sparr/Funktionen.md`:

```markdown

## Sparring Chat & Custom Max-Slots – 2026-05-25

- Freie Teilnehmerzahl: user-mode CreateSparringSheet zeigt jetzt Max-Plätze-Eingabe (kein hardcoded 10 mehr)
- sparring_messages Tabelle: 1:1 Nachrichten zwischen Teilnehmer und Organisator, scoped per Sparring
- useSparringChat Hook: Nachrichtenverlauf + Supabase Realtime Subscription + markAllRead
- SparringChatScreen: Chat-UI mit Datum-Trenner, Sende-Button, KeyboardAvoidingView
- SparringDetailSheet: Teilnehmer sehen "Schreibe an Organisator" Button; Organisator kann jeden Teilnehmer antippen → Chat
```

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "feat: sparring chat and custom max slots complete" --allow-empty
```

---

## Self-Review

**Spec coverage:**
| Requirement | Task |
|-------------|------|
| Custom max slots in user mode | Task 1 |
| `sparring_messages` DB table + RLS | Task 2 |
| TypeScript types | Task 3 |
| `useSparringChat` with Realtime | Task 4 |
| Navigation registration | Task 5 |
| `SparringChatScreen` UI | Task 6 |
| Detail sheet wiring (participant + organizer) | Task 7 |
| Final check | Task 8 |

**Type consistency:**
- `SparringMessage` defined in Task 3, used in Tasks 4 + 6 ✓
- `SparringChat` route params defined in Task 5, consumed in Tasks 6 + 7 ✓
- `onPressChat` prop defined in Task 7 Step 3, used in Task 7 Step 4 ✓
- `useSparringChat(sparringId, otherUserId)` signature defined in Task 4, consumed in Task 6 ✓
