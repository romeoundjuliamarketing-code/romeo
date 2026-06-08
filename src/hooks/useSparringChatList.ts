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

  // showLoading=false performs a silent background refresh (used by realtime),
  // so the list never flips back to the spinner after the first load.
  const load = useCallback(async (showLoading: boolean) => {
    if (user === null) return;
    if (showLoading) setLoading(true);

    const { data, error } = await supabase.rpc('get_my_chat_list');
    if (error !== null) {
      setLoading(false);
      return;
    }

    const entries: SparringChatEntry[] = (data ?? []).map((row) => ({
      sparringId:      row.sparring_id,
      sparringTitle:   row.sparring_title,
      scheduledAt:     row.scheduled_at,
      durationMin:     row.duration_min,
      isOrganizer:     row.is_organizer,
      lastMessageText: row.last_message_text,
      lastMessageAt:   row.last_message_at,
      unreadCount:     row.unread_count,
    }));

    setChats(entries);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load(true);

    channelRef.current = supabase
      .channel('sparring-chat-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sparring_group_messages' }, (_payload) => {
        // Always silently reload — covers brand-new chats the user was just added to.
        void load(false);
      })
      .subscribe();

    return () => {
      if (channelRef.current !== null) {
        void supabase.removeChannel(channelRef.current);
      }
    };
  }, [load]);

  const totalUnread = chats.reduce((sum, c) => sum + c.unreadCount, 0);

  const refetch = useCallback(() => load(false), [load]);

  return { chats, totalUnread, loading, refetch };
}
