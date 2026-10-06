import { useCallback, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchChatPage } from '../lib/chatPage';
import type { PageQuery } from '../utils/chatSync';
import { useChatMessageStream } from './useChatMessageStream';
import type { EventMessage } from '../types/database.types';

export interface EventMessageWithSender extends EventMessage {
  senderName:      string | null;
  senderAvatarUrl: string | null;
}

export interface UseEventGroupChat {
  messages:       EventMessageWithSender[];
  loading:        boolean;
  loadingOlder:   boolean;
  hasMore:        boolean;
  loadOlder:      () => void;
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
  // Depend on the id, not the user object: a token refresh creates a new object.
  const userId = user?.id ?? null;
  const [sending,   setSending]   = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const senderNamesRef   = useRef<Map<string, string | null>>(new Map());
  const senderAvatarsRef = useRef<Map<string, string | null>>(new Map());

  const isReadOnly = computeIsReadOnly(scheduledAt, durationMin);

  const fetchPage = useCallback((query: PageQuery, limit: number): Promise<EventMessage[]> =>
    fetchChatPage(supabase.from('event_messages').select('*').eq('event_id', eventId), query, limit),
  [eventId]);

  // Resolves names/avatars for unknown senders once and caches them.
  const enrich = useCallback(async (rows: EventMessage[]): Promise<EventMessageWithSender[]> => {
    const missing = new Set(rows.map((r) => r.user_id).filter((id) => !senderNamesRef.current.has(id)));
    // Seed the current user so own messages show avatar/name even before they wrote anything.
    if (userId !== null && !senderNamesRef.current.has(userId)) missing.add(userId);
    if (missing.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', [...missing]);
      for (const p of profiles ?? []) {
        senderNamesRef.current.set(p.id, p.name);
        senderAvatarsRef.current.set(p.id, p.avatar_url ?? null);
      }
    }
    return rows.map((row) => ({
      ...row,
      senderName:      senderNamesRef.current.get(row.user_id) ?? null,
      senderAvatarUrl: senderAvatarsRef.current.get(row.user_id) ?? null,
    }));
  }, [userId]);

  const markRead = useCallback(async () => {
    if (userId === null) return;
    await supabase.from('event_chat_reads').upsert(
      { user_id: userId, event_id: eventId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,event_id' },
    );
  }, [eventId, userId]);

  const stream = useChatMessageStream<EventMessage, EventMessageWithSender>({
    streamKey:      `${eventId}:${userId ?? ''}`,
    channelName:    `event-group-chat-${eventId}`,
    table:          'event_messages',
    filter:         `event_id=eq.${eventId}`,
    fetchPage,
    enrich,
    onMessagesSeen: () => { void markRead(); },
  });

  const { currentSync } = stream;

  const clearSendError = useCallback(() => setSendError(null), []);

  const sendText = useCallback(async (content: string): Promise<{ error: string | null }> => {
    if (userId === null || isReadOnly) return { error: null };
    // Captured before awaiting: a late response must not land in another chat.
    const sync = currentSync();
    setSending(true);
    setSendError(null);
    const { data: newRow, error } = await supabase
      .from('event_messages')
      .insert({ event_id: eventId, user_id: userId, body: content })
      .select('*')
      .single();
    if (error !== null) {
      setSendError(error.message);
      setSending(false);
      return { error: error.message };
    }
    if (newRow !== null && sync !== null) {
      const [msg] = await enrich([newRow]);
      if (msg !== undefined) sync.receive(msg);
    }
    setSending(false);
    return { error: null };
  }, [currentSync, enrich, isReadOnly, eventId, userId]);

  return {
    messages:     stream.messages,
    loading:      stream.loading,
    loadingOlder: stream.loadingOlder,
    hasMore:      stream.hasMore,
    loadOlder:    stream.loadOlder,
    sending, isReadOnly, sendError, sendText, markRead, clearSendError,
  };
}
