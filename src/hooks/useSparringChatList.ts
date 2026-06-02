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

    const signupSparrings = signupIds.length > 0
      ? (await supabase
          .from('open_sparrings')
          .select('id, title, scheduled_at, duration_min, created_by')
          .in('id', signupIds)).data ?? []
      : [];

    const allSparrings = [
      ...(organizerRes.data ?? []),
      ...signupSparrings.filter(
        (s) => !(organizerRes.data ?? []).some((o) => o.id === s.id),
      ),
    ];

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

    const lastMsgs = new Map<string, { content: string | null; image_url: string | null; created_at: string }>();
    for (const msg of (lastMsgRes.data ?? [])) {
      if (!lastMsgs.has(msg.sparring_id)) {
        lastMsgs.set(msg.sparring_id, { content: msg.content, image_url: msg.image_url, created_at: msg.created_at });
      }
    }

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
        const last     = lastMsgs.get(s.id) ?? null;
        const unread   = unreadMap.get(s.id) ?? 0;
        const lastText = last?.content ?? (last?.image_url != null ? 'Bild' : null);
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
