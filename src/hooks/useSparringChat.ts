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
