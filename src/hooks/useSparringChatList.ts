import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export interface SparringChatEntry {
  kind:             'sparring';
  sparringId:       string;
  sparringTitle:    string;
  scheduledAt:      string;
  durationMin:      number;
  isOrganizer:      boolean;
  lastMessageText:  string | null;
  lastMessageAt:    string | null;
  unreadCount:      number;
}

export interface EventChatEntry {
  kind:            'event';
  eventId:         string;
  title:           string;
  scheduledAt:     string;
  durationMin:     number;
  isOrganizer:     boolean;
  lastMessageText: string | null;
  lastMessageAt:   string | null;
  // Unread tracking for event chats is not implemented — no reads table exists.
  unreadCount:     0;
}

/** Unified entry type rendered in the chat list. */
export type ChatListEntry = SparringChatEntry | EventChatEntry;

export interface UseSparringChatList {
  chats:        ChatListEntry[];
  totalUnread:  number;
  loading:      boolean;
  refetch:      () => Promise<void>;
}

export function useSparringChatList(): UseSparringChatList {
  const { user } = useAuth();
  const [chats,   setChats]   = useState<ChatListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const sparringChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const eventChannelRef    = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // showLoading=false performs a silent background refresh (used by realtime),
  // so the list never flips back to the spinner after the first load.
  const load = useCallback(async (showLoading: boolean) => {
    if (user === null) return;
    if (showLoading) setLoading(true);

    // ── Sparring chats via existing RPC ─────────────────────────────────────
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_chat_list');
    const sparringEntries: SparringChatEntry[] = rpcError === null
      ? (rpcData ?? []).map((row) => ({
          kind:            'sparring' as const,
          sparringId:      row.sparring_id,
          sparringTitle:   row.sparring_title,
          scheduledAt:     row.scheduled_at,
          durationMin:     row.duration_min,
          isOrganizer:     row.is_organizer,
          lastMessageText: row.last_message_text,
          lastMessageAt:   row.last_message_at,
          unreadCount:     row.unread_count,
        }))
      : [];

    // ── Event chats fetched client-side ─────────────────────────────────────
    // a. Find events the user is involved in: created by user OR signed up.
    const [{ data: createdEvents }, { data: signupRows }] = await Promise.all([
      supabase
        .from('events')
        .select('id, title, scheduled_at, duration_min, created_by')
        .eq('created_by', user.id),
      supabase
        .from('event_signups')
        .select('event_id')
        .eq('user_id', user.id),
    ]);

    const signedUpIds = new Set((signupRows ?? []).map((s) => s.event_id));

    // Fetch events signed up to (that are not already in createdEvents).
    const createdIds = new Set((createdEvents ?? []).map((e) => e.id));
    const signedUpOnly = [...signedUpIds].filter((id) => !createdIds.has(id));

    let signedUpEvents: Array<{
      id: string; title: string; scheduled_at: string; duration_min: number; created_by: string;
    }> = [];
    if (signedUpOnly.length > 0) {
      const { data: rows } = await supabase
        .from('events')
        .select('id, title, scheduled_at, duration_min, created_by')
        .in('id', signedUpOnly);
      signedUpEvents = rows ?? [];
    }

    const allInvolvedEvents = [...(createdEvents ?? []), ...signedUpEvents];

    // b. For each event, fetch the newest message to get lastMessageText/At.
    //    Only include events with at least one message (mirrors sparring behaviour).
    const eventEntries: EventChatEntry[] = [];
    await Promise.all(
      allInvolvedEvents.map(async (ev) => {
        const { data: msgs } = await supabase
          .from('event_messages')
          .select('body, created_at')
          .eq('event_id', ev.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if ((msgs ?? []).length === 0) return; // no messages yet — skip
        const newest = msgs![0];

        eventEntries.push({
          kind:            'event',
          eventId:         ev.id,
          title:           ev.title,
          scheduledAt:     ev.scheduled_at,
          durationMin:     ev.duration_min,
          isOrganizer:     ev.created_by === user.id,
          lastMessageText: newest.body,
          lastMessageAt:   newest.created_at,
          // Unread tracking for event chats is not implemented — no reads table exists.
          unreadCount:     0,
        });
      }),
    );

    // ── Merge and sort by lastMessageAt descending (nulls last) ────────────
    const merged: ChatListEntry[] = [...sparringEntries, ...eventEntries].sort((a, b) => {
      if (a.lastMessageAt === null && b.lastMessageAt === null) return 0;
      if (a.lastMessageAt === null) return 1;
      if (b.lastMessageAt === null) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    setChats(merged);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load(true);

    // Realtime listener for sparring messages.
    sparringChannelRef.current = supabase
      .channel('sparring-chat-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sparring_group_messages' }, (_payload) => {
        void load(false);
      })
      .subscribe();

    // Realtime listener for event messages.
    eventChannelRef.current = supabase
      .channel('event-chat-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_messages' }, (_payload) => {
        void load(false);
      })
      .subscribe();

    return () => {
      if (sparringChannelRef.current !== null) {
        void supabase.removeChannel(sparringChannelRef.current);
      }
      if (eventChannelRef.current !== null) {
        void supabase.removeChannel(eventChannelRef.current);
      }
    };
  }, [load]);

  const totalUnread = chats.reduce((sum, c) => sum + c.unreadCount, 0);

  const refetch = useCallback(() => load(false), [load]);

  return { chats, totalUnread, loading, refetch };
}
