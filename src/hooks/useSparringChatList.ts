import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';

export interface ChatParticipant {
  id:        string;
  name:      string | null;
  avatarUrl: string | null;
}

/** Extra row data from get_my_chats_v2; neutral defaults on the v1 fallback. */
export interface ChatListMeta {
  /** Gym/studio (sparring) or venue (event) name. */
  placeName:      string | null;
  address:        string | null;
  lastSenderName: string | null;
  lastFromMe:     boolean;
  lastIsSystem:   boolean;
  /** Sparring signup status of the caller, 'organizer', or null. */
  myStatus:       string | null;
  /** Up to two other chat members, organizer first. */
  participants:   ChatParticipant[];
  /** All other chat members (>= participants.length); drives the "+N". */
  otherCount:     number;
}

export interface SparringChatEntry extends ChatListMeta {
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

export interface EventChatEntry extends ChatListMeta {
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
  /** Last load failed; chats keeps the previous result. */
  failed:       boolean;
  refetch:      () => Promise<void>;
}

// get_my_chats_v2 is additive; until it is deployed the list falls back to
// get_my_chats and simply shows less (no place, sender or avatars).
let v2Unavailable = false;

type RowV2 = Database['public']['Functions']['get_my_chats_v2']['Returns'][number];
type RowV1 = Database['public']['Functions']['get_my_chats']['Returns'][number];

function toEntry(row: RowV1, meta: ChatListMeta): ChatListEntry {
  const base = {
    scheduledAt:     row.scheduled_at,
    durationMin:     row.duration_min,
    isOrganizer:     row.is_organizer,
    lastMessageText: row.last_message_text,
    lastMessageAt:   row.last_message_at,
    unreadCount:     row.unread_count,
    ...meta,
  };
  return row.kind === 'event'
    ? { kind: 'event', eventId: row.chat_id, title: row.title, ...base }
    : { kind: 'sparring', sparringId: row.chat_id, sparringTitle: row.title, ...base };
}

function metaFromV2(row: RowV2): ChatListMeta {
  const participants = (row.participants ?? []).map((p) => ({ id: p.id, name: p.name, avatarUrl: p.avatar_url }));
  return {
    placeName:      row.place_name,
    address:        row.address,
    lastSenderName: row.last_sender_name,
    lastFromMe:     row.last_from_me,
    lastIsSystem:   row.last_is_system,
    myStatus:       row.my_status,
    participants,
    // Older server without other_count: show no "+N" rather than a guess.
    otherCount:     Math.max(row.other_count ?? 0, participants.length),
  };
}

function metaFromV1(row: RowV1): ChatListMeta {
  return {
    placeName: null, address: null, lastSenderName: null, lastFromMe: false, lastIsSystem: false,
    myStatus: row.is_organizer ? 'organizer' : null, participants: [], otherCount: 0,
  };
}

/** null = request failed (keep what is shown, offer a retry). */
async function fetchChatEntries(): Promise<ChatListEntry[] | null> {
  if (!v2Unavailable) {
    const { data, error } = await supabase.rpc('get_my_chats_v2');
    if (error === null) return (data ?? []).map((row) => toEntry(row, metaFromV2(row)));
    // PGRST202: function not found (migration not deployed yet).
    if (error.code === 'PGRST202') v2Unavailable = true;
  }
  const { data, error } = await supabase.rpc('get_my_chats');
  if (error !== null) return null;
  return (data ?? []).map((row) => toEntry(row, metaFromV1(row)));
}

export function useSparringChatList(): UseSparringChatList {
  const { user } = useAuth();
  const [chats,   setChats]   = useState<ChatListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed,  setFailed]  = useState(false);
  const sparringChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const eventChannelRef    = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // showLoading=false performs a silent background refresh (used by realtime),
  // so the list never flips back to the spinner after the first load.
  const load = useCallback(async (showLoading: boolean) => {
    if (user === null) return;
    if (showLoading) setLoading(true);

    // Sparring and event chats come from a single RPC, including chats that
    // have no message yet — those are only reachable through this list.
    const entries = await fetchChatEntries();
    if (entries === null) {
      setFailed(true);
      setLoading(false);
      return;
    }
    setFailed(false);

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

  return { chats, totalUnread, loading, failed, refetch };
}
