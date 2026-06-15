import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { EventMessage } from '../types/database.types';

export interface EventMessageWithSender extends EventMessage {
  senderName:      string | null;
  senderAvatarUrl: string | null;
}

export interface UseEventGroupChat {
  messages:       EventMessageWithSender[];
  loading:        boolean;
  sending:        boolean;
  isReadOnly:     boolean;
  sendError:      string | null;
  sendText:       (content: string) => Promise<{ error: string | null }>;
  markRead:       () => Promise<void>;
  clearSendError: () => void;
}

function computeIsReadOnly(scheduledAt: string, durationMin: number): boolean {
  return new Date(scheduledAt).getTime() + durationMin * 60_000 < Date.now();
}

export function useEventGroupChat(
  eventId:     string,
  scheduledAt: string,
  durationMin: number,
): UseEventGroupChat {
  const { user } = useAuth();
  const [messages,  setMessages]  = useState<EventMessageWithSender[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const channelRef       = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const senderNamesRef   = useRef<Map<string, string | null>>(new Map());
  const senderAvatarsRef = useRef<Map<string, string | null>>(new Map());

  const isReadOnly = computeIsReadOnly(scheduledAt, durationMin);

  const loadMessages = useCallback(async () => {
    const { data: rows } = await supabase
      .from('event_messages')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    const senderIdSet = new Set((rows ?? []).map((r) => r.user_id));
    // Include the current user so their avatar/name is seeded even if they have no prior messages.
    if (user !== null) senderIdSet.add(user.id);
    const senderIds = [...senderIdSet];
    const { data: profiles } = senderIds.length > 0
      ? await supabase.from('profiles').select('id, name, avatar_url').in('id', senderIds)
      : { data: [] };
    const nameMap   = new Map((profiles ?? []).map((p) => [p.id, p.name]));
    const avatarMap = new Map((profiles ?? []).map((p) => [p.id, p.avatar_url]));
    for (const [id, name] of nameMap)   senderNamesRef.current.set(id, name);
    for (const [id, url]  of avatarMap) senderAvatarsRef.current.set(id, url ?? null);

    const enriched: EventMessageWithSender[] = (rows ?? []).map((row) => ({
      id:              row.id,
      event_id:        row.event_id,
      user_id:         row.user_id,
      body:            row.body,
      created_at:      row.created_at,
      senderName:      nameMap.get(row.user_id) ?? null,
      senderAvatarUrl: avatarMap.get(row.user_id) ?? null,
    }));
    setMessages(enriched);
    setLoading(false);
  }, [eventId, user]);

  const markRead = useCallback(async () => {
    // No dedicated read-tracking table for event messages — no-op placeholder.
  }, []);

  useEffect(() => {
    void loadMessages();
    void markRead();

    channelRef.current = supabase
      .channel(`event-group-chat-${eventId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_messages', filter: `event_id=eq.${eventId}` },
        async (payload) => {
          const newRow = payload.new as unknown as EventMessage;
          if (!newRow?.id) return;

          let senderName:      string | null = null;
          let senderAvatarUrl: string | null = null;
          if (senderNamesRef.current.has(newRow.user_id)) {
            senderName      = senderNamesRef.current.get(newRow.user_id) ?? null;
            senderAvatarUrl = senderAvatarsRef.current.get(newRow.user_id) ?? null;
          } else {
            const { data } = await supabase
              .from('profiles')
              .select('name, avatar_url')
              .eq('id', newRow.user_id)
              .single();
            senderName      = data?.name ?? null;
            senderAvatarUrl = data?.avatar_url ?? null;
            senderNamesRef.current.set(newRow.user_id,   senderName);
            senderAvatarsRef.current.set(newRow.user_id, senderAvatarUrl);
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === newRow.id)) return prev;
            return [...prev, { ...newRow, senderName, senderAvatarUrl }];
          });
          await markRead();
        },
      )
      .subscribe();

    return () => {
      if (channelRef.current !== null) {
        void supabase.removeChannel(channelRef.current);
      }
    };
  }, [eventId, loadMessages, markRead]);

  const clearSendError = useCallback(() => setSendError(null), []);

  const sendText = useCallback(async (content: string): Promise<{ error: string | null }> => {
    if (user === null || isReadOnly) return { error: null };
    setSending(true);
    setSendError(null);
    const { data: newRow, error } = await supabase
      .from('event_messages')
      .insert({ event_id: eventId, user_id: user.id, body: content })
      .select('*')
      .single();
    if (error !== null) {
      setSendError(error.message);
      setSending(false);
      return { error: error.message };
    }
    if (newRow !== null) {
      const senderName      = senderNamesRef.current.get(user.id) ?? null;
      const senderAvatarUrl = senderAvatarsRef.current.get(user.id) ?? null;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newRow.id)) return prev;
        return [...prev, { ...newRow, senderName, senderAvatarUrl }];
      });
    }
    setSending(false);
    return { error: null };
  }, [isReadOnly, eventId, user]);

  return { messages, loading, sending, isReadOnly, sendError, sendText, markRead, clearSendError };
}
