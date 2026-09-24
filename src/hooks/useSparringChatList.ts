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
  unreadCount:     number;
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

    // Sparring and event chats come from a single RPC, including chats that
    // have no message yet — those are only reachable through this list.
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_chats');
    const entries: ChatListEntry[] = rpcError === null
      ? (rpcData ?? []).map((row) => (
          row.kind === 'event'
            ? {
                kind:            'event' as const,
                eventId:         row.chat_id,
                title:           row.title,
                scheduledAt:     row.scheduled_at,
                durationMin:     row.duration_min,
                isOrganizer:     row.is_organizer,
                lastMessageText: row.last_message_text,
                lastMessageAt:   row.last_message_at,
                unreadCount:     row.unread_count,
              }
            : {
                kind:            'sparring' as const,
                sparringId:      row.chat_id,
                sparringTitle:   row.title,
                scheduledAt:     row.scheduled_at,
                durationMin:     row.duration_min,
                isOrganizer:     row.is_organizer,
                lastMessageText: row.last_message_text,
                lastMessageAt:   row.last_message_at,
                unreadCount:     row.unread_count,
              }
        ))
      : [];

    // ── Sort by lastMessageAt descending (nulls last) ──────────────────────
    const merged: ChatListEntry[] = [...entries].sort((a, b) => {
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
